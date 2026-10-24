// SKILL: Compartilhamento — links rápidos de WhatsApp e área de transferência.
import { brl } from "../core/ui.js";
import { ProposalsSkill } from "./proposals.skill.js";

export const ShareSkill = {
  message(p) {
    return (
      `Olá, ${p.clientName}! Segue a proposta *${p.title}* no valor de *${brl(p.total)}*.\n\n` +
      `Você pode ler e assinar por aqui:\n${ProposalsSkill.signUrl(p.id)}`
    );
  },

  /** wa.me abre o app no celular (e o WhatsApp Web no desktop). */
  whatsappUrl(p) {
    const phone = p.clientPhone ? (p.clientPhone.startsWith("55") ? p.clientPhone : "55" + p.clientPhone) : "";
    return `https://wa.me/${phone}?text=${encodeURIComponent(this.message(p))}`;
  },

  async copyLink(id) {
    const url = ProposalsSkill.signUrl(id);
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }
};
