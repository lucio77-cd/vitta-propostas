// SKILL: Contratos — modelo de contrato em PDF do profissional + posição dos campos.
// Cada salvamento cria uma NOVA versão imutável (coleção "contracts"). As propostas
// apontam para uma versão, então trocar o contrato depois não altera o que já foi assinado.
import { db } from "../firebase-config.js";
import {
  collection, doc, addDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { PdfSkill } from "./pdf.skill.js";

// Limite do PDF: em base64 ele ocupa ~33% a mais e o documento do Firestore tem 1 MiB.
export const MAX_PDF_BYTES = 600 * 1024;

// Campos que o sistema sabe preencher. x, y, w, h são frações da página (0 a 1),
// com origem no canto superior esquerdo; "size" é o tamanho máximo da letra em pt.
export const FIELD_CATALOG = [
  { key: "cliente_nome",           label: "Nome do cliente",              w: 0.42, h: 0.022 },
  { key: "cliente_documento",      label: "CPF/CNPJ do cliente",          w: 0.22, h: 0.022 },
  { key: "cliente_telefone",       label: "Telefone do cliente",          w: 0.22, h: 0.022 },
  { key: "cliente_endereco",       label: "Endereço do cliente",          w: 0.45, h: 0.022 },
  { key: "profissional_nome",      label: "Seu nome / empresa",           w: 0.42, h: 0.022 },
  { key: "profissional_documento", label: "Seu CPF/CNPJ",                 w: 0.22, h: 0.022 },
  { key: "profissional_cidade",    label: "Sua cidade/UF",                w: 0.22, h: 0.022 },
  { key: "servico",                label: "Serviço (título da proposta)", w: 0.42, h: 0.022 },
  { key: "descricao",              label: "Descrição / escopo",           w: 0.60, h: 0.05 },
  { key: "valor_total",            label: "Valor total (só o número)",    w: 0.22, h: 0.022 },
  { key: "validade",               label: "Validade da proposta",         w: 0.22, h: 0.022 },
  { key: "foro_cidade",            label: "Comarca (foro)",               w: 0.30, h: 0.022 },
  { key: "local_data",             label: "Local e data",                 w: 0.40, h: 0.022 },
  { key: "assinatura_cliente",     label: "Assinatura do cliente",        w: 0.34, h: 0.07, type: "signature" },
  { key: "assinatura_profissional", label: "Sua assinatura (contratado)", w: 0.34, h: 0.07, type: "signature" }
];

export const ContractsSkill = {
  /** Valida e lê o arquivo escolhido. */
  async readFile(file) {
    if (!file) throw new Error("Nenhum arquivo selecionado.");
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      throw new Error("Envie um arquivo PDF.");
    }
    if (file.size > MAX_PDF_BYTES) {
      throw new Error(
        `O PDF tem ${Math.round(file.size / 1024)} KB e o limite é ${MAX_PDF_BYTES / 1024} KB. Comprima o arquivo e tente de novo.`
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const header = String.fromCharCode(...bytes.subarray(0, 5));
    if (header !== "%PDF-") throw new Error("Este arquivo não parece ser um PDF válido.");
    return { name: file.name.replace(/\.pdf$/i, "").slice(0, 120), bytes };
  },

  /** Cria uma nova versão do contrato e devolve o ID. */
  async create(ownerId, { name, bytes, pages, fields }) {
    const ref = await addDoc(collection(db, "contracts"), {
      ownerId,
      name,
      pdf: PdfSkill.toBase64(bytes),
      pages,
      fields,
      createdAt: serverTimestamp()
    });
    return ref.id;
  },

  async get(id) {
    const snap = await getDoc(doc(db, "contracts", id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }
};
