/**
 * O estado de um equipamento é uma consequência, não um campo.
 *
 * Não há tela em lado nenhum que ponha um equipamento avariado ou
 * reparado à mão: quem o marca é a abertura de uma avaria, e quem o
 * desmarca é o desaparecimento dela (resolvida ou excluída). Esta é
 * a regra que decide, e vive à parte do `index.js` de propósito —
 * sem `firebase-admin` pelo meio dá para a correr com um `node` e
 * dados inventados, que é a única verificação possível antes do
 * deploy: as Cloud Functions não têm emulador neste repositório e o
 * `npm run smoke` só chama a `dadosEntrada`.
 *
 * @param melhorias  as melhorias ATIVAS ligadas àquele equipamento
 *                   (`{ id, estado, marcaAvaria }`)
 * @param ignorarId  a melhoria que está a sair agora — a leitura no
 *                   Firestore ainda a traz, porque o lote só commita
 *                   a seguir
 * @returns true se o equipamento deve continuar `avariado`
 */
export function equipamentoEmBaixo(melhorias, ignorarId = null) {
  return (melhorias || []).some((m) =>
    m.id !== ignorarId
    // uma melhoria resolvida já não segura ninguém em baixo
    && m.estado !== "resolvida"
    // "comprar cabos XLR para testar" é trabalho a fazer, não uma
    // avaria: fica ligada ao equipamento sem o pôr fora de serviço.
    // `!== false` e não `=== true` porque os documentos criados antes
    // deste campo existir não o têm, e nesses o comportamento antigo
    // (ligada a equipamento = avaria) é o correto a assumir.
    && m.marcaAvaria !== false);
}
