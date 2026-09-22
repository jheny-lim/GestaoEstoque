import { all } from "../db.js";
import { escapeHtml, formatQty, formatDateBR, expirationStatus, daysUntil } from "../utils.js";

export async function render(container) {
  const products = all(`
    SELECT p.id, p.name, p.unit, p.min_stock,
      COALESCE((SELECT SUM(b.quantity_remaining) FROM batches b WHERE b.product_id = p.id), 0) AS stock
    FROM products p WHERE p.active = 1
  `);

  const batches = all(`
    SELECT b.*, p.name AS product_name, p.unit
    FROM batches b JOIN products p ON p.id = b.product_id
    WHERE b.quantity_remaining > 0 AND b.expiration_date IS NOT NULL
    ORDER BY b.expiration_date ASC
  `);

  const expired = batches.filter((b) => daysUntil(b.expiration_date) < 0);
  const expiringSoon = batches.filter((b) => {
    const d = daysUntil(b.expiration_date);
    return d >= 0 && d <= 30;
  });
  const lowStock = products.filter((p) => p.min_stock > 0 && p.stock < p.min_stock);

  container.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-value">${products.length}</div>
        <div class="stat-label">Produtos ativos</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:${lowStock.length ? "var(--color-warn)" : "inherit"}">${lowStock.length}</div>
        <div class="stat-label">Abaixo do mínimo</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:${expiringSoon.length ? "var(--color-warn)" : "inherit"}">${expiringSoon.length}</div>
        <div class="stat-label">Vencendo em 30 dias</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:${expired.length ? "var(--color-danger)" : "inherit"}">${expired.length}</div>
        <div class="stat-label">Lotes vencidos</div>
      </div>
    </div>

    <div class="section-title">Vencidos / vencendo em breve</div>
    <div class="card">
      ${
        expired.length + expiringSoon.length === 0
          ? `<div class="empty-state">Nenhum item vencido ou vencendo em breve. 🎉</div>`
          : [...expired, ...expiringSoon]
              .slice(0, 15)
              .map((b) => {
                const status = expirationStatus(b.expiration_date);
                return `
              <div class="list-item">
                <div>
                  <div class="title">${escapeHtml(b.product_name)}</div>
                  <div class="subtitle">Validade: ${formatDateBR(b.expiration_date)}</div>
                </div>
                <div class="right">
                  <span class="badge ${status.cls}">${status.label}</span>
                  <div class="subtitle" style="margin-top:4px;">${formatQty(b.quantity_remaining)} ${escapeHtml(b.unit)}</div>
                </div>
              </div>`;
              })
              .join("")
      }
    </div>

    <div class="section-title">Abaixo do estoque mínimo</div>
    <div class="card">
      ${
        lowStock.length === 0
          ? `<div class="empty-state">Tudo dentro do mínimo definido.</div>`
          : lowStock
              .map(
                (p) => `
              <div class="list-item">
                <div>
                  <div class="title">${escapeHtml(p.name)}</div>
                  <div class="subtitle">Mínimo: ${formatQty(p.min_stock)} ${escapeHtml(p.unit)}</div>
                </div>
                <div class="right"><span class="badge badge-warn">${formatQty(p.stock)} ${escapeHtml(p.unit)}</span></div>
              </div>`
              )
              .join("")
      }
    </div>
  `;
}
