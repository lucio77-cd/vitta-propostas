import { render, loading, esc, brl, fmtDate, toast, setHeader, $ } from "../core/ui.js";
import { router } from "../core/router.js";
import { ProposalsSkill } from "../skills/proposals.skill.js";
import { ShareSkill } from "../skills/share.skill.js";
import { IntegritySkill } from "../skills/integrity.skill.js";
import { ContractPdfSkill } from "../skills/contract-pdf.skill.js";
import { showPdf, pdfButtonsHtml, wirePdfActions } from "./contract-viewer.js";

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
  const hasContract = Boolean(p.contractId);

  render(`
    <div class="space-y-4">
      ${proposalBody(p)}
      ${signed ? `
        <div class="card">
          <span class="badge badge-signed">Assinada</span>
          <p class="mt-2">por <strong>${esc(p.signature.name)}</strong> em ${fmtDate(p.signedAt)}</p>
          <img src="${p.signature.image}" alt="Assinatura" class="mt-3 border rounded-lg bg-white max-h-32" />
          <p id="integrity" class="text-sm mt-3 text-slate-500">Verificando integridade…</p>
          ${p.contentHash ? `<p class="text-xs mt-1 text-slate-400 break-all">SHA-256: ${esc(p.contentHash)}</p>` : ""}
        </div>` : `<span class="badge badge-pending">Aguardando assinatura</span>`}

      ${hasContract ? `
        <div class="card space-y-3">
          <h3 class="font-semibold">Contrato (PDF)</h3>
          <p class="text-sm text-slate-500">${signed
            ? "Contrato preenchido com as duas assinaturas."
            : "Prévia: ainda sem a assinatura do cliente. Confira se os dados estão certos antes de enviar."}</p>
          <div id="contract-warn" class="text-sm text-amber-700 space-y-1"></div>
          <button type="button" id="btn-view" class="btn btn-ghost w-full">Ver contrato</button>
          <div id="contract-view"></div>
          ${pdfButtonsHtml(signed ? "Baixar PDF assinado" : "Baixar prévia (PDF)")}
        </div>` : ""}

      <div class="grid gap-2 no-print">
        <a href="${ShareSkill.whatsappUrl(p)}" target="_blank" rel="noopener" class="btn btn-whatsapp">Enviar link por WhatsApp</a>
        <button id="btn-copy" class="btn btn-ghost">Copiar link de assinatura</button>
        ${signed ? "" : `<a href="#/proposta/${p.id}/editar" class="btn btn-ghost">Editar proposta</a>`}
        ${hasContract ? "" : `<button id="btn-print" class="btn btn-ghost">Imprimir / salvar PDF</button>`}
        <button id="btn-delete" class="btn text-red-600">Excluir proposta</button>
      </div>
    </div>`);

  $("#btn-copy").addEventListener("click", async () =>
    toast((await ShareSkill.copyLink(id)) ? "Link copiado!" : "Não foi possível copiar."));
  $("#btn-print")?.addEventListener("click", () => window.print());

  // --- Contrato: o PDF é gerado em segundo plano para já estar pronto ao tocar em baixar/compartilhar.
  if (hasContract) {
    const pdfPromise = ContractPdfSkill.forProposal(p);
    pdfPromise
      .then(({ warnings }) => {
        $("#contract-warn").innerHTML = warnings.map((w) => `<p>⚠ ${esc(w)}</p>`).join("");
      })
      .catch((e) => {
        console.error(e);
        $("#contract-warn").textContent = "Não foi possível gerar o contrato: " + (e.message || "erro desconhecido");
      });

    $("#btn-view").addEventListener("click", async () => {
      const btn = $("#btn-view");
      btn.disabled = true;
      btn.textContent = "Carregando…";
      try {
        await showPdf($("#contract-view"), (await pdfPromise).bytes);
        btn.classList.add("hidden");
      } catch (e) {
        console.error(e);
        toast(e.message || "Não foi possível mostrar o contrato.");
        btn.disabled = false;
        btn.textContent = "Ver contrato";
      }
    });
    wirePdfActions(async () => (await pdfPromise).bytes, ContractPdfSkill.fileName(p), p.title);
  }

  if (signed) {
    IntegritySkill.verify(p).then((ok) => {
      const el = $("#integrity");
      if (!el) return;
      if (ok === null) el.textContent = "Assinada antes do recurso de integridade (sem hash).";
      else if (ok) { el.textContent = "✔ Integridade verificada: o conteúdo não foi alterado desde a assinatura."; el.className = "text-sm mt-3 text-emerald-700"; }
      else { el.textContent = "⚠ O conteúdo difere do que foi assinado."; el.className = "text-sm mt-3 text-red-700 font-semibold"; }
    });
  }
  $("#btn-delete").addEventListener("click", async () => {
    if (!confirm("Excluir esta proposta?")) return;
    await ProposalsSkill.remove(id);
    toast("Proposta excluída.");
    router.go("/dashboard");
  });
}
