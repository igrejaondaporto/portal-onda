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
export const cEventos       = () => collection(db, "eventos");
export const cEscala        = (ev) => doc(db, `eventos/${ev}/escalas/${BASE_ID}`);

/** Os cinco papéis da escala da Louvor. Lista fixa — sem catálogo no
 *  Firestore, sem CRUD: mudar a lista é editar aqui (ver CLAUDE.md
 *  desta base). Cada culto pode ter qualquer número de pessoas por
 *  papel (2 vocais, 2 guitarras…), ao contrário do "titular +
 *  aprendiz" por ministério que a Técnica usa — aqui não há níveis,
 *  o líder de escala escolhe livremente quem entra em cada papel.
 *  As cores servem só para os cartões de Equipamentos (agrupamento
 *  por papel, mesmo componente que a Técnica usa para ministérios). */
export const PAPEIS = [
  { id: "vocal",    nome: "Vocal",    cor: "#D62069" },
  { id: "teclado",  nome: "Teclado",  cor: "#7B5CFF" },
  { id: "guitarra", nome: "Guitarra", cor: "#0092D4" },
  { id: "baixo",    nome: "Baixo",    cor: "#F5A300" },
  { id: "bateria",  nome: "Bateria",  cor: "#00A88F" },
];
export const nomePapel = (id) => PAPEIS.find((p) => p.id === id)?.nome ?? id;

/** A regra do líder de escala, replicada no cliente só para esconder botões.
 *  A que conta é a da Cloud Function guardarEscalaLouvor. */
export const podeDistribuir = (papel, uid, escala) =>
  papel === "lider_base" || escala?.liderEscala === uid;

/** O(s) papel(is) em que a pessoa serve naquele culto — normalmente
 *  um só, mas nada impede alguém de cantar e tocar no mesmo domingo. */
export const meusPapeisNoCulto = (escala, uid) =>
  (escala?.escalados || []).filter((e) => e.pessoaId === uid).map((e) => e.papel);
