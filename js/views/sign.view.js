// Tela PÚBLICA: o cliente abre o link do WhatsApp, lê a proposta e assina.
import { render, loading, esc, toast, setHeader, $ } from "../core/ui.js";
import { ProposalsSkill } from "../skills/proposals.skill.js";
import { SignatureSkill } from "../skills/signature.skill.js";
import { proposalBody } from "./proposal-detail.view.js";

export async function signView({ id }) {
  setHeader({ visible: false });
  loading();

  const p = await ProposalsSkill.get(id);
  if (!p) return render(`<div class="card text-center">Proposta não encontrada ou link inválido.</div>`);

  if (p.status === "signed") {
    return render(`
      <div class="space-y-4">
        ${proposalBody(p)}
        <div class="card text-center"><span class="badge badge-signed">Proposta já assinada</span>
          <p class="mt-2 text-slate-500">Obrigado, ${esc(p.signature.name)}!</p></div>
      </div>`);
  }

  render(`
    <div class="space-y-4">
      <p class="text-center font-extrabold text-brand-700 text-xl">Vitta<span class="text-brand-500">Propostas</span></p>
      ${proposalBody(p)}
      <form id="sign-form" class="card space-y-4">
        <h3 class="font-semibold">Assinar proposta</h3>
        <div><label class="label">Nome completo</label><input name="name" class="input" autocomplete="name" required /></div>
        <div><label class="label">CPF/CNPJ (opcional)</label><input name="document" class="input" inputmode="numeric" /></div>
        <div>
          <label class="label">Assine com o dedo ou mouse</label>
          <canvas id="pad" class="signature-pad"></canvas>
          <button type="button" id="btn-clear" class="text-sm text-slate-500 underline mt-1">Limpar</button>
        </div>
        <button class="btn btn-primary w-full" id="btn-sign">Aceitar e assinar</button>
      </form>
    </div>`);

  const pad = SignatureSkill.attachPad($("#pad"));
  $("#btn-clear").addEventListener("click", () => pad.clear());

  $("#sign-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#btn-sign");
    btn.disabled = true;
    try {
      if (pad.isEmpty()) throw new Error("Faça sua assinatura no quadro.");
      const fd = Object.fromEntries(new FormData(e.target));
      await SignatureSkill.sign(id, { ...fd, imageDataUrl: pad.toDataURL() });
      toast("Proposta assinada!");
      signView({ id });
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  });
}
