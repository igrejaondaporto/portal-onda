/**
 * O funil de visitantes — de quem apareceu num domingo a quem já serve
 * numa base.
 *
 * `contactos` é uma coleção GLOBAL desde que nasceu, e o comentário nas
 * `firestore.rules` diz porquê em tantas palavras: "o painel do pastor
 * (ainda não existe) vai precisar de ler isto por cima de todas as
 * bases, um dia". A Base Pessoal cria sempre com `etapa: "visita"` (as
 * regras obrigam), e as etapas seguintes são só daqui.
 *
 * Enquanto este painel não existia, a líder da Pessoal "entregava" cada
 * contacto à mão: um botão por lead que abria o WhatsApp dela com a
 * mensagem para o pastor já escrita. Esse botão continua a existir e
 * continua a fazer sentido — é o empurrão humano —, mas agora tem para
 * onde empurrar.
 *
 * LER é direto (regra aberta para `ve_tudo_pastoral`): é uma lista a
 * sério, com filtro e busca, e passá-la por uma função só ganhava
 * paginação à mão e perdia o tempo real. MOVER de etapa é Cloud
 * Function (`moverEtapaContacto`): o histórico tem de ficar gravado na
 * mesma escrita, e uma regra não garante isso.
 */
import { onSnapshot, orderBy, query } from "firebase/firestore";
import { cContactos, cGDs } from "./modelo";

/**
 * As seis etapas, pela ordem do caminho. É a mesma lista que
 * `functions/pastoral.js` valida — se uma etapa nova aparecer, tem de
 * entrar nos dois sítios (o servidor recusa o que não conhece, que é
 * o que se quer: uma etapa escrita só no cliente nunca chega a gravar).
 *
 * `voluntario` e `servindo` são etapas diferentes de propósito: entre
 * dizer "quero servir" e estar numa escala há semanas de conversa, e
 * juntar as duas escondia exatamente o sítio onde as pessoas se
 * perdem. Ninguém vira `pessoas/{id}` por passar aqui — a identidade
 * cria-se no Painel do líder da base, nunca por este funil (seria
 * duplicar identidade, ver CLAUDE.md da Pessoal).
 */
export const ETAPAS = [
  { id: "visita", nome: "Visita", descricao: "Apareceu num culto e deixou contacto" },
  { id: "contactado", nome: "Contactado", descricao: "Já falámos com a pessoa" },
  { id: "gd", nome: "No GD", descricao: "Está a ir a um grupo" },
  { id: "membro", nome: "Membro", descricao: "Fez o percurso de membresia" },
  { id: "voluntario", nome: "Quer servir", descricao: "Disse que quer entrar numa base" },
  { id: "servindo", nome: "A servir", descricao: "Já está numa escala" },
];

export const nomeEtapa = (id) => ETAPAS.find((e) => e.id === id)?.nome ?? id;
export const indiceEtapa = (id) => ETAPAS.findIndex((e) => e.id === id);

/**
 * A cor escurece com a etapa — uma rampa de UM só tom (o `--azul` da
 * casa), do mais claro ao mais escuro, e não seis cores diferentes.
 *
 * As etapas são um caminho ordenado, não seis identidades: dar a cada
 * uma o seu tom seria um arco-íris a codificar uma ordem, e a ordem
 * já está na posição. Com uma rampa, "mais escuro é mais perto do
 * fim" lê-se sem legenda e continua a ler-se em daltonismo e a preto
 * e branco, onde seis tons diferentes viram seis cinzentos iguais.
 *
 * Os passos não foram escolhidos a olho: saíram do validador de
 * paletas (lightness monótona, salto mínimo entre passos, e o passo
 * mais claro ainda a destacar-se do fundo branco — foi esse o que
 * reprovou duas vezes antes de chegar aqui). Nenhum é `--verde` ou
 * `--magenta`, reservados no resto do produto para estado de
 * checklist e perigo.
 */
export const CORES_ETAPA = {
  visita: "#9aabee",
  contactado: "#7b8fe6",
  gd: "#5d74db",
  membro: "#4059cf",
  voluntario: "#2640c5",
  servindo: "#0019be",
};

/** A rampa foi validada contra FUNDO branco (ver o comentário acima),
 *  não contra texto branco POR CIMA dela — são coisas diferentes, e é
 *  por isso que a etiqueta "Visita" (o passo mais claro) com texto
 *  branco ficava "meio clara" (relato 2026-09): não é a rampa que
 *  está errada, é usá-la como fundo sólido de um selo com texto
 *  branco sem verificar o contraste. Luminância relativa simples
 *  (0–255): abaixo do limiar, o passo é claro demais para texto
 *  branco em cima — tinta escura em vez disso. Não mexe em
 *  `CORES_ETAPA` (o resto do produto continua a usá-la como sempre,
 *  sobre fundo branco, onde já estava certa). */
export function corTextoEtapa(id) {
  const hex = CORES_ETAPA[id];
  if (!hex) return "#fff";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminancia = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminancia > 150 ? "var(--tinta)" : "#fff";
}

/** Todos os contactos não arquivados, ao vivo. O volume é de dezenas
 *  por ano, não de milhares — não vale paginar, e ter tudo em memória
 *  é o que deixa o filtro e a busca serem instantâneos. */
export function ouvirContactos(cb) {
  return onSnapshot(query(cContactos(), orderBy("criadoEm", "desc")), (snap) => {
    cb(snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => c.arquivado !== true)
      .map((c) => ({ ...c, etapa: c.etapa ?? "visita" })));
  });
}

/** Quantos em cada etapa, pela ordem do funil — sempre as seis, mesmo
 *  as vazias: um funil com etapas a desaparecer conforme esvaziam
 *  deixa de se ler como um caminho. */
export function contarPorEtapa(contactos) {
  const mapa = new Map(ETAPAS.map((e) => [e.id, 0]));
  for (const c of contactos) {
    if (mapa.has(c.etapa)) mapa.set(c.etapa, mapa.get(c.etapa) + 1);
  }
  return ETAPAS.map((e) => ({ ...e, total: mapa.get(e.id), cor: CORES_ETAPA[e.id] }));
}

/** Há quantos dias este contacto está parado na etapa em que está.
 *  `etapaEm` só existe depois do primeiro movimento — antes disso, o
 *  relógio conta desde que foi criado, que é o que interessa: uma
 *  visita de há três meses que ninguém contactou é o próprio problema
 *  que este ecrã existe para mostrar. */
export function diasParado(c) {
  const ts = c.etapaEm ?? c.criadoEm;
  if (!ts?.toDate) return null;
  return Math.floor((Date.now() - ts.toDate().getTime()) / 86400000);
}

/** A partir de quantos dias na mesma etapa um contacto está "parado"
 *  (pedido 2026-09: "destacar quem está na mesma etapa há mais de 7
 *  dias"). Uma semana é um domingo inteiro sem ninguém lhe pegar. */
export const DIAS_PARADO = 7;

/** O GD em que o contacto ficou — `gd` desde 2026-09 (escolhido ao
 *  mover para "No GD", `moverEtapaContacto`). */
export const nomeGD = (c) => c.gd?.nome ?? null;

/** O catálogo de GDs, ao vivo, por nome. */
export function ouvirGDs(cb) {
  return onSnapshot(query(cGDs(), orderBy("nome")), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((g) => g.ativo !== false)));
}

/** A conversão do funil (pedido 2026-09: "quantos em cada etapa, e a
 *  percentagem que passou de cada etapa até a servir"). Uma pessoa
 *  numa etapa já passou por todas as anteriores — quem está em
 *  "Membro" conta em Visita, Contactado e No GD como "chegou lá".
 *  `passou` = dos que chegaram a esta etapa, quantos % chegaram à
 *  seguinte; `chegou` = % de todos os contactos que chegaram até
 *  aqui. */
export function conversaoFunil(contactos) {
  const idx = contactos.map((c) => indiceEtapa(c.etapa)).filter((i) => i >= 0);
  const total = idx.length;
  const chegaram = ETAPAS.map((_, i) => idx.filter((j) => j >= i).length);
  return ETAPAS.map((e, i) => ({
    ...e,
    aqui: idx.filter((j) => j === i).length,
    chegaram: chegaram[i],
    chegou: total ? Math.round((chegaram[i] / total) * 100) : null,
    passou: i < ETAPAS.length - 1 && chegaram[i] ? Math.round((chegaram[i + 1] / chegaram[i]) * 100) : null,
    cor: CORES_ETAPA[e.id],
  }));
}

/** Parados há muito tempo, primeiro — e só os que ainda não chegaram
 *  ao fim do funil. Quem já está a servir não está "parado", chegou. */
export function esquecidos(contactos, dias = DIAS_PARADO) {
  return contactos
    .filter((c) => c.etapa !== "servindo")
    .map((c) => ({ ...c, dias: diasParado(c) }))
    .filter((c) => c.dias !== null && c.dias >= dias)
    .sort((a, b) => b.dias - a.dias);
}
