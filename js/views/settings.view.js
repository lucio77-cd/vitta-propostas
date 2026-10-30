// Configurações: dados do profissional, assinatura (desenhada uma vez) e o contrato padrão (PDF).
import { render, loading, esc, toast, setHeader, $ } from "../core/ui.js";
import { store } from "../core/store.js";
import { router } from "../core/router.js";
import { ProfileSkill } from "../skills/profile.skill.js";
import { ContractsSkill } from "../skills/contracts.skill.js";
import { SignatureSkill } from "../skills/signature.skill.js";

export async function settingsView() {
  setHeader({ visible: true, actionsHtml: `<a href="#/dashboard" class="underline">Voltar</a>` });
  loading();

  const uid = store.get("user").uid;
  let profile = {};
  let contract = null;
  try {
    profile = await ProfileSkill.get(uid);
    if (profile.activeContractId) contract = await ContractsSkill.get(profile.activeContractId);
  } catch (e) {
    console.error(e);
    return render(`<div class="card text-red-700">Erro ao carregar as configurações. ${esc(e.code || e.message)}</div>`);
  }

  const hasProSignatureField = contract?.fields?.some((f) => f.key === "assinatura_profissional");

  render(`
    <h2 class="text-xl font-bold mb-4">Configurações</h2>

    <form id="profile-form" class="card space-y-4 mb-5">
      <h3 class="font-semibold">Seus dados (usados no contrato)</h3>
      <div><label class="label">Nome ou empresa</label>
        <input name="name" class="input" maxlength="120" value="${esc(profile.name ?? "")}" /></div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div><label class="label">CPF/CNPJ</label>
          <input name="document" class="input" maxlength="30" inputmode="numeric" value="${esc(profile.document ?? "")}" /></div>
        <div><label class="label">Telefone</label>
          <input name="phone" class="input" maxlength="30" type="tel" value="${esc(profile.phone ?? "")}" /></div>
      </div>
      <div><label class="label">Cidade/UF</label>
        <input name="city" class="input" maxlength="80" value="${esc(profile.city ?? "")}" /></div>
      <button class="btn btn-primary w-full" id="btn-profile">Salvar dados</button>
    </form>

    <section class="card space-y-3 mb-5">
      <h3 class="font-semibold">Minha assinatura</h3>
      <p class="text-sm text-slate-500">Desenhe uma vez. Ela entra automaticamente no campo "Sua assinatura (contratado)" de todos os contratos.</p>
      ${profile.signatureImage ? `
        <div><p class="text-sm text-slate-500 mb-1">Assinatura salva:</p>
          <img src="${profile.signatureImage}" alt="Sua assinatura" class="border rounded-lg bg-white max-h-24" /></div>` : ""}
      <canvas id="sig-pad" class="signature-pad"></canvas>
      <div class="flex gap-2">
        <button type="button" id="sig-clear" class="btn btn-ghost flex-1">Limpar</button>
        <button type="button" id="sig-save" class="btn btn-primary flex-1">${profile.signatureImage ? "Trocar assinatura" : "Salvar assinatura"}</button>
      </div>
    </section>

    <section class="card space-y-3">
      <h3 class="font-semibold">Meu contrato (PDF)</h3>
      ${contract ? `
        <p><strong>${esc(contract.name)}</strong><br>
          <span class="text-sm text-slate-500">${contract.pages.length} página(s) · ${contract.fields.length} campo(s) marcado(s)</span></p>
        ${hasProSignatureField ? "" : `<p class="text-sm text-amber-700">Falta marcar onde entra a sua assinatura (contratado). Toque em "Ajustar campos".</p>`}
        <a href="#/configuracoes/contrato" class="btn btn-ghost w-full">Ajustar campos</a>
        <button type="button" id="btn-upload" class="btn btn-ghost w-full">Enviar outro PDF</button>`
      : `
        <p class="text-sm text-slate-500">Envie o seu contrato padrão em PDF e marque onde entram os dados do cliente e as assinaturas.
          Limite de 600 KB.</p>
        <button type="button" id="btn-upload" class="btn btn-primary w-full">Enviar contrato (PDF)</button>`}
      <input id="pdf-input" type="file" accept="application/pdf,.pdf" class="hidden" />
    </section>`);

  $("#profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#btn-profile");
    btn.disabled = true;
    try {
      const fd = Object.fromEntries(new FormData(e.target));
      await ProfileSkill.save(uid, { name: fd.name, document: fd.document, phone: fd.phone, city: fd.city });
      toast("Dados salvos!");
    } catch (err) {
      console.error(err);
      toast("Não foi possível salvar.");
    }
    btn.disabled = false;
  });

  // --- Assinatura do profissional
  const pad = SignatureSkill.attachPad($("#sig-pad"));
  $("#sig-clear").addEventListener("click", () => pad.clear());
  $("#sig-save").addEventListener("click", async () => {
    if (pad.isEmpty()) return toast("Desenhe sua assinatura no quadro.");
    const btn = $("#sig-save");
    btn.disabled = true;
    try {
      await ProfileSkill.save(uid, { signatureImage: pad.toDataURL(600) });
      toast("Assinatura salva!");
      return settingsView();
    } catch (err) {
      console.error(err);
      toast(err.code === "permission-denied" ? "Sem permissão: publique as regras novas do Firestore." : "Não foi possível salvar.");
      btn.disabled = false;
    }
  });

  // --- Upload do contrato
  const input = $("#pdf-input");
  $("#btn-upload").addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    try {
      const { name, bytes } = await ContractsSkill.readFile(input.files[0]);
      store.set("contractDraft", { name, bytes, fields: [] }); // rascunho em memória até salvar
      router.go("/configuracoes/contrato");
    } catch (err) {
      toast(err.message);
      input.value = "";
    }
  });
}
