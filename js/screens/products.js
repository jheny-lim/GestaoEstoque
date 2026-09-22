import { all, get, run, runReturningId } from "../db.js";
import { showToast, openModal, closeModal, escapeHtml, formatQty } from "../utils.js";

let activeTab = "products";
let showInactive = false;

export async function render(container) {
  container.innerHTML = `
    <div class="tabs">
      <button class="tab-btn ${activeTab === "products" ? "active" : ""}" data-tab="products">Produtos</button>
      <button class="tab-btn ${activeTab === "categories" ? "active" : ""}" data-tab="categories">Categorias</button>
    </div>
    <div id="tab-content"></div>
  `;

  container.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      render(container);
    });
  });

  const content = container.querySelector("#tab-content");
  if (activeTab === "products") {
    renderProducts(content);
  } else {
    renderCategories(content);
  }
}

function stockByProduct() {
  const rows = all(`
    SELECT p.id, p.name, p.unit, p.min_stock, p.active, c.name AS category,
      COALESCE((SELECT SUM(b.quantity_remaining) FROM batches b WHERE b.product_id = p.id), 0) AS stock
    FROM products p
    JOIN categories c ON c.id = p.category_id
    ORDER BY p.active DESC, p.name ASC
  `);
  return rows;
}

function renderProducts(content) {
  const products = stockByProduct().filter((p) => showInactive || p.active);

  content.innerHTML = `
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:13px;color:var(--color-text-muted);">
      <input type="checkbox" id="toggle-inactive" ${showInactive ? "checked" : ""} /> Mostrar inativos
    </label>
    <div class="card" id="products-list">
      ${
        products.length === 0
          ? `<div class="empty-state">Nenhum produto cadastrado ainda.</div>`
          : products
              .map((p) => {
                const low = p.min_stock > 0 && p.stock < p.min_stock;
                return `
              <div class="list-item">
                <div>
                  <div class="title">${escapeHtml(p.name)} ${p.active ? "" : '<span class="badge badge-neutral">inativo</span>'}</div>
                  <div class="subtitle">${escapeHtml(p.category)} · ${escapeHtml(p.unit)}</div>
                </div>
                <div class="right">
                  <div class="${low ? "badge badge-warn" : ""}" style="font-weight:700;">${formatQty(p.stock)} ${escapeHtml(p.unit)}</div>
                  <button class="btn btn-sm btn-outline edit-product" data-id="${p.id}" style="margin-top:6px;">Editar</button>
                </div>
              </div>`;
              })
              .join("")
      }
    </div>
    <button class="fab" id="add-product-fab" aria-label="Adicionar produto">+</button>
  `;

  content.querySelector("#toggle-inactive").addEventListener("change", (e) => {
    showInactive = e.target.checked;
    renderProducts(content);
  });

  content.querySelectorAll(".edit-product").forEach((btn) => {
    btn.addEventListener("click", () => openProductModal(content, Number(btn.dataset.id)));
  });

  content.querySelector("#add-product-fab").addEventListener("click", () => openProductModal(content, null));
}

function openProductModal(content, productId) {
  const categories = all("SELECT * FROM categories ORDER BY name");
  if (categories.length === 0) {
    showToast("Cadastre uma categoria antes de criar produtos.", true);
    return;
  }
  const product = productId ? get("SELECT * FROM products WHERE id = ?", [productId]) : null;

  const modal = openModal(`
    <div class="modal-header">
      <h2>${product ? "Editar produto" : "Novo produto"}</h2>
      <button class="close-btn" id="close-modal">&times;</button>
    </div>
    <form id="product-form">
      <div class="form-group">
        <label for="p-name">Nome</label>
        <input id="p-name" required value="${product ? escapeHtml(product.name) : ""}" />
      </div>
      <div class="form-group">
        <label for="p-category">Categoria</label>
        <select id="p-category" required>
          ${categories
            .map(
              (c) =>
                `<option value="${c.id}" ${product && product.category_id === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="p-unit">Unidade</label>
          <input id="p-unit" placeholder="un, kg, L..." value="${product ? escapeHtml(product.unit) : "un"}" required />
        </div>
        <div class="form-group">
          <label for="p-min">Estoque mínimo</label>
          <input id="p-min" type="number" min="0" step="0.01" value="${product ? product.min_stock : 0}" />
        </div>
      </div>
      ${
        product
          ? `<div class="form-group">
              <label style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" id="p-active" ${product.active ? "checked" : ""} /> Produto ativo
              </label>
            </div>`
          : ""
      }
      <button type="submit" class="btn btn-primary btn-block">Salvar</button>
    </form>
  `);

  modal.querySelector("#close-modal").addEventListener("click", closeModal);
  modal.querySelector("#product-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = modal.querySelector("#p-name").value.trim();
    const categoryId = Number(modal.querySelector("#p-category").value);
    const unit = modal.querySelector("#p-unit").value.trim() || "un";
    const minStock = Number(modal.querySelector("#p-min").value) || 0;

    if (!name) {
      showToast("Informe o nome do produto.", true);
      return;
    }

    if (product) {
      const active = modal.querySelector("#p-active").checked ? 1 : 0;
      run("UPDATE products SET name=?, category_id=?, unit=?, min_stock=?, active=? WHERE id=?", [
        name,
        categoryId,
        unit,
        minStock,
        active,
        product.id,
      ]);
      showToast("Produto atualizado.");
    } else {
      runReturningId(
        "INSERT INTO products (name, category_id, unit, min_stock, active, created_at) VALUES (?,?,?,?,1,datetime('now'))",
        [name, categoryId, unit, minStock]
      );
      showToast("Produto criado.");
    }
    closeModal();
    renderProducts(content);
  });
}

function renderCategories(content) {
  const categories = all(`
    SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
    FROM categories c ORDER BY c.name
  `);

  content.innerHTML = `
    <div class="card">
      ${categories
        .map(
          (c) => `
        <div class="list-item">
          <div>
            <div class="title">${escapeHtml(c.name)}</div>
            <div class="subtitle">${c.product_count} produto(s)</div>
          </div>
          <button class="btn btn-sm btn-outline delete-category" data-id="${c.id}" ${c.product_count > 0 ? "disabled title='Categoria em uso'" : ""}>Excluir</button>
        </div>`
        )
        .join("")}
    </div>
    <form id="new-category-form" class="card" style="display:flex;gap:8px;align-items:flex-end;">
      <div class="form-group" style="flex:1;margin-bottom:0;">
        <label for="new-cat-name">Nova categoria</label>
        <input id="new-cat-name" required placeholder="Ex: Manutenção" />
      </div>
      <button type="submit" class="btn btn-primary">Adicionar</button>
    </form>
  `;

  content.querySelectorAll(".delete-category").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      run("DELETE FROM categories WHERE id=?", [Number(btn.dataset.id)]);
      showToast("Categoria removida.");
      renderCategories(content);
    });
  });

  content.querySelector("#new-category-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = content.querySelector("#new-cat-name");
    const name = input.value.trim();
    if (!name) return;
    try {
      run("INSERT INTO categories (name) VALUES (?)", [name]);
      showToast("Categoria adicionada.");
      renderCategories(content);
    } catch (err) {
      showToast("Já existe uma categoria com esse nome.", true);
    }
  });
}
