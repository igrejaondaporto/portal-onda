/**
 * Tour de primeiro login — conteúdo vem do Firestore, por base
 * (`bases/{baseId}/tour/config`), nunca fixo no componente. O motor
 * (TourContext/Tour) é genérico; só isto aqui sabe onde os dados vivem.
 */
import { doc, getDoc } from "firebase/firestore";
import { db, chamar } from "./firebase";

/** Lido sob demanda (getDoc pontual) — nunca onSnapshot. O conteúdo
 *  muda raramente (escrito por script) e só é preciso no arranque da
 *  sessão ou em "Rever tour"; não vale a pena um listener ao vivo. */
export async function obterConfigTour(baseId) {
  const snap = await getDoc(doc(db, `bases/${baseId}/tour/config`));
  return snap.exists() ? snap.data() : null;
}

/** Junta os passos do voluntário com os extra do líder — o config só
 *  guarda o delta do líder, nunca duplica os passos comuns. */
export function composicaoPassos(config, papel) {
  if (!config) return [];
  const passos = config.passos || [];
  if (papel !== "lider_base") return passos;
  return [...passos, ...(config.passosLider || [])];
}

/** pessoas/{uid} é global e a própria pessoa pode lê-lo (regras:
 *  allow read: if euSou(pessoa)) — não precisa de Cloud Function. */
export async function precisaTour(uid, baseId) {
  const snap = await getDoc(doc(db, `pessoas/${uid}`));
  const tourVisto = snap.exists() ? snap.data().tourVisto : null;
  return !tourVisto?.[baseId];
}

/** Escrita passa sempre por Cloud Function — pessoas/{uid} tem
 *  write:false nas regras. Chamada ao concluir OU ao pular; o cliente
 *  fecha o tour de forma otimista, sem esperar a resposta (se falhar,
 *  pior caso é o tour reaparecer no próximo login — não é dado crítico). */
export const marcarTourVisto = () => chamar("marcarTourVisto")({}).then((r) => r.data);
