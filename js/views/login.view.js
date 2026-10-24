import { render, esc, toast, setHeader, $ } from "../core/ui.js";
import { AuthSkill } from "../skills/auth.skill.js";

export function loginView() {
  setHeader({ visible: false });
  render(`
    <div class="max-w-sm mx-auto pt-10">
      <h1 class="text-3xl font-extrabold text-brand-700 text-center">Vitta<span class="text-brand-500">Propostas</span></h1>
      <p class="text-center text-slate-500 mt-2 mb-8">Envie propostas e receba a assinatura pelo WhatsApp.</p>
      <form id="auth-form" class="card space-y-4">
        <div><label class="label" for="email">E-mail</label>
          <input id="email" type="email" class="input" autocomplete="email" required /></div>
        <div><label class="label" for="password">Senha</label>
          <input id="password" type="password" class="input" autocomplete="current-password" minlength="6" required /></div>
        <p id="auth-error" class="text-sm text-red-600 hidden"></p>
        <button class="btn btn-primary w-full" data-mode="login">Entrar</button>
        <button type="button" id="btn-register" class="btn btn-ghost w-full">Criar conta grátis</button>
      </form>
    </div>`);

  const form = $("#auth-form");
  const errEl = $("#auth-error");

  const run = async (mode) => {
    errEl.classList.add("hidden");
    const email = $("#email").value.trim();
    const pass = $("#password").value;
    if (!form.reportValidity()) return;
    try {
      await (mode === "register" ? AuthSkill.register(email, pass) : AuthSkill.login(email, pass));
      toast("Bem-vindo!");
    } catch (e) {
      errEl.textContent = e.message;
      errEl.classList.remove("hidden");
    }
  };

  form.addEventListener("submit", (e) => { e.preventDefault(); run("login"); });
  $("#btn-register").addEventListener("click", () => run("register"));
}
