/**
 * Checklist e atribuições de um culto, e a frase do responsável.
 *
 * Checklist escreve-se direto no Firestore — as regras já só deixam
 * quem está na escala desse culto fazê-lo. Atribuições passam pela
 * Cloud Function atribuirFuncao: é lá que se confirma que quem manda
 * é o responsável DESTE culto (ou o líder da base). A frase mexe
 * no documento do evento, que é global e write:false — por isso passa
 * pela Cloud Function definirFrase.
 */
import { collection, doc, getDocs, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage, chamar } from "@portal/shared/lib/firebase.js";
import { obterEventosDoMes } from "./painel";

export function ouvirChecklist(eventoId, cb) {
  return onSnapshot(collection(db, `eventos/${eventoId}/checklist`), (snap) => {
    const mapa = {};
    snap.forEach((d) => { mapa[d.id] = d.data(); });
    cb(mapa);
  });
}

export function ouvirAtribuicoes(eventoId, cb) {
  return onSnapshot(collection(db, `eventos/${eventoId}/atribuicoes`), (snap) => {
    const mapa = {};
    snap.forEach((d) => { mapa[d.id] = d.data().pessoas || []; });
    cb(mapa);
  });
}

/** Leitura pontual (sem ficar a ouvir) — para sítios como o Perfil,
 *  que só quer contar, não precisa de atualização ao vivo. */
export async function obterAtribuicoes(eventoId) {
  const snap = await getDocs(collection(db, `eventos/${eventoId}/atribuicoes`));
  const mapa = {};
  snap.forEach((d) => { mapa[d.id] = d.data().pessoas || []; });
  return mapa;
}

const horaAgora = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const marcarFeito = (eventoId, funcaoId, uid) =>
  setDoc(doc(db, `eventos/${eventoId}/checklist/${funcaoId}`), { por: uid, hora: horaAgora() });

export const desmarcarFeito = (eventoId, funcaoId) =>
  deleteDoc(doc(db, `eventos/${eventoId}/checklist/${funcaoId}`));

export const definirFrase = (eventoId, frase) =>
  chamar("definirFrase")({ eventoId, frase }).then((r) => r.data);

export const atribuirFuncao = (eventoId, funcaoId, pessoas) =>
  chamar("atribuirFuncao")({ eventoId, funcaoId, pessoas }).then((r) => r.data);

export const definirFeedback = (eventoId, texto) =>
  chamar("definirFeedback")({ eventoId, texto }).then((r) => r.data);

/** Notas da base que publica, por cima da ordem do culto — separado
 *  da frase do responsável. Só quem tem pode_publicar_culto no
 *  token consegue chamar isto (ver functions/index.js). */
export const definirNotasCulto = (eventoId, notas) =>
  chamar("definirNotasCulto")({ eventoId, notas }).then((r) => r.data);

/** null se ainda não houver PDF subido para este culto. */
export async function obterOrdemCulto(eventoId) {
  try {
    return await getDownloadURL(refStorage(storage, `eventos/${eventoId}/ordem.pdf`));
  } catch (e) {
    if (e.code === "storage/object-not-found") return null;
    throw e;
  }
}

export async function enviarOrdemCulto(eventoId, ficheiro) {
  const destino = refStorage(storage, `eventos/${eventoId}/ordem.pdf`);
  await uploadBytes(destino, ficheiro, { contentType: "application/pdf" });
  return getDownloadURL(destino);
}

/** Pede à Cloud Function para ler o PDF que já está no Storage —
 *  nunca lança erro por falha de leitura (o PDF já ficou guardado,
 *  é isso que importa; { falhou: true } é que assinala o resto). */
export const lerOrdemCulto = (eventoId) =>
  chamar("lerOrdemCulto")({ eventoId, caminhoStorage: `eventos/${eventoId}/ordem.pdf` }).then((r) => r.data);

/** Sobe o PDF e já pede a leitura a seguir. */
export async function lerEEnviarOrdemCulto(eventoId, ficheiro) {
  const pdfUrl = await enviarOrdemCulto(eventoId, ficheiro);
  const resultado = await lerOrdemCulto(eventoId);
  return { ...resultado, pdfUrl };
}

/** Só para o PDF ainda não publicado — se a leitura falhou ou o líder
 *  quer recomeçar, tira o ficheiro do Storage sem deixar rasto. */
export const removerOrdemCulto = (eventoId) =>
  deleteObject(refStorage(storage, `eventos/${eventoId}/ordem.pdf`));

/** Só depois disto é que a ordem do culto existe para os voluntários. */
export const publicarOrdemCulto = (dados) =>
  chamar("publicarOrdemCulto")(dados).then((r) => r.data);

/** Apaga a ordem já publicada e o PDF — volta a "à espera do PDF",
 *  como se nada tivesse sido enviado. */
export const limparOrdemCulto = (eventoId) =>
  chamar("limparOrdemCulto")({ eventoId }).then((r) => r.data);

/** O culto em que a pessoa serve a seguir — este mês ou o próximo.
 *  Nunca cai para um culto já passado: se a pessoa serviu no último
 *  domingo mas ainda não está escalada no próximo (a escala do mês
 *  seguinte ainda não saiu), isto tem de devolver o próximo culto
 *  (por escalar) ou `null`, nunca voltar atrás no calendário — foi o
 *  que prendia o Início/Mapa da Camila em "2 de agosto" depois desse
 *  domingo já ter passado, mesmo sem ela estar escalada em nada
 *  futuro. `null` é um estado válido (nenhum culto gerado ainda a
 *  partir de hoje) — quem chama já trata isso como "sem informações
 *  do próximo culto ainda", não como erro. */
export async function obterMeuEvento(uid) {
  const hoje = new Date();
  const hojeISO = hoje.toISOString().slice(0, 10);
  const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);

  const [esteMes, proxMes] = await Promise.all([
    obterEventosDoMes(hoje.getFullYear(), hoje.getMonth()),
    obterEventosDoMes(proximo.getFullYear(), proximo.getMonth()),
  ]);
  const futuros = [...esteMes, ...proxMes]
    .filter((ev) => ev.data >= hojeISO)
    .sort((a, b) => a.data.localeCompare(b.data));

  const meu = futuros.find((ev) => ev.escala.pessoas.includes(uid));
  return meu ?? futuros[0] ?? null;
}

/** O próximo culto, seja quem for que sirva nele — para lembretes do
 *  Painel do líder que não dependem de uma pessoa específica (ex.:
 *  funções por distribuir). Mesma lógica de `obterMeuEvento`, sem a
 *  preferência por um uid. */
export async function obterProximoEvento() {
  const hoje = new Date();
  const hojeISO = hoje.toISOString().slice(0, 10);
  const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);

  const [esteMes, proxMes] = await Promise.all([
    obterEventosDoMes(hoje.getFullYear(), hoje.getMonth()),
    obterEventosDoMes(proximo.getFullYear(), proximo.getMonth()),
  ]);
  const futuros = [...esteMes, ...proxMes]
    .filter((ev) => ev.data >= hojeISO)
    .sort((a, b) => a.data.localeCompare(b.data));

  return futuros[0] ?? null;
}

/** Todos os cultos em que a pessoa serve, este mês e o próximo — para o Perfil. */
export async function obterMeusProximosDomingos(uid) {
  const hoje = new Date();
  const hojeISO = hoje.toISOString().slice(0, 10);
  const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);

  const [esteMes, proxMes] = await Promise.all([
    obterEventosDoMes(hoje.getFullYear(), hoje.getMonth()),
    obterEventosDoMes(proximo.getFullYear(), proximo.getMonth()),
  ]);
  return [...esteMes, ...proxMes]
    .filter((ev) => ev.data >= hojeISO && ev.escala.pessoas.includes(uid))
    .sort((a, b) => a.data.localeCompare(b.data));
}
