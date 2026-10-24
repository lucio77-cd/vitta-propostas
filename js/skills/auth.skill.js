// SKILL: Autenticação — encapsula tudo do Firebase Auth.
import { auth } from "../firebase-config.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const MESSAGES = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Este e-mail já está cadastrado.",
  "auth/weak-password": "A senha precisa ter ao menos 6 caracteres.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/too-many-requests": "Muitas tentativas. Tente novamente em instantes."
};

export const AuthSkill = {
  onChange: (cb) => onAuthStateChanged(auth, cb),
  current: () => auth.currentUser,

  async login(email, password) {
    try {
      return (await signInWithEmailAndPassword(auth, email, password)).user;
    } catch (e) {
      throw new Error(MESSAGES[e.code] || "Não foi possível entrar.");
    }
  },

  async register(email, password) {
    try {
      return (await createUserWithEmailAndPassword(auth, email, password)).user;
    } catch (e) {
      throw new Error(MESSAGES[e.code] || "Não foi possível criar a conta.");
    }
  },

  logout: () => signOut(auth)
};
