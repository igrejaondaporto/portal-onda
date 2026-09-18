import { chamar } from "@portal/shared/lib/firebase.js";

/** Catálogo global de GDs (ver a nota "GLOBAL" em
 *  apps/pessoal/src/lib/modelo.js), para o ecrã de entrada de quem
 *  não é voluntário saber "onde" colocar a pessoa.
 *
 *  Por `listarGDsMural` (functions/mural.js), não por leitura direta
 *  do Firestore: quem está neste ecrã ainda não tem sessão nenhuma
 *  (só nasce depois de criar o PIN), e `gds/{id}` exige
 *  `autenticado()` nas regras — uma leitura direta aqui vinha sempre
 *  vazia, sem erro visível nenhum (bug real, apanhado 2026-09). */
export async function listarGDs() {
  const { data } = await chamar("listarGDsMural")();
  return data.gds;
}
