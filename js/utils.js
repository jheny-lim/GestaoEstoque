export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDateBR(isoDate) {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function formatQty(n) {
  const num = Number(n);
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

export function daysUntil(isoDate) {
  if (!isoDate) return null;
  const today = new Date(todayStr() + "T00:00:00");
  const target = new Date(isoDate + "T00:00:00");
  return Math.round((target - today) / 86400000);
}

export function expirationStatus(isoDate) {
  if (!isoDate) return { label: "Sem validade", cls: "badge-neutral" };
  const d = daysUntil(isoDate);
  if (d < 0) return { label: "Vencido", cls: "badge-danger" };
  if (d <= 30) return { label: `Vence em ${d}d`, cls: "badge-warn" };
  return { label: "OK", cls: "badge-ok" };
}

let toastTimer = null;
export function showToast(message, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2800);
}

export function openModal(innerHtml) {
  closeModal();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.id = "active-modal";
  backdrop.innerHTML = `<div class="modal-sheet">${innerHtml}</div>`;
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.body.appendChild(backdrop);
  return backdrop;
}

export function closeModal() {
  const existing = document.getElementById("active-modal");
  if (existing) existing.remove();
}

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
