/**
 * Guarda contra a colisão de identidade que já aconteceu uma vez (ver
 * scripts/corrigirColisaoCamila.mjs): dois seeds de bases diferentes
 * escolheram o mesmo id "cru" (`"camila"`) para `pessoas/{id}` — como
 * a identidade/PIN são globais, o segundo `set({...}, {merge:true})`
 * REESCREVEU sozinho o `bases` e o PIN da pessoa real da primeira
 * base, sem erro nenhum a avisar.
 *
 * Todo seed que escreve em `pessoas/{id}` com um id escolhido à mão
 * (não um auto-id do Firestore) tem de passar por aqui primeiro.
 * `scripts/seed.mjs` (Apoio, o seed original) usa ids crus para 17
 * pessoas — "alan", "camila", "joao", "diego", "clara", "robson",
 * "heitor", "duarte", "mariana", "breno", "miqueias", "lucas",
 * "elton", "selinger", "cezar", "vitor", "pessanha" — cada um deles
 * já está reservado; uma base nova com alguém do mesmo primeiro nome
 * tem de usar um id namespaced (`"<nome>-<baseId>"`, ex.:
 * "camila-pessoal"), nunca o nome sozinho.
 */
export async function garantirIdSemColisao(db, id, baseId) {
  const doc = await db.doc(`pessoas/${id}`).get();
  if (!doc.exists) return; // id livre, nada a verificar

  const bases = doc.data().bases || {};
  const deOutraBase = Object.keys(bases).filter((b) => bases[b] && b !== baseId);
  if (deOutraBase.length) {
    throw new Error(
      `pessoas/${id} já existe e serve noutra base (${deOutraBase.join(", ")}) — ` +
      `provavelmente é uma pessoa real diferente, não quem este seed quer criar. ` +
      `Escolhe um id namespaced (ex.: "${id}-${baseId}") em vez de "${id}". ` +
      `Se for mesmo a mesma pessoa a servir em duas bases, usa o fluxo do Painel do líder ` +
      `("Adicionar" → "já é voluntário(a) noutra base?"), nunca um seed.`
    );
  }
}
