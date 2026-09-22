// Login simples de usuário único, conforme solicitado.
// Aviso: como o app roda inteiramente no navegador (GitHub Pages é hospedagem
// estática, sem servidor), isso é apenas uma trava de acesso e não uma
// autenticação de verdade — qualquer pessoa com acesso ao código-fonte pode
// contornar. Não usar para dados sensíveis de terceiros.

const SESSION_KEY = "estoque_session";
const VALID_HASH = "5d124ee10fae216b0be15fc2c281c1e4dfd6adc50115d4274c3f9a121f7ecebc";

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function tryLogin(username, password) {
  const hash = await sha256(`${username.trim()}:${password}`);
  if (hash === VALID_HASH) {
    localStorage.setItem(SESSION_KEY, username.trim());
    return true;
  }
  return false;
}

export function isLoggedIn() {
  return !!localStorage.getItem(SESSION_KEY);
}

export function currentUser() {
  return localStorage.getItem(SESSION_KEY) || "usuário";
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}
