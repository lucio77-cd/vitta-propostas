// Utilitários de interface compartilhados pelas views.

export const $ = (sel, root = document) => root.querySelector(sel);

export const esc = (v = "") =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const brl = (n = 0) =>
  Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("pt-BR");
};

export const render = (html) => {
  $("#app").innerHTML = html;
};

export const loading = () =>
  render('<div class="flex justify-center py-20"><div class="spinner"></div></div>');

let toastTimer;
export function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
}

export function setHeader({ visible = true, actionsHtml = "" } = {}) {
  $("#app-header").classList.toggle("hidden", !visible);
  $("#header-actions").innerHTML = actionsHtml;
}

/** Carrega um script externo (UMD) sob demanda, uma única vez por URL. */
const loadedScripts = new Map();
export function loadScript(src) {
  if (!loadedScripts.has(src)) {
    loadedScripts.set(src, new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => { loadedScripts.delete(src); reject(new Error("Falha ao carregar " + src)); };
      document.head.appendChild(s);
    }));
  }
  return loadedScripts.get(src);
}
