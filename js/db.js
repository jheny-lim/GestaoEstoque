// Camada de banco de dados: SQLite (sql.js) rodando 100% no navegador,
// persistido em IndexedDB no aparelho. Nenhum dado sai do dispositivo,
// exceto quando o usuário exporta um backup manualmente (ver backup.js).

const IDB_NAME = "estoque-sqlite";
const IDB_STORE = "files";
const IDB_KEY = "estoque.db";

let sql = null;
let db = null;
let persistChain = Promise.resolve();

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  unit TEXT NOT NULL DEFAULT 'un',
  min_stock REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  note_number TEXT,
  supplier TEXT,
  note_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  note_id INTEGER REFERENCES purchase_notes(id),
  expiration_date TEXT,
  quantity_initial REAL NOT NULL,
  quantity_remaining REAL NOT NULL,
  unit_cost REAL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('entrada','saida')),
  product_id INTEGER NOT NULL REFERENCES products(id),
  batch_id INTEGER REFERENCES batches(id),
  quantity REAL NOT NULL,
  movement_date TEXT NOT NULL,
  note_id INTEGER REFERENCES purchase_notes(id),
  reason TEXT,
  expiration_date TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id);
`;

const DEFAULT_CATEGORIES = ["Insumos", "Limpeza", "Escritório"];

export async function initDb() {
  sql = await initSqlJs({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${file}`,
  });

  const saved = await idbGet(IDB_KEY);
  if (saved) {
    db = new sql.Database(new Uint8Array(saved));
  } else {
    db = new sql.Database();
    db.run(SCHEMA);
    seedCategories();
    await persist();
  }
  // Garante que o schema exista mesmo em bancos restaurados de versões antigas.
  db.run(SCHEMA);
  return db;
}

function seedCategories() {
  const stmt = db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)");
  for (const name of DEFAULT_CATEGORIES) {
    stmt.run([name]);
  }
  stmt.free();
}

// sql.js .export() fecha e reabre a conexão internamente, o que destruiria
// qualquer transação aberta. Por isso persist() não faz nada enquanto uma
// transaction() está em andamento — ela persiste uma única vez, ao final.
let inTransaction = false;

export function persist() {
  if (inTransaction) return persistChain;
  const bytes = db.export();
  persistChain = persistChain.then(() => idbSet(IDB_KEY, bytes)).catch((err) => {
    console.error("Falha ao salvar banco local:", err);
  });
  return persistChain;
}

export function all(sqlText, params = []) {
  const stmt = db.prepare(sqlText);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export function get(sqlText, params = []) {
  const rows = all(sqlText, params);
  return rows[0] || null;
}

export function run(sqlText, params = []) {
  db.run(sqlText, params);
  return persist();
}

export function runReturningId(sqlText, params = []) {
  db.run(sqlText, params);
  const row = get("SELECT last_insert_rowid() AS id");
  persist();
  return row.id;
}

export function transaction(fn) {
  inTransaction = true;
  db.run("BEGIN");
  try {
    const result = fn();
    inTransaction = false;
    db.run("COMMIT");
    persist();
    return result;
  } catch (err) {
    inTransaction = false;
    try {
      db.run("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Falha ao reverter transação:", rollbackErr);
    }
    throw err;
  }
}

export function exportBytes() {
  return db.export();
}

export function getRawDb() {
  return db;
}

export async function replaceDatabaseBytes(bytes) {
  db = new sql.Database(new Uint8Array(bytes));
  db.run(SCHEMA);
  await idbSet(IDB_KEY, db.export());
}

export function rebuildFromScratch() {
  db = new sql.Database();
  db.run(SCHEMA);
  seedCategories();
  return persist();
}
