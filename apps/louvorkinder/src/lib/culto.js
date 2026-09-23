/**
 * Ordem do culto, feedback e a frase do líder de escala. A Louvor não
 * tem checklist de preparação (isso é da Apoio/Técnica) — o que esta
 * base acrescenta ao culto é o repertório (ver lib/repertorio.js).
 */
import { ref as refStorage, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage, chamar } from "@portal/shared/lib/firebase.js";
import { obterEventosDoMes } from "./painel";

export const definirFrase = (eventoId, frase) =>
  chamar("definirFrase")({ eventoId, frase }).then((r) => r.data);

/** Ênfase, cores da roupa, data do ensaio e observação de um culto —
 *  ver Escala.jsx. Só manda os campos que mudaram (undefined = não
 *  mexer), a Cloud Function grava por cima do que já lá está. */
export const definirDetalhesCultoLouvor = (eventoId, detalhes) =>
  chamar("definirDetalhesCultoLouvor")({ eventoId, ...detalhes }).then((r) => r.data);

export const definirFeedback = (eventoId, texto) =>
  chamar("definirFeedback")({ eventoId, texto }).then((r) => r.data);

/** Notas da base que publica, por cima da ordem do culto — separado
 *  da frase do líder de escala. Só quem tem pode_publicar_culto no
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

/** Pede à Cloud Function para ler o PDF que já está no Storage. */
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

/** Apaga a ordem já publicada e o PDF — volta a "à espera do PDF". */
export const limparOrdemCulto = (eventoId) =>
  chamar("limparOrdemCulto")({ eventoId }).then((r) => r.data);

/** O culto em que a pessoa serve a seguir — este mês ou o próximo. */
export async function obterMeuEvento(uid) {
  const hoje = new Date();
  const hojeISO = hoje.toISOString().slice(0, 10);
  const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);

  const [esteMes, proxMes] = await Promise.all([
    obterEventosDoMes(hoje.getFullYear(), hoje.getMonth()),
    obterEventosDoMes(proximo.getFullYear(), proximo.getMonth()),
  ]);
  const candidatos = [...esteMes, ...proxMes].sort((a, b) => a.data.localeCompare(b.data));

  const meu = candidatos.find((ev) => ev.data >= hojeISO && ev.escala.pessoas.includes(uid));
  return meu ?? candidatos.find((ev) => ev.escala.pessoas.includes(uid)) ?? esteMes[0] ?? null;
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
