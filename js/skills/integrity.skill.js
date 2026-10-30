// SKILL: Integridade — impressão digital (SHA-256) do conteúdo da proposta.
// O hash é gravado no momento da assinatura. Como a proposta assinada fica travada
// pelas regras do Firestore, recalcular o hash depois prova que nada mudou.

export const IntegritySkill = {
  /** Representação canônica: ordem fixa de campos, sempre os mesmos tipos. */
  canonical(p) {
    const base = {
      ownerId: p.ownerId,
      title: p.title,
      clientName: p.clientName,
      clientPhone: p.clientPhone || "",
      description: p.description || "",
      validUntil: p.validUntil || "",
      items: (p.items || []).map((i) => ({ desc: i.desc, qty: Number(i.qty), price: Number(i.price) })),
      total: Number(p.total)
    };
    // Só propostas com contrato incluem estes campos; assim os hashes antigos continuam válidos.
    if (p.contractId) {
      const pr = p.professional || {};
      Object.assign(base, {
        clientDocument: p.clientDocument || "",
        clientAddress: p.clientAddress || "",
        contractId: p.contractId,
        professional: { name: pr.name || "", document: pr.document || "", city: pr.city || "", phone: pr.phone || "" },
        professionalSignature: p.professionalSignature || ""
      });
    }
    return JSON.stringify(base);
  },

  async hash(p) {
    const bytes = new TextEncoder().encode(this.canonical(p));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  },

  /** true = íntegra, false = alterada, null = assinada antes do recurso (sem hash). */
  async verify(p) {
    if (!p.contentHash) return null;
    return (await this.hash(p)) === p.contentHash;
  }
};
