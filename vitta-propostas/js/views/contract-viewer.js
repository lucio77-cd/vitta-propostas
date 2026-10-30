// Visualizador do contrato em PDF (todas as páginas empilhadas) + botões de baixar/compartilhar.
import { $, toast } from "../core/ui.js";
import { PdfSkill } from "../skills/pdf.skill.js";
import { ContractPdfSkill } from "../skills/contract-pdf.skill.js";

/** Desenha todas as páginas do PDF dentro de `container`. */
export async function showPdf(container, bytes) {
  const pdf = await PdfSkill.open(bytes);
  container.innerHTML = "";
  const width = Math.min(container.clientWidth || 340, 720);
  for (let n = 1; n <= pdf.numPages; n++) {
    const canvas = document.createElement("canvas");
    canvas.className = "block mx-auto mb-3 bg-white shadow";
    container.appendChild(canvas);
    await PdfSkill.renderPage(pdf, n, canvas, width);
  }
  pdf.destroy?.();
}

export const pdfButtonsHtml = (label = "Baixar PDF") => `
  <div class="grid gap-2 no-print">
    <button type="button" id="btn-pdf" class="btn btn-primary">${label}</button>
    <button type="button" id="btn-share" class="btn btn-whatsapp">Compartilhar PDF (WhatsApp)</button>
  </div>`;

/** Liga os botões #btn-pdf e #btn-share. getBytes() devolve (ou aguarda) os bytes do PDF. */
export function wirePdfActions(getBytes, filename, title) {
  $("#btn-pdf")?.addEventListener("click", async () => {
    try { ContractPdfSkill.download(await getBytes(), filename); }
    catch (e) { toast(e.message || "Não foi possível gerar o PDF."); }
  });
  $("#btn-share")?.addEventListener("click", async () => {
    try {
      const bytes = await getBytes();
      if (!(await ContractPdfSkill.share(bytes, filename, title))) {
        ContractPdfSkill.download(bytes, filename);
        toast("Este navegador não compartilha arquivos; o PDF foi baixado.");
      }
    } catch (e) {
      if (e?.name !== "AbortError") toast(e.message || "Não foi possível compartilhar.");
    }
  });
}
