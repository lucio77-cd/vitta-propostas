import { render, loading, esc, brl, fmtDate, toast, setHeader, $ } from "../core/ui.js";
import { store } from "../core/store.js";
import { router } from "../core/router.js";
import { ProposalsSkill } from "../skills/proposals.skill.js";
import { ShareSkill } from "../skills/share.skill.js";

export async function dashboardView() {
  setHeader({
    visible: true,
    actionsHtml: `<button id="btn-logout" class="underline underline-offset-2">Sair</button>`
  });
  loading();

  let list = [];
  try {
    list = await ProposalsSkill.listByOwner(store.get("user").uid);
  } catch (e) {
    console.error(e);
    // Primeira consulta pode exigir índice composto no Firestore (o erro traz o link para criá-lo).
    return render(`<div class="card text-red-700">Erro ao carregar propostas. Veja o console.</div>`);
  }

  const cards = list.map((p) => `
    <article class="card flex items-center justify-between gap-3">
      <a href="#/proposta/${p.id}" class="min-w-0 flex-1">
        <h3 class="font-semibold truncate">${esc(p.title)}</h3>
        <p class="text-sm text-slate-500 truncate">${esc(p.clientName)} · ${brl(p.total)} · ${fmtDate(p.createdAt)}</p>
        <span class="badge ${p.status === "signed" ? "badge-signed" : "badge-pending"} mt-1 inline-block">
          ${p.status === "signed" ? "Assinada" : "Aguardando"}</span>
      </a>
      <a href="${ShareSkill.whatsappUrl(p)}" target="_blank" rel="noopener"
         class="btn btn-whatsapp !px-3" aria-label="Enviar por WhatsApp">Enviar</a>
    </article>`).join("");

  render(`
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-xl font-bold">Minhas propostas</h2>
      <a href="#/proposta/nova" class="btn btn-primary">+ Nova</a>
    </div>
    <div class="space-y-3">
      ${cards || `<div class="card text-center text-slate-500 py-10">Nenhuma proposta ainda.<br>Crie a primeira em segundos.</div>`}
    </div>`);
}
