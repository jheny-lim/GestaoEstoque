import { all, run, transaction, rebuildFromScratch } from "../db.js";
import { todayStr, showToast, openModal, closeModal } from "../utils.js";

const BACKUP_VERSION = 1;
const TABLES = ["categories", "products", "purchase_notes", "batches", "movements"];

export async function render(container) {
  container.innerHTML = `
    <div class="card">
      <div class="section-title" style="margin-top:0;">Por que isso é importante</div>
      <p>Este aplicativo guarda os dados apenas neste aparelho (armazenamento local do navegador). Não existe um servidor central: se o navegador for limpo, o app desinstalado, ou o aparelho trocado, os dados só poderão ser recuperados a partir de um backup exportado por você.</p>
      <p><strong>Recomendação:</strong> exporte um backup após registrar movimentações importantes e guarde o arquivo em um local seguro (e-mail, nuvem, computador).</p>
    </div>

    <div class="section-title">Exportar backup</div>
    <div class="card">
      <p>Gera um arquivo .json com todo o estoque atual (categorias, produtos, notas de compra, lotes e movimentações).</p>
      <button id="export-backup" class="btn btn-primary btn-block">Baixar backup (.json)</button>
    </div>

    <div class="section-title">Restaurar backup</div>
    <div class="card">
      <p>Restaura o estoque a partir de um arquivo .json exportado anteriormente. <strong>Isso substitui todos os dados atuais do aparelho.</strong></p>
      <input type="file" id="import-file" accept="application/json" style="margin-bottom:10px;width:100%;" />
      <button id="import-backup" class="btn btn-danger btn-block">Restaurar a partir do arquivo</button>
    </div>
  `;

  container.querySelector("#export-backup").addEventListener("click", exportBackup);
  container.querySelector("#import-backup").addEventListener("click", () => {
    const fileInput = container.querySelector("#import-file");
    const file = fileInput.files[0];
    if (!file) {
      showToast("Selecione um arquivo de backup primeiro.", true);
      return;
    }
    confirmAndImport(file, container);
  });
}

function exportBackup() {
  const payload = { version: BACKUP_VERSION, exported_at: new Date().toISOString(), data: {} };
  for (const table of TABLES) {
    payload.data[table] = all(`SELECT * FROM ${table}`);
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup_estoque_${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Backup exportado.");
}

function confirmAndImport(file, container) {
  const modal = openModal(`
    <div class="modal-header">
      <h2>Confirmar restauração</h2>
      <button class="close-btn" id="close-modal">&times;</button>
    </div>
    <p>Esta ação vai <strong>apagar todos os dados atuais</strong> e substituí-los pelo conteúdo do arquivo <em>${file.name}</em>. Essa ação não pode ser desfeita.</p>
    <p>Recomendado: exporte um backup do estado atual antes de continuar.</p>
    <div style="display:flex;gap:10px;margin-top:16px;">
      <button class="btn btn-outline" id="cancel-import" style="flex:1;">Cancelar</button>
      <button class="btn btn-danger" id="confirm-import" style="flex:1;">Restaurar mesmo assim</button>
    </div>
  `);
  modal.querySelector("#close-modal").addEventListener("click", closeModal);
  modal.querySelector("#cancel-import").addEventListener("click", closeModal);
  modal.querySelector("#confirm-import").addEventListener("click", async () => {
    closeModal();
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      importBackup(payload);
      showToast("Backup restaurado com sucesso.");
      render(container);
    } catch (err) {
      console.error(err);
      showToast("Arquivo de backup inválido ou corrompido.", true);
    }
  });
}

function importBackup(payload) {
  if (!payload || typeof payload !== "object" || !payload.data) {
    throw new Error("Formato de backup inválido.");
  }
  const data = payload.data;
  for (const table of TABLES) {
    if (!Array.isArray(data[table])) {
      throw new Error(`Tabela ausente no backup: ${table}`);
    }
  }

  transaction(() => {
    for (const table of [...TABLES].reverse()) {
      run(`DELETE FROM ${table}`);
    }

    insertRows("categories", data.categories, ["id", "name"]);
    insertRows("products", data.products, ["id", "name", "category_id", "unit", "min_stock", "active", "created_at"]);
    insertRows("purchase_notes", data.purchase_notes, ["id", "note_number", "supplier", "note_date", "notes", "created_at"]);
    insertRows("batches", data.batches, ["id", "product_id", "note_id", "expiration_date", "quantity_initial", "quantity_remaining", "unit_cost", "created_at"]);
    insertRows("movements", data.movements, ["id", "type", "product_id", "batch_id", "quantity", "movement_date", "note_id", "reason", "expiration_date", "created_by", "created_at"]);
  });
}

function insertRows(table, rows, columns) {
  if (rows.length === 0) return;
  const placeholders = columns.map(() => "?").join(",");
  const sql = `INSERT INTO ${table} (${columns.join(",")}) VALUES (${placeholders})`;
  for (const row of rows) {
    const values = columns.map((col) => (row[col] === undefined ? null : row[col]));
    run(sql, values);
  }
}

// Exposto apenas para uso avançado/depuração via console, se necessário.
export function resetDatabase() {
  return rebuildFromScratch();
}
