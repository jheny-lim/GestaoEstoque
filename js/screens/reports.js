import { all } from "../db.js";
import { todayStr, formatDateBR, formatQty, escapeHtml, showToast } from "../utils.js";

export async function render(container) {
  const categories = all("SELECT * FROM categories ORDER BY name");
  const firstDayOfMonth = todayStr().slice(0, 8) + "01";

  container.innerHTML = `
    <div class="card filters-card">
      <div class="section-title" style="margin-top:0;">Filtros</div>
      <div class="form-row">
        <div class="form-group">
          <label for="r-start">De</label>
          <input id="r-start" type="date" value="${firstDayOfMonth}" />
        </div>
        <div class="form-group">
          <label for="r-end">Até</label>
          <input id="r-end" type="date" value="${todayStr()}" />
        </div>
      </div>
      <div class="form-group">
        <label for="r-category">Categoria</label>
        <select id="r-category">
          <option value="">Todas</option>
          ${categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label for="r-type">Tipo de movimentação</label>
        <select id="r-type">
          <option value="">Todas</option>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
        </select>
      </div>
      <button id="r-generate" class="btn btn-primary btn-block">Aplicar filtros</button>
    </div>

    <div class="section-title">Resultado <span id="r-count" class="badge badge-neutral"></span></div>
    <div class="card" style="overflow-x:auto;">
      <div id="r-results"></div>
    </div>
    <button id="r-export" class="btn btn-primary btn-block" style="margin-top:14px;">Exportar CSV</button>
  `;

  const getFilters = () => ({
    start: container.querySelector("#r-start").value,
    end: container.querySelector("#r-end").value,
    categoryId: container.querySelector("#r-category").value,
    type: container.querySelector("#r-type").value,
  });

  function fetchRows() {
    const f = getFilters();
    let sql = `
      SELECT m.movement_date, m.type, c.name AS category, p.name AS product, p.unit,
             m.quantity, m.expiration_date, m.reason,
             pn.note_number, pn.supplier, m.created_by
      FROM movements m
      JOIN products p ON p.id = m.product_id
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN purchase_notes pn ON pn.id = m.note_id
      WHERE 1=1
    `;
    const params = [];
    if (f.start) { sql += " AND m.movement_date >= ?"; params.push(f.start); }
    if (f.end) { sql += " AND m.movement_date <= ?"; params.push(f.end); }
    if (f.categoryId) { sql += " AND c.id = ?"; params.push(Number(f.categoryId)); }
    if (f.type) { sql += " AND m.type = ?"; params.push(f.type); }
    sql += " ORDER BY m.movement_date DESC, m.id DESC";
    return all(sql, params);
  }

  function renderResults() {
    const rows = fetchRows();
    container.querySelector("#r-count").textContent = `${rows.length} registro(s)`;
    const resultsEl = container.querySelector("#r-results");
    if (rows.length === 0) {
      resultsEl.innerHTML = `<div class="empty-state">Nenhuma movimentação no período/filtros selecionados.</div>`;
      return;
    }
    resultsEl.innerHTML = rows
      .slice(0, 100)
      .map((r) => {
        const badge = r.type === "entrada" ? '<span class="badge badge-ok">Entrada</span>' : '<span class="badge badge-danger">Saída</span>';
        return `
        <div class="list-item">
          <div>
            <div class="title">${escapeHtml(r.product)}</div>
            <div class="subtitle">${badge} · ${escapeHtml(r.category)} · ${formatDateBR(r.movement_date)}</div>
          </div>
          <div class="right" style="font-weight:700;">${formatQty(r.quantity)} ${escapeHtml(r.unit)}</div>
        </div>`;
      })
      .join("") + (rows.length > 100 ? `<div class="empty-state">Mostrando 100 de ${rows.length}. O CSV terá todos.</div>` : "");
  }

  container.querySelector("#r-generate").addEventListener("click", renderResults);

  container.querySelector("#r-export").addEventListener("click", () => {
    const rows = fetchRows();
    if (rows.length === 0) {
      showToast("Não há dados para exportar com esses filtros.", true);
      return;
    }
    exportCsv(rows);
  });

  renderResults();
}

function csvEscape(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[";\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportCsv(rows) {
  const headers = [
    "Data",
    "Tipo",
    "Categoria",
    "Produto",
    "Quantidade",
    "Unidade",
    "Validade",
    "Nota de Compra",
    "Fornecedor",
    "Motivo/Setor (saída)",
    "Usuário",
  ];

  const lines = [headers.join(";")];
  for (const r of rows) {
    lines.push(
      [
        r.movement_date,
        r.type === "entrada" ? "Entrada" : "Saída",
        r.category,
        r.product,
        formatQty(r.quantity),
        r.unit,
        r.expiration_date || "",
        r.note_number || "",
        r.supplier || "",
        r.reason || "",
        r.created_by,
      ]
        .map(csvEscape)
        .join(";")
    );
  }

  const csvContent = "﻿" + lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `movimentacoes_${todayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
