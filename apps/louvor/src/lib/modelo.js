/**
 * Caminhos do Firestore, num sítio só.
 *
 *   bases/{base}
 *   bases/{base}/pessoas/{pessoa}
 *   bases/{base}/pessoas/{pessoa}/privado/auth      ← hash do PIN, ilegível
 *   bases/{base}/inventario/{item}                   ← equipamento, modo património
 *   bases/{base}/melhorias/{id}                      ← avarias/melhorias do equipamento
 *   bases/{base}/reembolsos/{r}
 *   bases/{base}/musicas/{musicaId}                  ← biblioteca (ver lib/biblioteca.js)
 *   bases/{base}/musicas/{musicaId}/versoes/{versaoId}
 *   bases/{base}/repertorios/{repertorioId}          ← ver lib/repertorio.js
 *   eventos/{AAAA-MM-DD}                             ← global, a igreja toda
 *   eventos/{e}/escalas/{base}                       ← pessoas[] + liderEscala + escalados[]
 */
import { collection, doc } from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

export const cBase          = () => doc(db, "bases", BASE_ID);
export const cPessoas       = () => collection(db, `bases/${BASE_ID}/pessoas`);
export const cInventario    = () => collection(db, `bases/${BASE_ID}/inventario`); // equipamentos, modo património
export const cMelhorias     = () => collection(db, `bases/${BASE_ID}/melhorias`);
export const cEventosMelhoria = (melhoriaId) => collection(db, `bases/${BASE_ID}/melhorias/${melhoriaId}/eventos`);
export const cReembolsos    = () => collection(db, `bases/${BASE_ID}/reembolsos`);
export const cMusicas       = () => collection(db, `bases/${BASE_ID}/musicas`);
export const cVersoes       = (musicaId) => collection(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes`);
export const cRepertorios   = () => collection(db, `bases/${BASE_ID}/repertorios`);
export const cHistoricoCantores = (musicaId) => collection(db, `bases/${BASE_ID}/musicas/${musicaId}/historicoCantores`);
export const dIndiceCantor = (pessoaId) => doc(db, `bases/${BASE_ID}/indiceCantores/${pessoaId}`);
export const cEnquetes       = () => collection(db, `bases/${BASE_ID}/enquetes`);
export const cRespostasEnquete = (mes) => collection(db, `bases/${BASE_ID}/enquetes/${mes}/respostas`);
export const cRascunhosEscala = () => collection(db, `bases/${BASE_ID}/rascunhosEscala`);
export const cEventos       = () => collection(db, "eventos");
export const cEscala        = (ev) => doc(db, `eventos/${ev}/escalas/${BASE_ID}`);

/** Os sete papéis da escala da Louvor. Lista fixa — sem catálogo no
 *  Firestore, sem CRUD: mudar a lista é editar aqui (ver CLAUDE.md
 *  desta base). Cada culto pode ter qualquer número de pessoas por
 *  papel (2 lead, 2 guitarras…), ao contrário do "titular +
 *  aprendiz" por ministério que a Técnica usa — aqui não há níveis,
 *  o líder de escala escolhe livremente quem entra em cada papel.
 *  As cores servem só para os cartões de Equipamentos (agrupamento
 *  por papel, mesmo componente que a Técnica usa para ministérios).
 *  "Vocal" virou três papéis (2026-09, pedido do líder): Lead,
 *  Co-lead e Back. Escalados antigos com `papel:"vocal"` continuam a
 *  existir (nada se apaga) e continuam a aparecer nos cultos
 *  passados — só perdem o nome bonito, `nomePapel` cai no id cru. */
export const PAPEIS = [
  { id: "lead",     nome: "Lead",     cor: "#D62069", emoji: "🎤" },
  { id: "colead",   nome: "Co-lead",  cor: "#E85D8F", emoji: "🎤" },
  { id: "back",     nome: "Back",     cor: "#B565D8", emoji: "🎤" },
  { id: "teclado",  nome: "Teclado",  cor: "#7B5CFF", emoji: "🎹" },
  { id: "guitarra", nome: "Guitarra", cor: "#0092D4", emoji: "🎸" },
  { id: "baixo",    nome: "Baixo",    cor: "#F5A300", emoji: "🎸" },
  { id: "bateria",  nome: "Bateria",  cor: "#00A88F", emoji: "🥁" },
];
export const nomePapel = (id) => PAPEIS.find((p) => p.id === id)?.nome ?? id;
export const emojiPapel = (id) => PAPEIS.find((p) => p.id === id)?.emoji ?? "🎵";

/** Ênfase do culto (tema do domingo) — três opções fixas, o líder
 *  troca livremente por culto (ver Escala.jsx). Sem valor gravado
 *  ainda, `enfaseDefault` decide: primeiro domingo do mês é sempre
 *  Ceia, os outros começam em Culto da Família. */
export const ENFASES = [
  { id: "ceia", nome: "Ceia" },
  { id: "contribua", nome: "Contribua" },
  { id: "familia", nome: "Culto da Família" },
];
export const nomeEnfase = (id) => ENFASES.find((e) => e.id === id)?.nome ?? id;
export const enfaseDefault = (dataISO) => (Number(dataISO.slice(8, 10)) <= 7 ? "ceia" : "familia");

/** Papéis na BASE (não confundir com PAPEIS da escala acima) — quem
 *  a pessoa é dentro da Louvor. "Auxiliar" tem todas as funções do
 *  líder da base (pedido do líder, 2026-09) exceto o nome — por isso
 *  aparece como mais uma opção de papel, não como um toggle à parte.
 *  Só existe na Louvor: a Cloud Function recusa este valor para
 *  qualquer outra base (ver functions/index.js). */
export const PAPEIS_BASE = [
  { id: "voluntario", nome: "Voluntário" },
  { id: "auxiliar", nome: "Auxiliar" },
  { id: "lider_base", nome: "Líder da base" },
];
export const nomePapelBase = (id) => PAPEIS_BASE.find((p) => p.id === id)?.nome ?? id;

/** "Auxiliar" tem todas as funções do líder da base — usar isto em
 *  vez de comparar `papel === "lider_base"` direto em qualquer sítio
 *  que hoje gate algo "só para o líder". */
export const souLiderOuAuxiliar = (papel) => papel === "lider_base" || papel === "auxiliar";

/** A regra do líder de escala, replicada no cliente só para esconder botões.
 *  A que conta é a da Cloud Function guardarEscalaLouvor. */
export const podeDistribuir = (papel, uid, escala) =>
  souLiderOuAuxiliar(papel) || escala?.liderEscala === uid;

/** O(s) papel(is) em que a pessoa serve naquele culto — normalmente
 *  um só, mas nada impede alguém de cantar e tocar no mesmo domingo. */
export const meusPapeisNoCulto = (escala, uid) =>
  (escala?.escalados || []).filter((e) => e.pessoaId === uid).map((e) => e.papel);

/** Nome genérico da cor mais próxima (distância euclidiana em RGB) —
 *  "escolheu um azul forte" mostra só "Azul", não o hex exato (pedido
 *  do líder para a caixinha de roupa em Escala.jsx). Paleta curta de
 *  propósito: é para o voluntário reconhecer a cor de relance, não
 *  para precisão de designer. */
const CORES_NOMEADAS = [
  ["#FFFFFF", "Branco"], ["#000000", "Preto"], ["#808080", "Cinza"],
  ["#FF0000", "Vermelho"], ["#FFA500", "Laranja"], ["#FFFF00", "Amarelo"],
  ["#008000", "Verde"], ["#00FFFF", "Ciano"], ["#0000FF", "Azul"],
  ["#800080", "Roxo"], ["#FFC0CB", "Rosa"], ["#A52A2A", "Castanho"],
  ["#F5F5DC", "Bege"], ["#FFD700", "Dourado"], ["#C0C0C0", "Prateado"],
];
function hexParaRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function nomeCor(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const [r, g, b] = hexParaRgb(hex);
  let melhor = null, menorDist = Infinity;
  for (const [candidatoHex, nome] of CORES_NOMEADAS) {
    const [cr, cg, cb] = hexParaRgb(candidatoHex);
    const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (dist < menorDist) { menorDist = dist; melhor = nome; }
  }
  return melhor;
}
