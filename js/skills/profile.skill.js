// SKILL: Perfil do profissional — dados usados no contrato e o contrato ativo.
import { db } from "../firebase-config.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const ProfileSkill = {
  async get(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : {};
  },

  /** Grava só os campos informados (merge). */
  async save(uid, data) {
    const clean = {};
    for (const [k, v] of Object.entries(data)) clean[k] = typeof v === "string" ? v.trim() : v;
    await setDoc(doc(db, "users", uid), { ...clean, updatedAt: serverTimestamp() }, { merge: true });
  }
};
