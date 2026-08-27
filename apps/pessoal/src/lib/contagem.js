import { onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { cContagem } from "./modelo";

/**
 * As categorias não formam um total. Cada uma é guardada separadamente
 * para preservar o significado que já tem no relatório do culto.
 * As quatro últimas terão origem "automatica" quando os painéis das
 * salas existirem; até lá são preenchidas manualmente.
 */
export const CATEGORIAS_CONTAGEM = [
  { id: "membros", nome: "Membros", grupo: "Auditório", descricao: "Pessoas da igreja presentes" },
  { id: "visitantes", nome: "Visitantes", grupo: "Auditório", descricao: "Quem visita pela primeira vez" },
  { id: "voluntarios", nome: "Voluntários", grupo: "Auditório", descricao: "Equipa a servir neste culto" },
  { id: "mensagem", nome: "Mensagem", grupo: "Resposta", descricao: "Pessoas que estavam presentes durante a mensagem" },
  { id: "apelo", nome: "Apelo", grupo: "Resposta", descricao: "Pessoas que responderam ao apelo" },
  { id: "new", nome: "New", grupo: "Salas", descricao: "Registo manual até existir painel próprio" },
  { id: "shift", nome: "Shift", grupo: "Salas", descricao: "Registo manual até existir painel próprio" },
  { id: "juniorFun", nome: "Junior Fun", grupo: "Salas", descricao: "Registo manual até existir painel próprio" },
  { id: "baby", nome: "Baby", grupo: "Salas", descricao: "Registo manual até existir painel próprio" },
];

/** Documento único por culto, ouvido ao vivo como o mapa de Acomodação. */
export function ouvirContagem(eventoId, cb) {
  if (!eventoId) return () => {};
  return onSnapshot(cContagem(eventoId), (snap) => cb(snap.exists() ? snap.data() : null));
}

/** Campo vazio é válido; os restantes valores têm de ser inteiros positivos ou zero. */
export function normalizarValorContagem(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const numero = Number(texto);
  if (!Number.isInteger(numero) || numero < 0) {
    throw new Error("Introduz um número inteiro igual ou superior a zero.");
  }
  return numero;
}

/**
 * Atualiza só uma categoria, mantendo os restantes campos do documento.
 * O setDoc com merge permite criar a contagem no primeiro toque e continua
 * a funcionar com a escrita offline do Firestore.
 */
export async function guardarCategoriaContagem(eventoId, categoriaId, valor, uid) {
  const valorNormalizado = normalizarValorContagem(valor);
  await setDoc(cContagem(eventoId), {
    eventoId,
    categorias: {
      [categoriaId]: {
        valor: valorNormalizado,
        origem: "manual",
        preenchidoPor: uid,
        preenchidoEm: serverTimestamp(),
      },
    },
    atualizadoEm: serverTimestamp(),
  }, { merge: true });
}

/**
 * Repõe as nove categorias a "por contar" — para recomeçar a
 * contagem de um culto. As regras não deixam apagar o documento
 * (histórico do culto), por isso volta cada campo a `valor: null`
 * em vez de um `delete`.
 */
export async function limparContagem(eventoId) {
  const categorias = Object.fromEntries(CATEGORIAS_CONTAGEM.map((c) => [
    c.id,
    { valor: null, origem: "manual", preenchidoPor: null, preenchidoEm: null },
  ]));
  await setDoc(cContagem(eventoId), { eventoId, categorias, atualizadoEm: serverTimestamp() }, { merge: true });
}
