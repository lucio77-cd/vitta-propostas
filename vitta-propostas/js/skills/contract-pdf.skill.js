// SKILL: Contrato em PDF — escreve os dados da proposta e as assinaturas por cima do PDF do profissional.
// O PDF final nunca é guardado: ele é regenerado (sempre igual) a partir do modelo imutável
// (coleção "contracts") + os dados travados da proposta assinada.
import { loadScript } from "../core/ui.js";
import { PdfSkill } from "./pdf.skill.js";

const PDFLIB_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
const MIN_SIZE = 6;
const INK = [0.06, 0.09, 0.16];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

async function getLib() {
  if (!globalThis.PDFLib) await loadScript(PDFLIB_URL);
  if (!globalThis.PDFLib) throw new Error("Não foi possível carregar o gerador de PDF.");
  return globalThis.PDFLib;
}

// ---------- formatação ----------
const toDate = (ts) => (!ts ? null : ts.toDate ? ts.toDate() : new Date(ts));
const two = (n) => String(n).padStart(2, "0");
const shortDate = (d) => `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
const longDate = (d) => `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
const dateTime = (d) => `${shortDate(d)} ${two(d.getHours())}:${two(d.getMinutes())}`;
const money = (n) => Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtPhone(v) {
  const d = String(v || "").replace(/\D/g, "");
  const n = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return d;
}

const dataUrlToBytes = (url) => Uint8Array.from(atob(String(url).split(",")[1] || ""), (c) => c.charCodeAt(0));

// ---------- texto ----------
/** Troca por "?" os caracteres que a fonte padrão do PDF não consegue desenhar (ex.: emojis). */
function safe(font, text) {
  let out = "";
  for (const ch of String(text ?? "").replace(/\r/g, "").replace(/\t/g, " ")) {
    if (ch === "\n") { out += ch; continue; }
    try { font.encodeText(ch); out += ch; } catch { out += "?"; }
  }
  return out;
}

function wrap(font, text, size, maxW) {
  const lines = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const cand = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(cand, size) <= maxW) { line = cand; continue; }
      if (line) lines.push(line);
      line = word;
      while (font.widthOfTextAtSize(line, size) > maxW && line.length > 1) { // palavra maior que a caixa
        let n = line.length - 1;
        while (n > 1 && font.widthOfTextAtSize(line.slice(0, n), size) > maxW) n--;
        lines.push(line.slice(0, n));
        line = line.slice(n);
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Escolhe tamanho de letra e quebra de linhas para o texto caber na caixa. */
function fit(font, text, boxW, boxH, maxSize) {
  const tall = boxH >= maxSize * 2.4; // caixa alta (ex.: descrição): quebra linhas em vez de encolher a letra
  if (!text.includes("\n") && !tall) {
    for (let s = maxSize; s >= 8; s -= 0.5) {
      if (font.widthOfTextAtSize(text, s) <= boxW) return { size: s, lines: [text], overflow: false };
    }
  }
  for (let s = maxSize; s >= MIN_SIZE; s -= 0.5) {
    const lines = wrap(font, text, s, boxW);
    if (lines.length * s * 1.2 <= boxH + 0.5) return { size: s, lines, overflow: false };
  }
  const s = MIN_SIZE;
  const max = Math.max(1, Math.floor(boxH / (s * 1.2)));
  const cut = wrap(font, text, s, boxW).slice(0, max);
  let last = cut[cut.length - 1];
  while (last.length > 1 && font.widthOfTextAtSize(`${last}...`, s) > boxW) last = last.slice(0, -1);
  cut[cut.length - 1] = `${last}...`;
  return { size: s, lines: cut, overflow: true };
}

// ---------- dados da proposta -> campos do contrato ----------
export function valuesFor(p) {
  const prof = p.professional || {};
  const signedAt = toDate(p.signedAt);
  const items = (p.items || []).map((i) => `${i.desc} (${i.qty} x ${money(i.price)})`).join("; ");
  return {
    cliente_nome: p.clientName,
    cliente_documento: p.clientDocument,
    cliente_telefone: fmtPhone(p.clientPhone),
    cliente_endereco: p.clientAddress,
    profissional_nome: prof.name,
    profissional_documento: prof.document,
    profissional_cidade: prof.city,
    servico: p.title,
    descricao: p.description || items,
    valor_total: money(p.total), // só o número: o "R$" costuma já estar impresso no contrato
    validade: p.validUntil ? p.validUntil.split("-").reverse().join("/") : "",
    foro_cidade: prof.city,
    local_data: signedAt ? [prof.city, longDate(signedAt)].filter(Boolean).join(", ") : ""
  };
}

export const ContractPdfSkill = {
  valuesFor,

  /**
   * Monta o PDF. template: bytes do modelo; fields: posições (frações da página, origem no topo);
   * values: texto por campo; signatures: { chave_do_campo: dataURL PNG }; stamp: linha de rodapé.
   */
  async build({ template, fields, values, signatures = {}, stamp = "" }) {
    const { PDFDocument, StandardFonts, rgb } = await getLib();
    const doc = await PDFDocument.load(template, { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const ink = rgb(...INK);
    const images = new Map();
    const warnings = [];

    for (const f of fields) {
      const page = pages[f.page - 1];
      if (!page) continue;
      const { width: PW, height: PH } = page.getSize();
      const bx = f.x * PW;
      const bw = f.w * PW;
      const bh = f.h * PH;
      const bottom = PH - f.y * PH - bh;

      if (f.key.startsWith("assinatura_")) {
        const url = signatures[f.key];
        if (!url) continue;
        if (!images.has(f.key)) images.set(f.key, await doc.embedPng(dataUrlToBytes(url)));
        const img = images.get(f.key);
        const k = Math.min(bw / img.width, bh / img.height);
        const w = img.width * k;
        const h = img.height * k;
        page.drawImage(img, { x: bx + (bw - w) / 2, y: bottom + (bh - h) / 2, width: w, height: h });
        continue;
      }

      const text = safe(font, String(values[f.key] ?? "").trim());
      if (!text) continue;
      const { size, lines, overflow } = fit(font, text, bw - 2, bh, f.size || 10);
      const baseline = lines.length === 1 ? bottom + (bh - size) / 2 + size * 0.22 : PH - f.y * PH - size;
      lines.forEach((ln, i) => page.drawText(ln, { x: bx + 1, y: baseline - i * size * 1.2, size, font, color: ink }));
      if (overflow) warnings.push(`O campo "${f.key}" não coube na caixa marcada e foi cortado. Aumente a caixa no editor.`);
    }

    if (stamp) {
      const last = pages[pages.length - 1];
      const lines = wrap(font, safe(font, stamp), 6.5, last.getWidth() - 80);
      lines.forEach((ln, i) =>
        last.drawText(ln, { x: 40, y: 8 + (lines.length - 1 - i) * 8, size: 6.5, font, color: rgb(0.35, 0.4, 0.45) }));
    }

    return { bytes: await doc.save(), warnings };
  },

  /** Gera o PDF de uma proposta: sem a assinatura do cliente (prévia) ou completo (assinada). */
  async forProposal(p) {
    const { ContractsSkill } = await import("./contracts.skill.js");
    const c = await ContractsSkill.get(p.contractId);
    if (!c) throw new Error("Modelo de contrato não encontrado.");

    const signed = p.status === "signed" && p.signature;
    const signedAt = toDate(p.signedAt);
    const signatures = { assinatura_profissional: p.professionalSignature };
    let stamp = "";
    if (signed) {
      signatures.assinatura_cliente = p.signature.image;
      stamp = `Assinado eletronicamente por ${p.signature.name}`
        + (p.signature.document ? ` (${p.signature.document})` : "")
        + (signedAt ? ` em ${dateTime(signedAt)}` : "")
        + (p.contentHash ? ` | SHA-256: ${p.contentHash}` : "");
    }
    return this.build({ template: PdfSkill.fromBase64(c.pdf), fields: c.fields || [], values: valuesFor(p), signatures, stamp });
  },

  fileName(p) {
    const slug = String(p.clientName || "cliente").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    return `contrato-${slug || "cliente"}.pdf`;
  },

  download(bytes, filename) {
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  },

  /** Abre o menu de compartilhar do celular (WhatsApp etc.) com o arquivo. false = não suportado. */
  async share(bytes, filename, title) {
    const file = new File([bytes], filename, { type: "application/pdf" });
    if (!navigator.canShare?.({ files: [file] })) return false;
    await navigator.share({ files: [file], title });
    return true;
  }
};
