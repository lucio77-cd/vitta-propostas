// SKILL: Propostas — regras de negócio + acesso ao Firestore.
import { db } from "../firebase-config.js";
import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const COL = "proposals";

export const ProposalsSkill = {
  /** Soma qty * price de todos os itens. */
  calcTotal(items = []) {
    return items.reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  },

  /**
   * Valida e normaliza os dados vindos do formulário.
   * data.contract (opcional) = { id, professional: {name, document, city, phone}, signature }:
   * é o "retrato" do contrato e dos seus dados no momento em que a proposta é salva.
   */
  sanitize(data) {
    const items = (data.items || [])
      .map((i) => ({ desc: String(i.desc || "").trim(), qty: Number(i.qty) || 1, price: Number(i.price) || 0 }))
      .filter((i) => i.desc);
    if (!data.title?.trim()) throw new Error("Informe o título da proposta.");
    if (!data.clientName?.trim()) throw new Error("Informe o nome do cliente.");
    if (!items.length) throw new Error("Adicione ao menos um item.");

    const contract = data.contract || null;
    const clientDocument = String(data.clientDocument || "").trim().slice(0, 30);
    if (contract) {
      if (!clientDocument) throw new Error("Informe o CPF/CNPJ do cliente para preencher o contrato.");
      if (!contract.id || !contract.professional?.name?.trim()) throw new Error("Preencha seu nome em Configurações para usar o contrato.");
      if (!contract.signature) throw new Error("Cadastre sua assinatura em Configurações para usar o contrato.");
    }
    const pr = contract?.professional || {};

    return {
      title: data.title.trim(),
      clientName: data.clientName.trim(),
      clientPhone: String(data.clientPhone || "").replace(/\D/g, ""),
      clientDocument,
      clientAddress: String(data.clientAddress || "").trim().slice(0, 200),
      description: String(data.description || "").trim(),
      validUntil: data.validUntil || "",
      items,
      total: this.calcTotal(items),
      contractId: contract ? contract.id : null,
      professional: contract
        ? {
            name: String(pr.name || "").trim().slice(0, 120),
            document: String(pr.document || "").trim().slice(0, 30),
            city: String(pr.city || "").trim().slice(0, 80),
            phone: String(pr.phone || "").trim().slice(0, 30)
          }
        : null,
      professionalSignature: contract ? contract.signature : null
    };
  },

  async create(ownerId, data) {
    const payload = {
      ...this.sanitize(data),
      ownerId,
      status: "pending",
      signature: null,
      signedAt: null,
      createdAt: serverTimestamp()
    };
    const ref = await addDoc(collection(db, COL), payload);
    return ref.id;
  },

  /** Edita uma proposta pendente. As regras do Firestore bloqueiam proposta já assinada. */
  async update(id, data) {
    await updateDoc(doc(db, COL, id), this.sanitize(data));
  },

  async get(id) {
    const snap = await getDoc(doc(db, COL, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async listByOwner(ownerId) {
    const q = query(collection(db, COL), where("ownerId", "==", ownerId), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  remove: (id) => deleteDoc(doc(db, COL, id)),

  /** Link público que o cliente abre para visualizar e assinar. */
  signUrl: (id) => `${location.origin}${location.pathname}#/assinar/${id}`
};
