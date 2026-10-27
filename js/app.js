// Inicializador do sistema: observa a autenticação, registra rotas e inicia o roteador.
import "./firebase-config.js";
import { store } from "./core/store.js";
import { router } from "./core/router.js";
import { setHeader, $ } from "./core/ui.js";
import { AuthSkill } from "./skills/auth.skill.js";

import { loginView } from "./views/login.view.js";
import { dashboardView } from "./views/dashboard.view.js";
import { proposalFormView } from "./views/proposal-form.view.js";
import { proposalDetailView } from "./views/proposal-detail.view.js";
import { signView } from "./views/sign.view.js";

router
  .add("/login", loginView, { public: true })
  .add("/dashboard", dashboardView)
  .add("/proposta/nova", proposalFormView)
  .add("/proposta/:id/editar", proposalFormView)
  .add("/proposta/:id", proposalDetailView)
  .add("/assinar/:id", signView, { public: true }); // link enviado ao cliente

// Ação global de logout (o botão é recriado a cada tela pelo header).
document.addEventListener("click", async (e) => {
  if (e.target.closest("#btn-logout")) {
    await AuthSkill.logout();
  }
});

let started = false;
AuthSkill.onChange((user) => {
  store.set("user", user);
  store.set("authReady", true);
  if (!started) {
    started = true;
    router.start();
  } else {
    // Login ou logout: reavalia a rota atual (guardas redirecionam se preciso).
    router.go(user ? "/dashboard" : "/login");
  }
});
