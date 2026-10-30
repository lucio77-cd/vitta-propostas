// Tela PÚBLICA: o cliente abre o link do WhatsApp, lê a proposta (e o contrato) e assina.
import { render, loading, esc, toast, setHeader, $ } from "../core/ui.js";
import { ProposalsSkill } from "../skills/proposals.skill.js";
import { SignatureSkill } from "../skills/signature.skill.js";
import { IntegritySkill } from "../skills/integrity.skill.js";
import { ContractPdfSkill } from "../skills/contract-pdf.skill.js";
import { proposalBody } from "./proposal-detail.view.js";
import { showPdf, pdfButtonsHtml, wirePdfActions } from "./contract-viewer.js";

export async function signView({ id }) {
  setHeader({ visible: false });
  loading();

  let p;
  try {
    p = await ProposalsSkill.get(id);
  } catch (e) {
    console.error(e);
    return render(`<div class="card text-center">Não foi possível abrir a proposta. Tente novamente.</div>`);
  }
  if (!p) return render(`<div class="card text-center">Proposta não encontrada ou link inválido.</div>`);

  // Contrato: sem a assinatura do cliente (antes de assinar) ou completo (depois).
  let pdf = null;
  if (p.contractId) {
    try {
      pdf = await ContractPdfSkill.forProposal(p);
    } catch (e) {
      console.error(e);
      return render(`<div class="card text-center">Não foi possível carregar o contrato. Tente novamente em instantes.</div>`);
    }
  }
  const contractCard = pdf
    ? `<div class="card space-y-3"><h3 class="font-semibold">Contrato</h3><div id="contract-view"></div></div>`
    : "";

  // ---------- Já assinada ----------
  if (p.status === "signed") {
    render(`
      <div class="space-y-4">
        ${proposalBody(p)}
        ${contractCard}
        ${pdf ? pdfButtonsHtml("Baixar PDF assinado") : ""}
        <div class="card text-center"><span class="badge badge-signed">Proposta já assinada</span>
          <p class="mt-2 text-slate-500">Obrigado, ${esc(p.signature.name)}!</p></div>
      </div>`);
    if (pdf) {
      wirePdfActions(async () => pdf.bytes, ContractPdfSkill.fileName(p), p.title);
      showPdf($("#contract-view"), pdf.bytes).catch((e) => { console.error(e); toast("Não foi possível mostrar o contrato."); });
    }
    return;
  }

  // ---------- Aguardando assinatura ----------
  render(`
    <div class="space-y-4">
      <p class="text-center font-extrabold text-brand-700 text-xl">Vitta<span class="text-brand-500">Propostas</span></p>
      ${proposalBody(p)}
      ${contractCard}
      <form id="sign-form" class="card space-y-4">
        <h3 class="font-semibold">Assinar${pdf ? " contrato e proposta" : " proposta"}</h3>
        <div><label class="label">Nome completo</label><input name="name" class="input" autocomplete="name" required /></div>
        <div><label class="label">CPF/CNPJ${pdf ? "" : " (opcional)"}</label>
          <input name="document" class="input" inputmode="numeric" value="${esc(p.clientDocument ?? "")}" ${pdf ? "required" : ""} /></div>
        <div>
          <label class="label">Assine com o dedo ou mouse</label>
          <canvas id="pad" class="signature-pad"></canvas>
          <button type="button" id="btn-clear" class="text-sm text-slate-500 underline mt-1">Limpar</button>
        </div>
        ${pdf ? `
          <label class="flex items-start gap-2 text-sm">
            <input type="checkbox" name="agree" required class="mt-1 h-4 w-4" />
            <span>Li o contrato acima e concordo com os seus termos.</span>
          </label>` : ""}
        <button class="btn btn-primary w-full" id="btn-sign">Aceitar e assinar</button>
      </form>
    </div>`);

  if (pdf) showPdf($("#contract-view"), pdf.bytes).catch((e) => { console.error(e); toast("Não foi possível mostrar o contrato."); });

  const shownHash = await IntegritySkill.hash(p); // versão que o cliente está vendo
  const pad = SignatureSkill.attachPad($("#pad"));
  $("#btn-clear").addEventListener("click", () => pad.clear());

  $("#sign-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#btn-sign");
    btn.disabled = true;
    try {
      if (pad.isEmpty()) throw new Error("Faça sua assinatura no quadro.");
      const fd = Object.fromEntries(new FormData(e.target));
      // Reconfere o documento: se o profissional editou a proposta depois que o cliente
      // abriu o link, a assinatura seria sobre uma versão que ele não viu.
      const fresh = await ProposalsSkill.get(id);
      const freshHash = await IntegritySkill.hash(fresh);
      if (fresh.status === "signed" || freshHash !== shownHash) {
        toast("A proposta foi atualizada. Confira a nova versão.");
        return signView({ id });
      }
      await SignatureSkill.sign(id, { ...fd, imageDataUrl: pad.toDataURL(), contentHash: freshHash });
      toast("Proposta assinada!");
      signView({ id }); // recarrega já com o contrato assinado
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  });
}
