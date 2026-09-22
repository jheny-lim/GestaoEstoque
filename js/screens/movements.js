import { all, get, run, runReturningId, transaction } from "../db.js";
import { todayStr, showToast, escapeHtml, formatQty, formatDateBR } from "../utils.js";
import { currentUser } from "../auth.js";

let activeTab = "entrada";
let lineSeq = 0;

export async function render(container) {
  container.innerHTML = `
    <div class="tabs">
      <button class="tab-btn ${activeTab === "entrada" ? "active" : ""}" data-tab="entrada">Entrada (Nota de Compra)</button>
      <button class="tab-btn ${activeTab === "saida" ? "active" : ""}" data-tab="saida">Saída</button>
    </div>
    <div id="tab-content"></div>
    <div class="section-title">Últimas movimentações</div>
    <div class="card" id="recent-movements"></div>
  `;

  container.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      render(container);
    });
  });

  const content = container.querySelector("#tab-content");
  if (activeTab === "entrada") {
    renderEntradaForm(content, container);
  } else {
    renderSaidaForm(content, container);
  }
  renderRecentMovements(container.querySelector("#recent-movements"));
}

function productOptions(selected) {
  const products = all(`
    SELECT p.id, p.name, p.unit, c.name AS category FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1 ORDER BY p.name
  `);
  if (products.length === 0) {
    return { options: `<option value="">Nenhum produto ativo</option>`, products };
  }
  return {
    options: products
      .map((p) => `<option value="${p.id}" ${selected === p.id ? "selected" : ""}>${escapeHtml(p.name)} (${escapeHtml(p.category)})</option>`)
      .join(""),
    products,
  };
}

function renderEntradaForm(content, screenContainer) {
  content.innerHTML = `
    <form id="entrada-form" class="card">
      <div class="section-title" style="margin-top:0;">Dados da nota</div>
      <div class="form-row">
        <div class="form-group">
          <label for="e-number">Número da nota</label>
          <input id="e-number" placeholder="Opcional" />
        </div>
        <div class="form-group">
          <label for="e-date">Data</label>
          <input id="e-date" type="date" value="${todayStr()}" required />
        </div>
      </div>
      <div class="form-group">
        <label for="e-supplier">Fornecedor</label>
        <input id="e-supplier" placeholder="Opcional" />
      </div>

      <div class="section-title">Itens</div>
      <div id="entrada-items"></div>
      <button type="button" class="btn btn-outline btn-sm" id="add-entrada-item">+ Adicionar item</button>

      <button type="submit" class="btn btn-primary btn-block" style="margin-top:18px;">Registrar entrada</button>
    </form>
  `;

  const itemsWrap = content.querySelector("#entrada-items");
  const addLine = () => itemsWrap.appendChild(buildEntradaLine());
  content.querySelector("#add-entrada-item").addEventListener("click", addLine);
  addLine();

  content.querySelector("#entrada-form").addEventListener("submit", (e) => {
    e.preventDefault();
    submitEntrada(content, screenContainer);
  });
}

function buildEntradaLine() {
  const { options, products } = productOptions(null);
  const wrap = document.createElement("div");
  wrap.className = "item-line";
  wrap.dataset.seq = ++lineSeq;
  wrap.innerHTML = `
    <button type="button" class="remove-line" title="Remover">&times;</button>
    <div class="form-group">
      <label>Produto</label>
      <select class="line-product" ${products.length === 0 ? "disabled" : ""}>${options}</select>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Quantidade</label>
        <input type="number" class="line-qty" min="0.01" step="0.01" required />
      </div>
      <div class="form-group">
        <label>Validade</label>
        <input type="date" class="line-exp" />
      </div>
    </div>
    <div class="form-group">
      <label>Custo unitário (opcional)</label>
      <input type="number" class="line-cost" min="0" step="0.01" />
    </div>
  `;
  wrap.querySelector(".remove-line").addEventListener("click", () => wrap.remove());
  return wrap;
}

function submitEntrada(content, screenContainer) {
  const noteNumber = content.querySelector("#e-number").value.trim() || null;
  const noteDate = content.querySelector("#e-date").value;
  const supplier = content.querySelector("#e-supplier").value.trim() || null;

  const lines = [...content.querySelectorAll("#entrada-items .item-line")].map((line) => ({
    productId: Number(line.querySelector(".line-product").value) || null,
    quantity: Number(line.querySelector(".line-qty").value) || 0,
    expiration: line.querySelector(".line-exp").value || null,
    cost: line.querySelector(".line-cost").value ? Number(line.querySelector(".line-cost").value) : null,
  }));

  if (lines.length === 0 || lines.some((l) => !l.productId || l.quantity <= 0)) {
    showToast("Preencha ao menos um item com produto e quantidade válidos.", true);
    return;
  }

  transaction(() => {
    const noteId = runReturningId(
      "INSERT INTO purchase_notes (note_number, supplier, note_date, created_at) VALUES (?,?,?,datetime('now'))",
      [noteNumber, supplier, noteDate]
    );
    for (const line of lines) {
      const batchId = runReturningId(
        "INSERT INTO batches (product_id, note_id, expiration_date, quantity_initial, quantity_remaining, unit_cost, created_at) VALUES (?,?,?,?,?,?,datetime('now'))",
        [line.productId, noteId, line.expiration, line.quantity, line.quantity, line.cost]
      );
      run(
        "INSERT INTO movements (type, product_id, batch_id, quantity, movement_date, note_id, expiration_date, created_by, created_at) VALUES ('entrada',?,?,?,?,?,?,?,datetime('now'))",
        [line.productId, batchId, line.quantity, noteDate, noteId, line.expiration, currentUser()]
      );
    }
  });

  showToast("Entrada registrada com sucesso.");
  render(screenContainer);
}

function renderSaidaForm(content, screenContainer) {
  content.innerHTML = `
    <form id="saida-form" class="card">
      <div class="form-row">
        <div class="form-group">
          <label for="s-date">Data</label>
          <input id="s-date" type="date" value="${todayStr()}" required />
        </div>
        <div class="form-group">
          <label for="s-reason">Motivo / Setor</label>
          <input id="s-reason" placeholder="Ex: Limpeza - Sala 2" />
        </div>
      </div>

      <div class="section-title">Itens</div>
      <div id="saida-items"></div>
      <button type="button" class="btn btn-outline btn-sm" id="add-saida-item">+ Adicionar item</button>

      <button type="submit" class="btn btn-primary btn-block" style="margin-top:18px;">Registrar saída</button>
    </form>
  `;

  const itemsWrap = content.querySelector("#saida-items");
  const addLine = () => itemsWrap.appendChild(buildSaidaLine());
  content.querySelector("#add-saida-item").addEventListener("click", addLine);
  addLine();

  content.querySelector("#saida-form").addEventListener("submit", (e) => {
    e.preventDefault();
    submitSaida(content, screenContainer);
  });
}

function buildSaidaLine() {
  const { options, products } = productOptions(null);
  const wrap = document.createElement("div");
  wrap.className = "item-line";
  wrap.dataset.seq = ++lineSeq;
  wrap.innerHTML = `
    <button type="button" class="remove-line" title="Remover">&times;</button>
    <div class="form-group">
      <label>Produto</label>
      <select class="line-product" ${products.length === 0 ? "disabled" : ""}>${options}</select>
    </div>
    <div class="form-group">
      <label>Quantidade</label>
      <input type="number" class="line-qty" min="0.01" step="0.01" required />
    </div>
    <div class="subtitle line-stock-hint"></div>
  `;
  const select = wrap.querySelector(".line-product");
  const hint = wrap.querySelector(".line-stock-hint");
  const updateHint = () => {
    const pid = Number(select.value);
    if (!pid) { hint.textContent = ""; return; }
    const row = get("SELECT COALESCE(SUM(quantity_remaining),0) AS stock, unit FROM batches b JOIN products p ON p.id=b.product_id WHERE b.product_id=? GROUP BY p.unit", [pid]);
    const product = get("SELECT unit FROM products WHERE id=?", [pid]);
    const stock = row ? row.stock : 0;
    hint.textContent = `Disponível: ${formatQty(stock)} ${product ? product.unit : ""}`;
  };
  select.addEventListener("change", updateHint);
  updateHint();
  wrap.querySelector(".remove-line").addEventListener("click", () => wrap.remove());
  return wrap;
}

function submitSaida(content, screenContainer) {
  const date = content.querySelector("#s-date").value;
  const reason = content.querySelector("#s-reason").value.trim() || null;

  const lines = [...content.querySelectorAll("#saida-items .item-line")].map((line) => ({
    productId: Number(line.querySelector(".line-product").value) || null,
    quantity: Number(line.querySelector(".line-qty").value) || 0,
  }));

  if (lines.length === 0 || lines.some((l) => !l.productId || l.quantity <= 0)) {
    showToast("Preencha ao menos um item com produto e quantidade válidos.", true);
    return;
  }

  // valida disponibilidade antes de consumir
  for (const line of lines) {
    const row = get("SELECT COALESCE(SUM(quantity_remaining),0) AS stock FROM batches WHERE product_id=?", [line.productId]);
    if ((row?.stock ?? 0) < line.quantity) {
      const product = get("SELECT name FROM products WHERE id=?", [line.productId]);
      showToast(`Estoque insuficiente para ${product ? product.name : "produto"}.`, true);
      return;
    }
  }

  try {
    transaction(() => {
      for (const line of lines) {
        let remaining = line.quantity;
        const batches = all(
          "SELECT * FROM batches WHERE product_id=? AND quantity_remaining > 0 ORDER BY (expiration_date IS NULL), expiration_date ASC, id ASC",
          [line.productId]
        );
        for (const batch of batches) {
          if (remaining <= 0) break;
          const consume = Math.min(batch.quantity_remaining, remaining);
          run("UPDATE batches SET quantity_remaining = quantity_remaining - ? WHERE id=?", [consume, batch.id]);
          run(
            "INSERT INTO movements (type, product_id, batch_id, quantity, movement_date, reason, expiration_date, created_by, created_at) VALUES ('saida',?,?,?,?,?,?,?,datetime('now'))",
            [line.productId, batch.id, consume, date, reason, batch.expiration_date, currentUser()]
          );
          remaining -= consume;
        }
        if (remaining > 0.0001) {
          throw new Error("Estoque insuficiente durante o processamento.");
        }
      }
    });
    showToast("Saída registrada com sucesso.");
    render(screenContainer);
  } catch (err) {
    showToast(err.message || "Erro ao registrar saída.", true);
  }
}

function renderRecentMovements(el) {
  const rows = all(`
    SELECT m.*, p.name AS product_name, p.unit AS unit
    FROM movements m JOIN products p ON p.id = m.product_id
    ORDER BY m.movement_date DESC, m.id DESC
    LIMIT 20
  `);

  if (rows.length === 0) {
    el.innerHTML = `<div class="empty-state">Nenhuma movimentação registrada ainda.</div>`;
    return;
  }

  el.innerHTML = rows
    .map((m) => {
      const badge = m.type === "entrada" ? '<span class="badge badge-ok">Entrada</span>' : '<span class="badge badge-danger">Saída</span>';
      const sub = m.type === "entrada" ? (m.expiration_date ? `Validade: ${formatDateBR(m.expiration_date)}` : "Sem validade") : (m.reason || "—");
      return `
      <div class="list-item">
        <div>
          <div class="title">${escapeHtml(m.product_name)}</div>
          <div class="subtitle">${badge} · ${formatDateBR(m.movement_date)} · ${escapeHtml(sub)}</div>
        </div>
        <div class="right" style="font-weight:700;">${formatQty(m.quantity)} ${escapeHtml(m.unit)}</div>
      </div>`;
    })
    .join("");
}
