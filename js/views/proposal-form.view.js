import { render, esc, brl, toast, setHeader, $ } from "../core/ui.js";
import { store } from "../core/store.js";
import { router } from "../core/router.js";
import { ProposalsSkill } from "../skills/proposals.skill.js";

const itemRow = () => `
  <div class="item-row grid grid-cols-12 gap-2 items-start">
    <input class="input col-span-12 sm:col-span-6" data-f="desc" placeholder="Descrição do serviço" />
    <input class="input col-span-4 sm:col-span-2" data-f="qty" type="number" min="1" value="1" inputmode="numeric" />
    <input class="input col-span-6 sm:col-span-3" data-f="price" type="number" min="0" step="0.01" placeholder="Valor (R$)" inputmode="decimal" />
    <button type="button" class="btn-del col-span-2 sm:col-span-1 text-slate-400 hover:text-red-600 text-xl" aria-label="Remover item">×</button>
  </div>`;

export function proposalFormView() {
  setHeader({ visible: true, actionsHtml: `<a href="#/dashboard" class="underline">Voltar</a>` });
  render(`
    <h2 class="text-xl font-bold mb-4">Nova proposta</h2>
    <form id="proposal-form" class="space-y-4">
      <div class="card space-y-4">
        <div><label class="label">Título</label><input name="title" class="input" placeholder="Ex.: Ensaio fotográfico" required /></div>
        <div class="grid sm:grid-cols-2 gap-4">
          <div><label class="label">Cliente</label><input name="clientName" class="input" required /></div>
          <div><label class="label">WhatsApp do cliente</label><input name="clientPhone" class="input" type="tel" placeholder="(49) 99999-9999" inputmode="tel" /></div>
        </div>
        <div><label class="label">Descrição / escopo</label><textarea name="description" rows="4" class="input"></textarea></div>
        <div><label class="label">Válida até</label><input name="validUntil" type="date" class="input" /></div>
      </div>

      <div class="card space-y-3">
        <h3 class="font-semibold">Itens</h3>
        <div id="items" class="space-y-2">${itemRow()}</div>
        <button type="button" id="add-item" class="btn btn-ghost w-full">+ Adicionar item</button>
        <p class="text-right text-lg font-bold">Total: <span id="total">${brl(0)}</span></p>
      </div>

      <button class="btn btn-primary w-full" id="btn-save">Salvar proposta</button>
    </form>`);

  const itemsEl = $("#items");
  const readItems = () =>
    [...itemsEl.querySelectorAll(".item-row")].map((r) => ({
      desc: r.querySelector('[data-f="desc"]').value,
      qty: r.querySelector('[data-f="qty"]').value,
      price: r.querySelector('[data-f="price"]').value
    }));
  const updateTotal = () => ($("#total").textContent = brl(ProposalsSkill.calcTotal(readItems())));

  itemsEl.addEventListener("input", updateTotal);
  itemsEl.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-del") && itemsEl.children.length > 1) {
      e.target.closest(".item-row").remove();
      updateTotal();
    }
  });
  $("#add-item").addEventListener("click", () => itemsEl.insertAdjacentHTML("beforeend", itemRow()));

  $("#proposal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#btn-save");
    btn.disabled = true;
    try {
      const fd = Object.fromEntries(new FormData(e.target));
      const id = await ProposalsSkill.create(store.get("user").uid, { ...fd, items: readItems() });
      toast("Proposta criada!");
      router.go(`/proposta/${id}`);
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  });
}
