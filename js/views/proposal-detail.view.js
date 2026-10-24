import { render, loading, esc, brl, fmtDate, toast, setHeader, $ } from "../core/ui.js";
import { router } from "../core/router.js";
import { ProposalsSkill } from "../skills/proposals.skill.js";
import { ShareSkill } from "../skills/share.skill.js";

export const proposalBody = (p) => `
  <div class="card space-y-4">
    <div>
      <h2 class="text-2xl font-bold">${esc(p.title)}</h2>
      <p class="text-slate-500">Para ${esc(p.clientName)}${p.validUntil ? ` · válida até ${esc(p.validUntil.split("-").reverse().join("/"))}` : ""}</p>
    </div>
    ${p.description ? `<p class="whitespace-pre-line">${esc(p.description)}</p>` : ""}
    <ul class="divide-y">
      ${p.items.map((i) => `
        <li class="py-2 flex justify-between gap-3">
          <span>${esc(i.desc)} <span class="text-slate-400">× ${i.qty}</span></span>
          <span class="font-medium">${brl(i.qty * i.price)}</span>
        </li>`).join("")}
    </ul>
    <p class="text-right text-xl font-bold text-brand-700">Total: ${brl(p.total)}</p>
  </div>`;

export async function proposalDetailView({ id }) {
  setHeader({ visible: true, actionsHtml: `<a href="#/dashboard" class="underline">Voltar</a>` });
  loading();

  const p = await ProposalsSkill.get(id);
  if (!p) return render(`<div class="card">Proposta não encontrada.</div>`);

  const signed = p.status === "signed";
  render(`
    <div class="space-y-4">
      ${proposalBody(p)}
      ${signed ? `
        <div class="card">
          <span class="badge badge-signed">Assinada</span>
          <p class="mt-2">por <strong>${esc(p.signature.name)}</strong> em ${fmtDate(p.signature.signedAt)}</p>
          <img src="${p.signature.image}" alt="Assinatura" class="mt-3 border rounded-lg bg-white max-h-32" />
        </div>` : `<span class="badge badge-pending">Aguardando assinatura</span>`}

      <div class="grid gap-2 no-print">
        <a href="${ShareSkill.whatsappUrl(p)}" target="_blank" rel="noopener" class="btn btn-whatsapp">Enviar por WhatsApp</a>
        <button id="btn-copy" class="btn btn-ghost">Copiar link de assinatura</button>
        <button id="btn-print" class="btn btn-ghost">Imprimir / salvar PDF</button>
        <button id="btn-delete" class="btn text-red-600">Excluir proposta</button>
      </div>
    </div>`);

  $("#btn-copy").addEventListener("click", async () =>
    toast((await ShareSkill.copyLink(id)) ? "Link copiado!" : "Não foi possível copiar."));
  $("#btn-print").addEventListener("click", () => window.print());
  $("#btn-delete").addEventListener("click", async () => {
    if (!confirm("Excluir esta proposta?")) return;
    await ProposalsSkill.remove(id);
    toast("Proposta excluída.");
    router.go("/dashboard");
  });
}
