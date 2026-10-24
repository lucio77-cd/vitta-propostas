// Inicialização do Firebase (SDK modular v10 via CDN).
// Obs.: as URLs dos imports precisam do caminho completo do SDK em www.gstatic.com,
// senão o navegador não encontra os módulos. A configuração abaixo é a original, sem alterações.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDdUs7GVzLXphr2ztUx_pE2n1UjTkUn_yk",
  authDomain: "vitta-propostas.firebaseapp.com",
  projectId: "vitta-propostas",
  storageBucket: "vitta-propostas.firebasestorage.app",
  messagingSenderId: "548716103065",
  appId: "1:548716103065:web:8650aa31392278acca7f08",
  measurementId: "G-Q3TGWMJ0QE"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, analytics, db, auth };
