import { initDb } from "./db.js";
import { isLoggedIn, tryLogin, logout } from "./auth.js";
import { showToast } from "./utils.js";
import * as dashboard from "./screens/dashboard.js";
import * as products from "./screens/products.js";
import * as movements from "./screens/movements.js";
import * as reports from "./screens/reports.js";
import * as backup from "./screens/backup.js";

const ROUTES = {
  dashboard: { title: "Início", module: dashboard },
  products: { title: "Produtos", module: products },
  movements: { title: "Movimentar", module: movements },
  reports: { title: "Relatórios", module: reports },
  backup: { title: "Backup", module: backup },
};

let currentRoute = "dashboard";
let dbReady = false;

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const viewEl = document.getElementById("view");
const headerTitle = document.getElementById("header-title");
const bottomNav = document.getElementById("bottom-nav");

async function boot() {
  const submitBtn = document.getElementById("login-submit");
  try {
    await initDb();
    dbReady = true;
    submitBtn.disabled = false;
    submitBtn.textContent = "Entrar";
  } catch (err) {
    console.error("Erro ao iniciar banco de dados:", err);
    document.body.innerHTML = `<div style="padding:24px;text-align:center;">Não foi possível iniciar o banco de dados local. Verifique sua conexão e recarregue a página.</div>`;
    return;
  }

  if (isLoggedIn()) {
    showApp();
  } else {
    showLogin();
  }
}

function showLogin() {
  loginScreen.hidden = false;
  appScreen.hidden = true;
}

async function showApp() {
  loginScreen.hidden = true;
  appScreen.hidden = false;
  await navigate(currentRoute);
}

async function navigate(route) {
  currentRoute = route;
  const def = ROUTES[route];
  headerTitle.textContent = def.title;
  bottomNav.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.route === route);
  });
  await def.module.render(viewEl);
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!dbReady) {
    showToast("Aguarde o carregamento do banco de dados...", true);
    return;
  }
  const username = document.getElementById("login-user").value;
  const password = document.getElementById("login-pass").value;
  const errorEl = document.getElementById("login-error");
  const ok = await tryLogin(username, password);
  if (ok) {
    errorEl.hidden = true;
    document.getElementById("login-form").reset();
    showApp();
  } else {
    errorEl.hidden = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  logout();
  showLogin();
});

bottomNav.addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-btn");
  if (!btn) return;
  navigate(btn.dataset.route);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("SW falhou:", err));
  });
}

boot();
