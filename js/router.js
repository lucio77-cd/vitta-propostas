// Roteador básico por hash (#/rota/:param). Rotas podem ser públicas ou protegidas.
import { store } from "./store.js";

const routes = [];
let cleanup = null;

function compile(path) {
  const keys = [];
  const re = new RegExp(
    "^" + path.replace(/:([a-zA-Z]+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "$"
  );
  return { re, keys };
}

export const router = {
  add(path, handler, { public: isPublic = false } = {}) {
    routes.push({ ...compile(path), handler, isPublic });
    return this;
  },

  go(path) {
    if (location.hash === "#" + path) return this.resolve();
    location.hash = path;
  },

  async resolve() {
    const path = location.hash.replace(/^#/, "") || "/dashboard";
    const user = store.get("user");

    for (const r of routes) {
      const m = path.match(r.re);
      if (!m) continue;

      // Guarda de acesso
      if (!r.isPublic && !user) return this.go("/login");
      if (path === "/login" && user) return this.go("/dashboard");

      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      if (typeof cleanup === "function") cleanup();
      cleanup = (await r.handler(params)) || null;
      window.scrollTo(0, 0);
      return;
    }
    this.go(user ? "/dashboard" : "/login");
  },

  start() {
    window.addEventListener("hashchange", () => this.resolve());
    this.resolve();
  }
};
