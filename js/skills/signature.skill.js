// SKILL: Assinatura eletrônica — canvas de desenho + gravação da assinatura.
import { db } from "../firebase-config.js";
import {
  doc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const SignatureSkill = {
  /** Liga um <canvas> a mouse/toque e devolve controles do pad. */
  attachPad(canvas) {
    const ctx = canvas.getContext("2d");
    let drawing = false;
    let dirty = false;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0f172a";
    };
    resize();

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    canvas.addEventListener("pointerdown", (e) => {
      drawing = true;
      canvas.setPointerCapture(e.pointerId);
      const { x, y } = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!drawing) return;
      const { x, y } = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      dirty = true;
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) =>
      canvas.addEventListener(ev, () => (drawing = false))
    );

    return {
      clear() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        dirty = false;
      },
      isEmpty: () => !dirty,
      /** PNG com fundo transparente, reduzido para no máximo maxW px de largura (arquivo leve). */
      toDataURL(maxW = 900) {
        if (canvas.width <= maxW) return canvas.toDataURL("image/png");
        const small = document.createElement("canvas");
        small.width = maxW;
        small.height = Math.round(canvas.height * (maxW / canvas.width));
        small.getContext("2d").drawImage(canvas, 0, 0, small.width, small.height);
        return small.toDataURL("image/png");
      }
    };
  },

  /** Grava a assinatura na proposta e marca como assinada. */
  async sign(proposalId, { name, document, imageDataUrl, contentHash }) {
    if (!name?.trim()) throw new Error("Digite seu nome completo.");
    if (!/^[a-f0-9]{64}$/.test(contentHash || "")) throw new Error("Não foi possível validar o documento.");
    if (!imageDataUrl) throw new Error("Faça sua assinatura no quadro.");
    await updateDoc(doc(db, "proposals", proposalId), {
      status: "signed",
      signedAt: serverTimestamp(), // deve ser exatamente request.time (validado nas regras)
      contentHash,                 // SHA-256 do conteúdo que o cliente viu e assinou
      signature: {
        name: name.trim(),
        document: String(document || "").trim().slice(0, 30),
        image: imageDataUrl,
        userAgent: navigator.userAgent.slice(0, 500)
      }
    });
  }
};
