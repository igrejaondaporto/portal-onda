/**
 * Tour de primeiro login — conteúdo vem do Firestore, por base
 * (`bases/{baseId}/tour/config`), nunca fixo no componente. O motor
 * (TourContext/Tour) é genérico; só isto aqui sabe onde os dados vivem.
 */
import { doc, getDoc } from "firebase/firestore";
import { db, chamar } from "./firebase";

/** Lido sob demanda (getDoc pontual) — nunca onSnapshot. O conteúdo
 *  muda raramente (escrito por script), por isso a leitura fica em
 *  cache por sessão (por baseId — uma pessoa multi-base pode ver o
 *  tour de mais do que uma base sem misturar): a leitura de verdade
 *  só acontece uma vez, dispare o tour sozinho no primeiro login ou
 *  a pessoa abra "Rever tour" mais tarde, sem esperar outra vez pela
 *  rede. Guarda a própria promessa (não só o resultado), pra dois
 *  pedidos em paralelo (ex.: toques repetidos em "Rever tour" antes
 *  da primeira resposta chegar) partilharem a mesma leitura em vez de
 *  disparar uma nova a cada toque. */
const cacheConfig = new Map();
export function obterConfigTour(baseId) {
  if (!cacheConfig.has(baseId)) {
    cacheConfig.set(
      baseId,
      getDoc(doc(db, `bases/${baseId}/tour/config`)).then((snap) => (snap.exists() ? snap.data() : null))
    );
  }
  return cacheConfig.get(baseId);
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
