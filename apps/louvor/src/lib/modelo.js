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
 *   bases/{base}/definicoes/papeisEscala             ← { lista: [...PAPEIS] }, ver mais abaixo
 *   eventos/{AAAA-MM-DD}                             ← global, a igreja toda
 *   eventos/{e}/escalas/{base}                       ← pessoas[] + liderEscala + escalados[]
 */
import { collection, doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
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
export const dIndiceCantor = (pessoaId) => doc(db, `bases/${BASE_ID}/indiceCantores/${pessoaId}`);
export const cIndiceCantores = () => collection(db, `bases/${BASE_ID}/indiceCantores`);
export const cEnquetes       = () => collection(db, `bases/${BASE_ID}/enquetes`);
export const cRespostasEnquete = (mes) => collection(db, `bases/${BASE_ID}/enquetes/${mes}/respostas`);
export const cRascunhosEscala = () => collection(db, `bases/${BASE_ID}/rascunhosEscala`);
export const cEventos       = () => collection(db, "eventos");
export const cEscala        = (ev) => doc(db, `eventos/${ev}/escalas/${BASE_ID}`);
export const cDefinicaoPapeis = () => doc(db, `bases/${BASE_ID}/definicoes/papeisEscala`);

/** Os papéis da escala da Louvor — editáveis pelo líder em
 *  Definições da base → Papéis da escala (pedido do líder, 2026-09;
 *  ver `SecaoPapeisEscala.jsx`; antes era esta lista fixa, sem
 *  catálogo no Firestore). PAPEIS_PADRAO é só o valor de arranque —
 *  o que `scripts/seedPapeisEscalaLouvor.mjs` grava a primeira vez, e
 *  o que qualquer ecrã mostra por instantes até o primeiro snapshot
 *  de `ouvirPapeisEscala` chegar — nunca uma fonte de verdade
 *  paralela ao Firestore. Cada culto pode ter qualquer número de
 *  pessoas por papel (2 lead, 2 guitarras…), ao contrário do "titular
 *  + aprendiz" por ministério que a Técnica usa — aqui não há
 *  níveis, o líder de escala escolhe livremente quem entra em cada
 *  papel. As cores servem só para os cartões de Equipamentos
 *  (agrupamento por papel, mesmo componente que a Técnica usa para
 *  ministérios).
 *
 *  O `id` de um papel nasce do nome, na criação, e nunca muda depois
 *  (ver `SecaoPapeisEscala.jsx`) — é o que fica gravado em
 *  `escalados[].papel` e `pessoas.instrumentos[]`; editar o nome ou a
 *  cor de um papel não mexe em nada já gravado com esse id. "Remover"
 *  nunca apaga (regra 5 do CLAUDE.md raiz): marca `ativo:false` —
 *  some da escala e do perfil de instrumentos daqui para a frente
 *  (ver `papeisAtivos`), mas escalas antigas com esse papel continuam
 *  a mostrar o nome certo (`nomePapel` procura em todos, ativos ou
 *  não) e dá para reativar. A validação a sério (quem pode entrar na
 *  escala) é sempre o que está gravado no Firestore, replicada no
 *  servidor em `functions/index.js` (`papeisValidosDaBase`) — o
 *  cliente nunca é a única barreira. "Vocal" virou três papéis
 *  (2026-09, pedido do líder): Lead, Co-lead e Back — mesmo
 *  mecanismo de antes de existir este ecrã, gravado à mão. */
export const PAPEIS_PADRAO = [
  { id: "lead",     nome: "Lead",     cor: "#D62069", emoji: "🎤" },
  { id: "colead",   nome: "Co-lead",  cor: "#E85D8F", emoji: "🎤" },
  { id: "back",     nome: "Back",     cor: "#B565D8", emoji: "🎤" },
  { id: "teclado",  nome: "Teclado",  cor: "#7B5CFF", emoji: "🎹" },
  { id: "guitarra", nome: "Guitarra", cor: "#0092D4", emoji: "🎸" },
  { id: "baixo",    nome: "Baixo",    cor: "#F5A300", emoji: "🎸" },
  { id: "bateria",  nome: "Bateria",  cor: "#00A88F", emoji: "🥁" },
];

/** Ao vivo — quem edita os papéis (Definições da base) vê a mudança
 *  refletida em toda a app sem sair e voltar a entrar. Sem doc ainda
 *  (base nunca editada) ou lista vazia, cai em PAPEIS_PADRAO — nunca
 *  um ecrã com "nenhum papel". Ver PapeisEscalaContext.jsx, que é
 *  quem chama isto (montado uma vez em Sessao.jsx). */
export function ouvirPapeisEscala(cb) {
  return onSnapshot(cDefinicaoPapeis(), (s) => {
    const lista = s.exists() ? s.data().lista : null;
    cb(Array.isArray(lista) && lista.length ? lista : PAPEIS_PADRAO);
  });
}

/** Substitui a lista inteira — o próprio SecaoPapeisEscala.jsx calcula
 *  o array todo (com o papel novo/editado/desativado já dentro) antes
 *  de chamar isto; nunca um `arrayUnion` de um papel só (editar um
 *  campo de um item específico do array não dá para fazer assim).
 *  Escrita direta do cliente — `bases/{base}/definicoes/{doc}` já é
 *  `souLiderBase` em firestore.rules (o mesmo caminho que a Kinder
 *  usa para faixas etárias/consentimento), sem regra nova. */
export const guardarPapeisEscala = (lista) =>
  setDoc(cDefinicaoPapeis(), { lista, atualizadoEm: serverTimestamp() }, { merge: true });

/** Só os que ainda servem para uma escala nova — SheetEscala.jsx
 *  (que blocos mostrar) e SheetPessoa.jsx (que instrumentos oferecer)
 *  usam isto, nunca a lista `papeis` inteira. */
export const papeisAtivos = (papeis) => papeis.filter((p) => p.ativo !== false);

/** `nomePapel`/`emojiPapel` procuram em TODOS os papéis (ativos ou
 *  não) — uma escala antiga com um papel entretanto removido continua
 *  a mostrar o nome certo, só deixa de poder ser escolhido de novo
 *  (ver papeisAtivos). `papeis` vem sempre de `usePapeisEscala()`
 *  (PapeisEscalaContext.jsx). */
export const nomePapel = (papeis, id) => papeis.find((p) => p.id === id)?.nome ?? id;
export const emojiPapel = (papeis, id) => papeis.find((p) => p.id === id)?.emoji ?? "🎵";


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
