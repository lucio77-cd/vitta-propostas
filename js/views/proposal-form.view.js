// Formulário de proposta: serve para criar (/proposta/nova) e editar (/proposta/:id/editar).
import { render, loading, esc, brl, toast, setHeader, $ } from "../core/ui.js";
import { store } from "../core/store.js";
import { router } from "../core/router.js";
import { ProposalsSkill } from "../skills/proposals.skill.js";
import { ProfileSkill } from "../skills/profile.skill.js";

const itemRow = (i = {}) => `
  <div class="item-row grid grid-cols-12 gap-2 items-start">
    <input class="input col-span-12 sm:col-span-6" data-f="desc" placeholder="Descrição do serviço" value="${esc(i.desc ?? "")}" />
    <input class="input col-span-4 sm:col-span-2" data-f="qty" type="number" min="1" value="${esc(i.qty ?? 1)}" inputmode="numeric" />
    <input class="input col-span-6 sm:col-span-3" data-f="price" type="number" min="0" step="0.01" placeholder="Valor (R$)" value="${esc(i.price ?? "")}" inputmode="decimal" />
    <button type="button" class="btn-del col-span-2 sm:col-span-1 text-slate-400 hover:text-red-600 text-xl" aria-label="Remover item">×</button>
  </div>`;

export async function proposalFormView({ id } = {}) {
  const editing = Boolean(id);
  const back = editing ? `#/proposta/${id}` : "#/dashboard";
  setHeader({ visible: true, actionsHtml: `<a href="${back}" class="underline">Voltar</a>` });
  loading();

  const uid = store.get("user").uid;

  // Perfil: diz se existe contrato ativo e fornece seus dados e assinatura para o "retrato" da proposta.
  let profile = {};
  try {
    profile = await ProfileSkill.get(uid);
  } catch (e) {
    console.error(e);
  }
  const hasContract = Boolean(profile.activeContractId);

  // Em edição, carrega a proposta e garante que ainda está pendente.
  let p = {};
  if (editing) {
    try {
      p = await ProposalsSkill.get(id);
    } catch (e) {
      console.error(e);
      p = null;
    }
    if (!p) return render(`<div class="card">Proposta não encontrada.</div>`);
    if (p.status !== "pending") {
      toast("Proposta assinada não pode ser editada.");
      return router.go(`/proposta/${id}`);
    }
    if (p.ownerId !== uid) {
      return render(`<div class="card">Você não tem permissão para editar esta proposta.</div>`);
    }
  }

  const useContract = hasContract && (editing ? Boolean(p.contractId) : true);
  const items = p.items?.length ? p.items : [{}];

  render(`
    <h2 class="text-xl font-bold mb-4">${editing ? "Editar proposta" : "Nova proposta"}</h2>
    <form id="proposal-form" class="space-y-4">
      <div class="card space-y-4">
        <div><label class="label">Título</label>
          <input name="title" class="input" placeholder="Ex.: Ensaio fotográfico" value="${esc(p.title ?? "")}" required /></div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div><label class="label">Cliente</label>
            <input name="clientName" class="input" value="${esc(p.clientName ?? "")}" required /></div>
          <div><label class="label">WhatsApp do cliente</label>
            <input name="clientPhone" class="input" type="tel" placeholder="(49) 99999-9999" inputmode="tel" value="${esc(p.clientPhone ?? "")}" /></div>
        </div>
        <div><label class="label">Descrição / escopo</label>
          <textarea name="description" rows="4" class="input">${esc(p.description ?? "")}</textarea></div>
        <div><label class="label">Válida até</label>
          <input name="validUntil" type="date" class="input" value="${esc(p.validUntil ?? "")}" /></div>
      </div>

      <div class="card space-y-3">
        <h3 class="font-semibold">Itens</h3>
        <div id="items" class="space-y-2">${items.map(itemRow).join("")}</div>
        <button type="button" id="add-item" class="btn btn-ghost w-full">+ Adicionar item</button>
        <p class="text-right text-lg font-bold">Total: <span id="total">${brl(0)}</span></p>
      </div>

      <div class="card space-y-3">
        <label class="flex items-start gap-3">
          <input type="checkbox" id="use-contract" class="mt-1 h-5 w-5" ${useContract ? "checked" : ""} ${hasContract ? "" : "disabled"} />
          <span><strong>Usar meu contrato padrão (PDF)</strong><br>
            <span class="text-sm text-slate-500">${hasContract
              ? "O contrato é preenchido com os dados abaixo e leva a sua assinatura. O cliente assina em cima dele."
              : `Você ainda não enviou um contrato. <a href="#/configuracoes" class="underline text-brand-700">Ir para Configurações</a>`}</span></span>
        </label>
        <div id="contract-fields" class="space-y-4 ${useContract ? "" : "hidden"}">
          <div><label class="label">CPF/CNPJ do cliente</label>
            <input name="clientDocument" class="input" inputmode="numeric" maxlength="30" value="${esc(p.clientDocument ?? "")}" ${useContract ? "required" : ""} /></div>
          <div><label class="label">Endereço do cliente</label>
            <input name="clientAddress" class="input" maxlength="200" value="${esc(p.clientAddress ?? "")}" /></div>
        </div>
      </div>

      <button class="btn btn-primary w-full" id="btn-save">${editing ? "Salvar alterações" : "Salvar proposta"}</button>
    </form>`);

  const itemsEl = $("#items");
  const readItems = () =>
    [...itemsEl.querySelectorAll(".item-row")].map((r) => ({
      desc: r.querySelector('[data-f="desc"]').value,
      qty: r.querySelector('[data-f="qty"]').value,
      price: r.querySelector('[data-f="price"]').value
    }));
  const updateTotal = () => ($("#total").textContent = brl(ProposalsSkill.calcTotal(readItems())));
  updateTotal();

  itemsEl.addEventListener("input", updateTotal);
  itemsEl.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-del") && itemsEl.children.length > 1) {
      e.target.closest(".item-row").remove();
      updateTotal();
    }
  });
  $("#add-item").addEventListener("click", () => itemsEl.insertAdjacentHTML("beforeend", itemRow()));

  $("#use-contract").addEventListener("change", (e) => {
    $("#contract-fields").classList.toggle("hidden", !e.target.checked);
    $('[name="clientDocument"]').required = e.target.checked;
  });

  $("#proposal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#btn-save");
    btn.disabled = true;
    try {
      const fd = { ...Object.fromEntries(new FormData(e.target)), items: readItems() };

      // "Retrato" do contrato e dos seus dados neste momento. Ao editar, ele é atualizado
      // para o contrato ativo e a assinatura atuais (a proposta ainda não foi assinada).
      if ($("#use-contract").checked) {
        if (!profile.signatureImage) throw new Error("Cadastre sua assinatura em Configurações antes de usar o contrato.");
        if (!profile.name?.trim()) throw new Error("Preencha seu nome em Configurações antes de usar o contrato.");
        fd.contract = {
          id: profile.activeContractId,
          professional: { name: profile.name, document: profile.document || "", city: profile.city || "", phone: profile.phone || "" },
          signature: profile.signatureImage
        };
      }

      if (editing) {
        await ProposalsSkill.update(id, fd);
        toast("Alterações salvas!");
        router.go(`/proposta/${id}`);
      } else {
        const newId = await ProposalsSkill.create(uid, fd);
        toast("Proposta criada!");
        router.go(`/proposta/${newId}`);
      }
    } catch (err) {
      console.error(err);
      toast(err.code === "permission-denied" ? "Sem permissão: publique as regras novas do Firestore." : err.message);
      btn.disabled = false;
    }
  });
}
