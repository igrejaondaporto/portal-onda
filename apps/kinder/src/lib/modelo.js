/**
 * Caminhos do Firestore e as três salas do Kinder, num sítio só.
 *
 *   bases/kinder                                   ← nome, horas, cor
 *   bases/kinder/pessoas/{p}                       ← papel, categoria (baby|fun|junior|null)
 *   bases/kinder/pessoas/{p}/capacitacoes/{cap}    ← feitaEm, validaAte (certificado)
 *   bases/kinder/capacitacoes/{cap}                ← catálogo (a líder mantém)
 *   bases/kinder/familias/{f}                      ← só por Cloud Function (functions/kinder.js)
 *   bases/kinder/criancas/{c}                      ← idem
 *   bases/kinder/licoes/{id}                       ← categorias[], link Kiwify, resumo, materiais…
 *   bases/kinder/checklistSala/{item}              ← texto, categoria, fase abrir|fechar
 *   bases/kinder/ocorrencias/{o}                   ← queda, febre… (autor + líderes leem)
 *   bases/kinder/definicoes/{categorias|consentimento}
 *   bases/kinder/inventario/{item}                 ← + sala (baby|fun|junior|partilhado)
 *   eventos/{e}/escalas/kinder                     ← pessoas[] + liderEscala (lista simples)
 *   eventos/{e}/checkinKinder/{crianca}            ← só por Cloud Function
 *   eventos/{e}/codigosKinder/{familia}            ← idem
 *   eventos/{e}/checklistKinder/{sala}             ← itens marcados
 *   eventos/{e}/contagemKinder/geral               ← correção manual da contagem
 */
import { collection, doc } from "firebase/firestore";
import { db, BASE_ID } from "@portal/shared/lib/firebase.js";

export const cBase        = () => doc(db, "bases", BASE_ID);
export const cPessoas     = () => collection(db, `bases/${BASE_ID}/pessoas`);
export const cEventos     = () => collection(db, "eventos");
export const cEscala      = (ev) => doc(db, `eventos/${ev}/escalas/${BASE_ID}`);
export const cAtribuicoes = (ev) => collection(db, `eventos/${ev}/atribuicoes`);
export const cChecklist   = (ev) => collection(db, `eventos/${ev}/checklist`);
export const cInventario  = () => collection(db, `bases/${BASE_ID}/inventario`);
export const cListasCompras = () => collection(db, `bases/${BASE_ID}/listasCompras`);
export const cListaCompras  = (id) => doc(db, `bases/${BASE_ID}/listasCompras/${id}`);
export const cReembolsos  = () => collection(db, `bases/${BASE_ID}/reembolsos`);
export const cLicoes      = () => collection(db, `bases/${BASE_ID}/licoes`);
export const cCapacitacoes = () => collection(db, `bases/${BASE_ID}/capacitacoes`);
export const cCapacitacoesPessoa = (uid) => collection(db, `bases/${BASE_ID}/pessoas/${uid}/capacitacoes`);
export const cChecklistSala = () => collection(db, `bases/${BASE_ID}/checklistSala`);
export const cFamilias    = () => collection(db, `bases/${BASE_ID}/familias`);
export const cCriancas    = () => collection(db, `bases/${BASE_ID}/criancas`);
export const cOcorrencias = () => collection(db, `bases/${BASE_ID}/ocorrencias`);
export const cDefinicao   = (nome) => doc(db, `bases/${BASE_ID}/definicoes/${nome}`);
export const cCheckins    = (ev) => collection(db, `eventos/${ev}/checkinKinder`);
export const cCodigos     = (ev) => collection(db, `eventos/${ev}/codigosKinder`);
export const cChecklistKinder = (ev, sala) => doc(db, `eventos/${ev}/checklistKinder/${sala}`);
export const cContagemKinder  = (ev) => doc(db, `eventos/${ev}/contagemKinder/geral`);

/**
 * As três salas. As cores são as mesmas do telão de chamadas
 * (packages/shared/src/lib/chamadas.js) — Baby roxo, Fun amarelo,
 * Júnior azul, pedido do Kinder. `texto` é a cor da letra por cima
 * da cor cheia (no amarelo o branco não se lê); `textoSuave` é a da
 * letra por cima do fundo `suave`.
 */
export const CATEGORIAS = [
  { id: "baby",   nome: "Baby",   cor: "#7b5cff", suave: "#efeaff", texto: "#ffffff", textoSuave: "#4b2fd1" },
  { id: "fun",    nome: "Fun",    cor: "#f5c400", suave: "#fff6cc", texto: "#1c1c1c", textoSuave: "#6b5500" },
  { id: "junior", nome: "Júnior", cor: "#1e7bf0", suave: "#e6f0fe", texto: "#ffffff", textoSuave: "#0b4fa8" },
];
const SEM_CATEGORIA = { id: null, nome: "Todas", cor: "#6a7192", suave: "#eef0f6", texto: "#ffffff", textoSuave: "#4a5070" };

export const categoria = (id) => CATEGORIAS.find((c) => c.id === id) ?? null;
export const nomeCategoria = (id) => categoria(id)?.nome ?? "Geral";

/** Variáveis CSS de uma sala, para `style={...}` — ver .kin-cat,
 *  .kin-faixa e .kin-tagcat no kinder.css. */
export function varsCategoria(id) {
  const c = categoria(id) ?? SEM_CATEGORIA;
  return { "--c": c.cor, "--c-suave": c.suave, "--c-texto": c.texto, "--c-texto-suave": c.textoSuave };
}

/** Líder geral (lider_base) e líderes de sala (auxiliar) têm as mesmas
 *  permissões — usar sempre isto, nunca `papel === "lider_base"`. */
export const souLider = (papel) => papel === "lider_base" || papel === "auxiliar";

export function rotuloPapel(papel, cat) {
  if (papel === "lider_base") return "Líder geral";
  if (papel === "auxiliar") return cat ? `Líder ${nomeCategoria(cat)}` : "Líder de sala";
  return cat ? `Voluntário · ${nomeCategoria(cat)}` : "Voluntário";
}

/** A sala que cada ecrã mostra primeiro: a da pessoa. As líderes
 *  abrem em "Todas" — veem as três salas. */
export const categoriaInicial = (papel, pessoa) => (souLider(papel) ? null : pessoa?.categoria ?? null);

/** A regra do líder de escala, replicada no cliente só para esconder
 *  botões. A que conta é a da Cloud Function. */
export const podeDistribuir = (papel, uid, escala) => souLider(papel) || escala?.liderEscala === uid;

/** Idade em anos completos a partir de "AAAA-MM-DD" — datas locais,
 *  nunca toISOString (desvia um dia em UTC+). */
export function idade(dataNascimento, hoje = new Date()) {
  if (!dataNascimento) return null;
  const [a, m, d] = dataNascimento.split("-").map(Number);
  return hoje.getFullYear() - a - (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d) ? 1 : 0);
}

export const FAIXAS_PADRAO = { baby: { min: 1, max: 2 }, fun: { min: 3, max: 5 }, junior: { min: 6, max: 8 } };

/** Capacidade de cada sala: 5 crianças por voluntário lá dentro
 *  (confirmado com a líder — 2 voluntários → 10 no Baby, 3 → 15).
 *  Mesma proporção nas três salas. */
export const CRIANCAS_POR_VOLUNTARIO = 5;

/** Quantos voluntários de cada sala estão escalados hoje (a partir da
 *  escala do culto + o catálogo de voluntários) → capacidade de cada
 *  sala, no mesmo formato de `contagens` do SeletorCategoria. */
export function capacidadesPorSala(idsEscalados, voluntarios) {
  const porSala = Object.fromEntries(CATEGORIAS.map((c) => [c.id, 0]));
  for (const id of idsEscalados) {
    const cat = voluntarios.find((v) => v.id === id)?.categoria;
    if (cat && cat in porSala) porSala[cat] += 1;
  }
  return Object.fromEntries(CATEGORIAS.map((c) => [c.id, porSala[c.id] * CRIANCAS_POR_VOLUNTARIO]));
}
