// Editor visual: o profissional marca na página do PDF onde cada campo (e a assinatura) entra.
// As posições são guardadas como frações da página, independentes do zoom da tela.
import { render, loading, esc, toast, setHeader, $ } from "../core/ui.js";
import { store } from "../core/store.js";
import { router } from "../core/router.js";
import { PdfSkill } from "../skills/pdf.skill.js";
import { ContractsSkill, FIELD_CATALOG } from "../skills/contracts.skill.js";
import { ProfileSkill } from "../skills/profile.skill.js";

const catalog = Object.fromEntries(FIELD_CATALOG.map((f) => [f.key, f]));
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const r4 = (v) => Math.round(v * 10000) / 10000;

export async function contractEditorView() {
  setHeader({ visible: true, actionsHtml: `<a href="#/configuracoes" class="underline">Voltar</a>` });
  loading();
  const uid = store.get("user").uid;

  // Origem: PDF recém-enviado (rascunho) ou o contrato ativo.
  let source = store.get("contractDraft");
  try {
    if (!source) {
      const profile = await ProfileSkill.get(uid);
      if (profile.activeContractId) {
        const c = await ContractsSkill.get(profile.activeContractId);
        if (c) source = { name: c.name, bytes: PdfSkill.fromBase64(c.pdf), fields: c.fields || [] };
      }
    }
  } catch (e) {
    console.error(e);
  }
  if (!source) {
    toast("Envie um PDF primeiro.");
    return router.go("/configuracoes");
  }

  let pdf, sizes;
  try {
    pdf = await PdfSkill.open(source.bytes);
    sizes = await PdfSkill.pageSizes(pdf);
  } catch (e) {
    console.error(e);
    store.set("contractDraft", null);
    toast(e.message || "Não foi possível abrir este PDF.");
    return router.go("/configuracoes");
  }

  const fields = source.fields.map((f) => ({ ...f }));
  let pageNo = 1;
  let armed = null;     // campo escolhido na paleta, aguardando o toque na página
  let selected = null;  // campo selecionado (key)
  let renderToken = 0;

  render(`
    <h2 class="text-xl font-bold mb-1">Marcar campos do contrato</h2>
    <p class="text-sm text-slate-500 mb-3">Toque num campo abaixo e depois no ponto da página onde ele deve entrar.
      Arraste a caixa para mover e use o canto inferior direito para ajustar o tamanho.</p>
    <div id="palette" class="flex flex-wrap gap-2 mb-2"></div>
    <p id="hint" class="text-sm text-brand-700 min-h-[1.25rem] mb-2"></p>
    <div class="flex items-center justify-between mb-2">
      <button id="prev" class="btn btn-ghost !min-h-0 !py-2 !px-4" aria-label="Página anterior">‹</button>
      <span id="pageinfo" class="text-sm font-medium"></span>
      <button id="next" class="btn btn-ghost !min-h-0 !py-2 !px-4" aria-label="Próxima página">›</button>
    </div>
    <div id="stage" class="stage"><canvas id="pdfcanvas"></canvas><div id="overlay" class="overlay"></div></div>
    <div id="toolbar" class="card mt-3 hidden"></div>
    <button id="btn-save" class="btn btn-primary w-full mt-4">Salvar contrato</button>`);

  const stage = $("#stage");
  const overlay = $("#overlay");
  const canvas = $("#pdfcanvas");

  const isPlaced = (key) => fields.some((f) => f.key === key);

  function renderPalette() {
    $("#palette").innerHTML = FIELD_CATALOG.map((c) => `
      <button type="button" data-key="${c.key}"
        class="chip ${armed === c.key ? "chip-armed" : ""} ${isPlaced(c.key) ? "chip-done" : ""}">
        ${isPlaced(c.key) ? "✓ " : ""}${esc(c.label)}</button>`).join("");
    $("#hint").textContent = armed ? `Toque na página para posicionar: ${catalog[armed].label}` : "";
  }

  function renderToolbar() {
    const tb = $("#toolbar");
    const f = fields.find((x) => x.key === selected);
    if (!f) return tb.classList.add("hidden");
    const c = catalog[f.key];
    tb.classList.remove("hidden");
    tb.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div><strong>${esc(c.label)}</strong> <span class="text-sm text-slate-500">· página ${f.page}</span></div>
        <div class="flex items-center gap-2">
          ${c.type === "signature" ? "" : `
            <button type="button" data-act="smaller" class="btn btn-ghost !min-h-0 !py-1 !px-3" aria-label="Diminuir letra">A−</button>
            <span class="text-sm w-12 text-center">${f.size} pt</span>
            <button type="button" data-act="bigger" class="btn btn-ghost !min-h-0 !py-1 !px-3" aria-label="Aumentar letra">A+</button>`}
          <button type="button" data-act="remove" class="btn !min-h-0 !py-1 !px-3 text-red-600">Remover</button>
        </div>
      </div>`;
  }

  function renderOverlay() {
    overlay.innerHTML = fields.filter((f) => f.page === pageNo).map((f) => {
      const c = catalog[f.key];
      return `<div class="field-box ${c.type === "signature" ? "is-signature" : ""} ${selected === f.key ? "is-selected" : ""}"
        data-key="${f.key}" style="left:${f.x * 100}%;top:${f.y * 100}%;width:${f.w * 100}%;height:${f.h * 100}%">
        <span>${esc(c.label)}</span><i class="field-handle" data-handle></i></div>`;
    }).join("");
  }

  async function renderPage() {
    const token = ++renderToken;
    const width = Math.min($("#app").clientWidth, 720);
    stage.style.width = `${width}px`;
    $("#pageinfo").textContent = `Página ${pageNo} de ${sizes.length}`;
    $("#prev").disabled = pageNo <= 1;
    $("#next").disabled = pageNo >= sizes.length;
    try {
      const { height } = await PdfSkill.renderPage(pdf, pageNo, canvas, width);
      if (token !== renderToken) return;
      stage.style.height = `${height}px`;
    } catch (e) {
      console.error(e);
      toast("Erro ao desenhar a página.");
    }
    renderOverlay();
  }

  function select(key) {
    selected = key;
    overlay.querySelectorAll(".field-box").forEach((b) => b.classList.toggle("is-selected", b.dataset.key === key));
    renderToolbar();
  }

  // --- Paleta
  $("#palette").addEventListener("click", (e) => {
    const key = e.target.closest("[data-key]")?.dataset.key;
    if (!key) return;
    const placed = fields.find((f) => f.key === key);
    if (placed) {               // já marcado: vai até ele
      armed = null;
      if (placed.page !== pageNo) { pageNo = placed.page; renderPage().then(() => select(key)); }
      else select(key);
    } else {
      armed = armed === key ? null : key;
    }
    renderPalette();
  });

  // --- Navegação de páginas
  $("#prev").addEventListener("click", () => { pageNo--; select(null); renderPage(); });
  $("#next").addEventListener("click", () => { pageNo++; select(null); renderPage(); });

  // --- Toque na página: posiciona o campo escolhido
  stage.addEventListener("click", (e) => {
    if (e.target.closest(".field-box")) return;
    if (!armed) return select(null);
    const rect = stage.getBoundingClientRect();
    const def = catalog[armed];
    fields.push({
      key: armed,
      page: pageNo,
      x: r4(clamp((e.clientX - rect.left) / rect.width - def.w / 2, 0, 1 - def.w)),
      y: r4(clamp((e.clientY - rect.top) / rect.height - def.h / 2, 0, 1 - def.h)),
      w: def.w,
      h: def.h,
      size: 10
    });
    const key = armed;
    armed = null;
    renderOverlay();
    renderPalette();
    select(key);
  });

  // --- Arrastar e redimensionar
  overlay.addEventListener("pointerdown", (e) => {
    const box = e.target.closest(".field-box");
    if (!box) return;
    e.preventDefault();
    const f = fields.find((x) => x.key === box.dataset.key);
    select(f.key);

    const rect = stage.getBoundingClientRect();
    const resize = e.target.matches("[data-handle]");
    // Origem do gesto: ponteiro em px e caixa em frações da página (nomes separados,
    // senão a posição da caixa sobrescreve a do ponteiro e o arraste "pula").
    const start = { px: e.clientX, py: e.clientY, x0: f.x, y0: f.y, w0: f.w, h0: f.h };
    box.setPointerCapture(e.pointerId);

    const move = (ev) => {
      const dx = (ev.clientX - start.px) / rect.width;
      const dy = (ev.clientY - start.py) / rect.height;
      if (resize) {
        f.w = r4(clamp(start.w0 + dx, 0.03, 1 - f.x));
        f.h = r4(clamp(start.h0 + dy, 0.012, 1 - f.y));
        box.style.width = `${f.w * 100}%`;
        box.style.height = `${f.h * 100}%`;
      } else {
        f.x = r4(clamp(start.x0 + dx, 0, 1 - f.w));
        f.y = r4(clamp(start.y0 + dy, 0, 1 - f.h));
        box.style.left = `${f.x * 100}%`;
        box.style.top = `${f.y * 100}%`;
      }
    };
    const end = () => {
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerup", end);
      box.removeEventListener("pointercancel", end);
    };
    box.addEventListener("pointermove", move);
    box.addEventListener("pointerup", end);
    box.addEventListener("pointercancel", end);
  });

  // --- Barra do campo selecionado
  $("#toolbar").addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    const i = fields.findIndex((f) => f.key === selected);
    if (!act || i < 0) return;
    if (act === "remove") {
      fields.splice(i, 1);
      select(null);
      renderOverlay();
      renderPalette();
    } else {
      fields[i].size = clamp(fields[i].size + (act === "bigger" ? 1 : -1), 6, 20);
      renderToolbar();
    }
  });

  // --- Salvar
  $("#btn-save").addEventListener("click", async () => {
    if (!isPlaced("assinatura_cliente")) return toast("Marque onde vai a assinatura do cliente.");
    const btn = $("#btn-save");
    btn.disabled = true;
    try {
      const id = await ContractsSkill.create(uid, { name: source.name, bytes: source.bytes, pages: sizes, fields });
      await ProfileSkill.save(uid, { activeContractId: id });
      store.set("contractDraft", null);
      toast("Contrato salvo!");
      router.go("/configuracoes");
    } catch (err) {
      console.error(err);
      toast(err.code === "permission-denied" ? "Sem permissão: publique as regras novas do Firestore." : "Não foi possível salvar.");
      btn.disabled = false;
    }
  });

  // Redesenha ao girar a tela ou redimensionar a janela.
  let timer;
  const onResize = () => { clearTimeout(timer); timer = setTimeout(renderPage, 200); };
  window.addEventListener("resize", onResize);

  renderPalette();
  await renderPage();

  return () => {
    window.removeEventListener("resize", onResize);
    pdf.destroy?.();
  };
}
