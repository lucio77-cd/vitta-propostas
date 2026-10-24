// SKILL: Propostas — regras de negócio + acesso ao Firestore.
import { db } from "../firebase-config.js";
import {
  collection, doc, addDoc, getDoc, getDocs, deleteDoc,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const COL = "proposals";

export const ProposalsSkill = {
  /** Soma qty * price de todos os itens. */
  calcTotal(items = []) {
    return items.reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  },

  /** Valida e normaliza os dados vindos do formulário. */
  sanitize(data) {
    const items = (data.items || [])
      .map((i) => ({ desc: String(i.desc || "").trim(), qty: Number(i.qty) || 1, price: Number(i.price) || 0 }))
      .filter((i) => i.desc);
    if (!data.title?.trim()) throw new Error("Informe o título da proposta.");
    if (!data.clientName?.trim()) throw new Error("Informe o nome do cliente.");
    if (!items.length) throw new Error("Adicione ao menos um item.");
    return {
      title: data.title.trim(),
      clientName: data.clientName.trim(),
      clientPhone: String(data.clientPhone || "").replace(/\D/g, ""),
      description: String(data.description || "").trim(),
      validUntil: data.validUntil || "",
      items,
      total: this.calcTotal(items)
    };
  },

  async create(ownerId, data) {
    const payload = {
      ...this.sanitize(data),
      ownerId,
      status: "pending",
      signature: null,
      createdAt: serverTimestamp()
    };
    const ref = await addDoc(collection(db, COL), payload);
    return ref.id;
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
