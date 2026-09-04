/**
 * Biblioteca de músicas — título+artista é a identidade (um cover de
 * outro artista é música separada, nunca uma versão). Versões guardam
 * tom/BPM/duração por arranjo; só o Adriel marca a versão padrão da
 * Onda (ver CLAUDE.md desta base).
 *
 * Resolução automática de capa/tom/BPM/links na busca por nome (ver
 * CLAUDE.md desta base, secção 5) — cadastro manual continua possível
 * a qualquer momento, por cima do que a busca sugerir.
 *
 * A biblioteca fica abaixo de 500 músicas — carrega tudo com
 * onSnapshot uma vez; busca e filtros correm no cliente contra essa
 * cache, nunca uma leitura por tecla digitada.
 */
import { arrayUnion, doc, getDoc, getDocs, onSnapshot, orderBy, query, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";
import { cMusicas, cVersoes, dIndiceCantor, cIndiceCantores } from "./modelo";

export const CLASSIFICACOES = [
  { id: "adoracao", nome: "Adoração", ajuda: "Cânticos cujas letras expressam reconhecimento a Deus por aquilo que Ele é." },
  { id: "alegria", nome: "Alegria", ajuda: "Expressam alegria pelo Senhor e pelos Seus feitos." },
  { id: "consagracao", nome: "Consagração", ajuda: "Tratam da dedicação de nossas vidas a Deus e da santificação." },
  { id: "contemplacao", nome: "Contemplação", ajuda: "Concentram-se em meditar na Pessoa de Deus, Seu caráter e Suas qualidades." },
  { id: "especiais", nome: "Especiais", ajuda: "Temas como casamento, batizados e datas." },
  { id: "louvor", nome: "Louvor", ajuda: "Expressam elogio e agradecimento por aquilo que Deus fez, faz ou fará." },
];

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** letras.mus.br e cifraclub.com.br partilham o padrão {artista}/{musica}. */
export function slugMusica(titulo, artista) {
  const s = (v) => norm(v).replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
  return `${s(artista)}/${s(titulo)}`;
}
export const chaveIdentidade = (titulo, artista) => `${norm(artista)}__${norm(titulo)}`;

export function ouvirMusicas(cb) {
  const q = query(cMusicas(), orderBy("ultimaVezTocada"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export function ouvirVersoes(musicaId, cb) {
  return onSnapshot(cVersoes(musicaId), (snap) => cb(
    snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((v) => v.ativo !== false)
  ));
}

/** Uma versão só, ao vivo — usado por SheetVersaoDetalhe.jsx para
 *  nunca depender de uma cópia parada passada pelo componente que o
 *  abriu (a versão dentro de SheetMusicaDetalhe já tinha esse
 *  problema resolvido lendo de `versoesOrdenadas`; abrir pelo
 *  Histórico por cantor, em Biblioteca.jsx, não tinha — "+ Adicionar
 *  tom" gravava certo mas a lista não atualizava). Com isto,
 *  SheetVersaoDetalhe fica autossuficiente com só musicaId/versaoId,
 *  ao vivo nos dois sítios de uma vez. */
export function ouvirVersao(musicaId, versaoId, cb) {
  if (!musicaId || !versaoId) { cb(null); return () => {}; }
  return onSnapshot(doc(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes/${versaoId}`), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null));
}

/** Leitura pontual do tom de uma versão — para a prévia de repertório
 *  dentro do cartão de Escala (ver Escala.jsx). Não é onSnapshot: o
 *  tom quase nunca muda depois de escolhido, e um card de culto pode
 *  ter várias músicas — um listener por música seria demais para algo
 *  que raramente atualiza. */
export async function obterTomVersao(musicaId, versaoId) {
  if (!musicaId || !versaoId) return null;
  const snap = await getDoc(doc(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes/${versaoId}`));
  return snap.exists() ? snap.data().tom || null : null;
}

/** Mesma leitura pontual acima, mas para uma lista de itens de
 *  repertório de uma vez — devolve { [itemId]: tom }. Usado tanto no
 *  cartão de Escala (prévia) quanto no Repertório (badge tocável por
 *  música, ver Repertorio.jsx). */
export async function obterTonsDosItens(itens) {
  const musicais = (itens || []).filter((i) => i.tipo === "musica" && i.musicaId && i.versaoId);
  const pares = await Promise.all(
    musicais.map((i) => obterTomVersao(i.musicaId, i.versaoId).then((tom) => [i.id, tom]))
  );
  return Object.fromEntries(pares);
}

/** Todas as versões (em qualquer música) cujo nome bate com esta
 *  pessoa — a versão É o cantor, ver functions/index.js,
 *  registarUsoVersaoLouvor. Um documento só, sem query nenhuma. null
 *  enquanto não houver nenhuma versão com o nome dela ainda. */
export function ouvirIndiceCantor(pessoaId, cb) {
  if (!pessoaId) { cb(null); return () => {}; }
  return onSnapshot(dIndiceCantor(pessoaId), (s) => cb(s.exists() ? s.data() : null));
}

/** Só os ids de quem já tem pelo menos uma versão no índice — para o
 *  seletor de cantor em VistaHistoricoCantor.jsx não listar toda a
 *  base (baixista, baterista… ninguém que não tenha versão nenhuma
 *  no nome nunca vai aparecer aqui, pedido do líder). Um `Set`
 *  porque só interessa "está lá ou não", nunca o conteúdo. */
export function ouvirCantoresComVersao(cb) {
  return onSnapshot(cIndiceCantores(), (snap) => cb(new Set(snap.docs.map((d) => d.id))));
}

/** Chamado em três momentos: ao adicionar a música a um repertório
 *  (repertorio.js) e ao trocar o tom de um item já lá dentro
 *  (SheetEditarTom, dentro de Repertorio.jsx) — as duas COM eventoId,
 *  contam como "esta versão foi usada neste culto". E ao criar ou
 *  editar a própria versão (SheetVersao.jsx) — SEM eventoId, só
 *  sincroniza nome/tom no índice por cantor, sem contar como uso
 *  (é assim que criar uma versão nova já a faz aparecer no Histórico
 *  por cantor, mesmo antes de qualquer culto). Silencioso por
 *  natureza — sem nome que bata com ninguém da base, não regista
 *  nada, não é erro; falhar aqui nunca deve travar o fluxo principal. */
export const registarUsoVersao = (dados) =>
  chamar("registarUsoVersaoLouvor")(dados).then((r) => r.data).catch(() => null);

/** Espelho de registarUsoVersao — chamado quando uma música SAI do
 *  repertório de um culto (Repertorio.jsx, remover), para o Histórico
 *  não continuar a mostrar um uso que já não existe. Precisa sempre
 *  de eventoId (ao contrário de registarUsoVersao, que também serve
 *  para sincronizar sem culto nenhum). */
export const desfazerUsoVersao = (dados) =>
  chamar("desfazerUsoVersaoLouvor")(dados).then((r) => r.data).catch(() => null);

/** Chamada por desativarVersao e por removerTomVersao (quando esta
 *  desativa sozinha a versão sem tom nenhum sobrando) — tira a
 *  entrada dessa versão de indiceCantores/{pessoaId}.musicas[], que
 *  só uma Cloud Function pode escrever (ver firestore.rules).
 *  Fire-and-forget como registarUsoVersao/desfazerUsoVersao: falhar
 *  aqui nunca deve travar o "Excluir versão" que já aconteceu de
 *  facto na própria versão. */
export const limparIndiceParaVersao = (musicaId, versaoId) =>
  chamar("limparIndiceParaVersaoLouvor")({ musicaId, versaoId }).then((r) => r.data).catch(() => null);

/** usoPorCulto ({eventoId: tom}, ver functions/index.js) → a mesma
 *  forma agrupada por tom que a UI do Histórico usa
 *  ([{tom, datas: [eventoId,...]}], mais recente primeiro dentro de
 *  cada tom) — "vezes" é só `datas.length`, não precisa de campo
 *  próprio. Um mapa plano por eventoId é o que dá para SOBRESCREVER
 *  (tom mudou) ou APAGAR (música saiu do repertório) uma única
 *  entrada sem procurar dentro de arrays — a forma agrupada é só
 *  para mostrar, nunca é o que se grava. */
export function agruparUsoPorCulto(usoPorCulto) {
  const porTom = {};
  Object.entries(usoPorCulto || {}).forEach(([eventoId, tom]) => {
    // `tom` pode vir null (música adicionada ao repertório antes de
    // escolher o tom, ver registarUsoVersaoLouvor) — `porTom[null]`
    // criava a chave literal "null" (JS coage a chave de objeto para
    // string), que ia parar ao ecrã. "" normaliza para o mesmo
    // tratamento que tonsParaMostrar/UI já dão a "sem tom".
    (porTom[tom || ""] ??= []).push(eventoId);
  });
  return Object.entries(porTom).map(([tom, datas]) => ({ tom, datas: datas.sort().reverse() }));
}

/** Junta o historico (já agrupado por agruparUsoPorCulto) com o tom
 *  ATUAL da versão e com tonsConhecidos — sem isto, uma versão que
 *  nunca foi usada num culto nem teve tom nenhum adicionado à mão
 *  ficava "sem uso ainda" mesmo já tendo um tom definido (pedido do
 *  líder: "quero que o tom atual seja também um dos tons já
 *  usados"). Cada tom entra uma vez só, mesmo que apareça nos três
 *  sítios. */
export function tonsParaMostrar(historico, tomAtual, tonsConhecidos) {
  const linhas = [...(historico || [])];
  const jaTem = new Set(linhas.map((h) => h.tom));
  function adicionar(tom) {
    if (!tom || jaTem.has(tom)) return;
    linhas.push({ tom, datas: [] });
    jaTem.add(tom);
  }
  adicionar(tomAtual);
  (tonsConhecidos || []).forEach(adicionar);
  return linhas;
}

/** "+ Adicionar tom" em SheetVersaoDetalhe.jsx — declarar que este
 *  cantor também já cantou nesta versão em tal tom, sem estar ligado
 *  a nenhum culto real (pedido do líder). Escrita direta do cliente
 *  (mesma regra de sempre em versões, allow update: if minhaBase),
 *  sem Cloud Function — arrayUnion evita duplicar se o tom já lá
 *  estiver. Guardado à parte de usoPorCulto de propósito: aquele é
 *  só o que aconteceu de facto num culto, isto é uma declaração
 *  manual sem data — a UI mostra os dois juntos (ver
 *  SheetVersaoDetalhe.jsx), "sem culto ainda" para os que só estão
 *  aqui. */
export const adicionarTomManual = (musicaId, versaoId, tom) =>
  updateDoc(doc(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes/${versaoId}`), { tonsConhecidos: arrayUnion(tom) });

/** "X" ao lado de um tom em SheetVersaoDetalhe.jsx (líder/auxiliar,
 *  pedido do líder) — apaga esse tom de tonsConhecidos e de todo o
 *  usoPorCulto (qualquer culto que o tenha usado deixa de contar), e
 *  limpa o tom ATUAL da versão se for esse (senão tonsParaMostrar
 *  ia voltar a mostrá-lo sozinho). Leitura + escrita direta do
 *  cliente, sem transação — ação rara, de um líder/auxiliar de cada
 *  vez, o mesmo risco que adicionarTomManual acima já aceita. */
export async function removerTomVersao(musicaId, versaoId, tom) {
  const ref = doc(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes/${versaoId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const dados = snap.data();
  const tonsConhecidos = (dados.tonsConhecidos || []).filter((t) => t !== tom);
  const usoPorCulto = Object.fromEntries(Object.entries(dados.usoPorCulto || {}).filter(([, t]) => t !== tom));
  const atualizacao = { tonsConhecidos, usoPorCulto };
  const tomFinal = dados.tom === tom ? "" : dados.tom;
  if (dados.tom === tom) atualizacao.tom = "";
  // sem tom nenhum sobrando (nem atual, nem conhecido, nem uso real)
  // — a versão fica sem sentido, some sozinha (pedido do líder,
  // 2026-09: "quando exclui um tom e só existia aquele, a versão
  // também deve sumir"). Nunca apagada a sério, ver desativarVersao.
  if (!tomFinal && !tonsConhecidos.length && !Object.keys(usoPorCulto).length) {
    atualizacao.ativo = false;
  }
  await updateDoc(ref, atualizacao);
  if (atualizacao.ativo === false) limparIndiceParaVersao(musicaId, versaoId);
}

/** "Excluir versão" — Editar versão (SheetVersao.jsx) e quando o
 *  último tom dela é excluído (ver removerTomVersao acima). Nunca
 *  apagada a sério (regra 5 do CLAUDE.md raiz) — as regras do
 *  Firestore já recusam delete em versões; ativo:false é o que some
 *  das listas (ouvirVersoes já filtra), sem perder o histórico.
 *  limparIndiceParaVersao (acima) tira a entrada dela do Histórico
 *  por cantor — antes ficava para trás com dados antigos até essa
 *  pessoa ganhar/perder outra versão que atualizasse o índice por
 *  inteiro. */
export async function desativarVersao(musicaId, versaoId) {
  await updateDoc(doc(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes/${versaoId}`), { ativo: false });
  limparIndiceParaVersao(musicaId, versaoId);
}

export const novaMusicaId = () => doc(cMusicas()).id;

/** Nunca bloqueia — só avisa "é uma versão nova?" e mostra a existente
 *  (ver CLAUDE.md desta base, decisão 9). */
export function encontrarDuplicata(musicas, titulo, artista) {
  const chave = chaveIdentidade(titulo, artista);
  return musicas.find((m) => m.chaveIdentidade === chave) ?? null;
}

export async function criarMusica(id, dados) {
  await setDoc(doc(db, `bases/${BASE_ID}/musicas/${id}`), {
    titulo: dados.titulo.trim(),
    artista: dados.artista.trim(),
    chaveIdentidade: chaveIdentidade(dados.titulo, dados.artista),
    slug: slugMusica(dados.titulo, dados.artista),
    classificacoes: dados.classificacoes ?? [],
    duracao: dados.duracao ?? null,
    capaUrl: dados.capaUrl ?? null,
    capaOrigem: dados.capaOrigem ?? "placeholder",
    deezerId: dados.deezerId ?? null,
    previewUrl: dados.previewUrl ?? null,
    links: {
      letra: dados.links?.letra || "", cifra: dados.links?.cifra || "",
      audio: dados.links?.audio || "", video: dados.links?.video || "",
    },
    autoral: !!dados.autoral,
    criadoPor: dados.criadoPor,
    criadoEm: serverTimestamp(),
    ultimaVezTocada: null,
    vezes90d: 0,
    versaoPadraoId: null,
  });
  return id;
}

export const guardarMusica = (id, dados) => updateDoc(doc(db, `bases/${BASE_ID}/musicas/${id}`), dados);

/** Só o líder pode chamar isto de facto — as regras do Firestore
 *  recusam a outra gente escrever versaoPadraoId (ver firestore.rules). */
export const definirVersaoPadrao = (musicaId, versaoId) =>
  updateDoc(doc(db, `bases/${BASE_ID}/musicas/${musicaId}`), { versaoPadraoId: versaoId });

export const novaVersaoId = (musicaId) => doc(cVersoes(musicaId)).id;

export async function criarVersao(musicaId, id, dados) {
  await setDoc(doc(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes/${id}`), {
    nome: dados.nome?.trim() || "Onda",
    tom: dados.tom?.trim() || "",
    bpm: dados.bpm || null,
    duracao: dados.duracao || null,
    observacao: dados.observacao?.trim() || "",
    // referência (Cifra Club, áudio…) que sustenta ESTE tom — não é o
    // que a Técnica lê (isso continua a vir só de musicas.links, ver
    // CLAUDE.md desta base), é só apoio pra quem vai cantar escolher
    // o tom com uma referência à mão.
    linkReferencia: dados.linkReferencia?.trim() || "",
    fonteTom: dados.fonteTom || "manual",
    fonteBpm: dados.fonteBpm || "manual",
    criadoPor: dados.criadoPor,
    criadoEm: serverTimestamp(),
  });
  return id;
}

export const guardarVersao = (musicaId, versaoId, dados) =>
  updateDoc(doc(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes/${versaoId}`), dados);

/** Criar ou editar uma versão (SheetVersao.jsx) — se o nome escolhido
 *  já for de OUTRA versão ativa da mesma música, funde nela em vez de
 *  duplicar: "Em Versões só pode existir uma por cantor" (pedido do
 *  líder, 2026-09 — reportou "Amanda" e "Amanda 2" na mesma música,
 *  sobra de quando o Nome ainda era texto livre). A versão fundida
 *  (a que estava a ser editada, se havia) fica ativo:false — o
 *  histórico dela (usoPorCulto/tonsConhecidos) passa todo para a que
 *  sobrevive, nunca se perde. Devolve o id onde os dados ficaram —
 *  pode ser diferente do que entrou, se fundiu. */
export async function guardarOuFundirVersao(musicaId, versaoId, dados, uid) {
  const norm = (s) => (s || "").trim().toLowerCase();
  const versoesSnap = await getDocs(cVersoes(musicaId));
  const outra = versoesSnap.docs.find((d) => d.id !== versaoId && d.data().ativo !== false && norm(d.data().nome) === norm(dados.nome));

  if (!outra) {
    if (versaoId) {
      await updateDoc(doc(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes/${versaoId}`), dados);
      return versaoId;
    }
    const novoId = novaVersaoId(musicaId);
    await criarVersao(musicaId, novoId, { ...dados, criadoPor: uid });
    return novoId;
  }

  const atualSnap = versaoId ? await getDoc(doc(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes/${versaoId}`)) : null;
  const atualDados = atualSnap?.exists() ? atualSnap.data() : null;
  const outraDados = outra.data();
  const usoPorCulto = { ...(outraDados.usoPorCulto || {}), ...(atualDados?.usoPorCulto || {}) };
  const tonsConhecidos = [...new Set([...(outraDados.tonsConhecidos || []), ...(atualDados?.tonsConhecidos || [])])];
  const tom = dados.tom || outraDados.tom || atualDados?.tom || "";

  await updateDoc(doc(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes/${outra.id}`), {
    ...dados, tom, usoPorCulto, tonsConhecidos,
  });
  if (versaoId && versaoId !== outra.id) {
    await updateDoc(doc(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes/${versaoId}`), { ativo: false });
  }
  return outra.id;
}

/** Ao trocar o tom de uma música já no repertório (SheetEditarTom,
 *  Repertorio.jsx), pedido do líder 2026-09: uma versão IMPESSOAL
 *  (nome que não bate com nenhum voluntário ativo — "Original",
 *  "Onda"…) só pode ter UM tom. Se o tom novo for diferente do que
 *  já lá está, não fica na versão impessoal — vai para a versão do
 *  Lead deste culto (reaproveitada se já existir, criada agora se
 *  não), a mesma lógica de "a versão É o cantor" que o Histórico já
 *  usa (ver pessoasParaAtribuir em functions/index.js). Se a versão
 *  em uso já É a de alguém (nome bate com um voluntário — mesmo que
 *  não seja o Lead, ex.: um back vocal), ou se este culto ainda não
 *  tem Lead definido, troca o tom nela mesma, como sempre foi — sem
 *  Lead pra atribuir, fica silencioso, não é erro (mesmo espírito de
 *  pessoasParaAtribuir). Devolve o versaoId onde o tom ficou —
 *  pode ser o mesmo que entrou, ou o (novo/existente) do Lead. */
export async function definirTomComRedirecionamento(musicaId, versaoId, novoTom, voluntarios, lead, uid) {
  const norm = (s) => (s || "").trim().toLowerCase();
  const ref = doc(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes/${versaoId}`);
  const snap = await getDoc(ref);
  const nomeAtual = (snap.data()?.nome || "").trim();
  const ehPessoal = (voluntarios || []).some((p) => norm(p.nome) === norm(nomeAtual));

  if (ehPessoal || !lead) {
    await updateDoc(ref, { tom: novoTom });
    return versaoId;
  }

  return versaoDoLeadComTom(musicaId, novoTom, lead, uid);
}

/** Versão do Lead com este tom — reaproveitada se já existir (só
 *  troca o tom), criada agora se não (mesma lógica de "a versão É o
 *  cantor" usada em definirTomComRedirecionamento acima). Usado
 *  também em "+ Adicionar Tom" ao escolher a versão para o
 *  Repertório (SheetVersaoParaRepertorio.jsx, pedido do líder,
 *  2026-09) — declarar um tom novo na hora já cria/atualiza a versão
 *  certa, sem precisar de ir à Biblioteca depois. */
export async function versaoDoLeadComTom(musicaId, tom, lead, uid) {
  const norm = (s) => (s || "").trim().toLowerCase();
  const versoesSnap = await getDocs(cVersoes(musicaId));
  const existente = versoesSnap.docs.find((d) => d.data().ativo !== false && norm(d.data().nome) === norm(lead.nome));
  if (existente) {
    await updateDoc(doc(db, `bases/${BASE_ID}/musicas/${musicaId}/versoes/${existente.id}`), { tom });
    return existente.id;
  }
  const novoId = novaVersaoId(musicaId);
  await criarVersao(musicaId, novoId, { nome: lead.nome, tom, criadoPor: uid });
  return novoId;
}

/* ── Deezer (Fase 1 — só a capa é automática) ──────────────── */
export const buscarCapaDeezer = (titulo, artista) =>
  chamar("buscarCapaDeezer")({ titulo, artista }).then((r) => r.data.resultados);

/** Baixa a capa escolhida, converte para WebP 250px e copia para o
 *  Storage — a própria função grava capaUrl/capaOrigem/deezerId/
 *  previewUrl no Firestore (ver functions/index.js). */
export const aplicarCapaDeezer = (musicaId, deezerId) =>
  chamar("processarCapaMusica")({ musicaId, deezerId }).then((r) => r.data);

/** O link de prévia do Deezer expira em poucas horas — nunca tocar
 *  direto o que estiver gravado (`previewUrl`/`preview`), pedir
 *  sempre um novo aqui pelo `deezerId` (esse não expira) na hora de
 *  tocar. Ver obterPreviaDeezer em functions/index.js. */
export const obterPreviaDeezer = (deezerId) =>
  chamar("obterPreviaDeezer")({ deezerId }).then((r) => r.data.preview);

/** Pesquisa só pelo nome e devolve vários candidatos já enriquecidos
 *  (capa, tom via Cifra Club, links de cifra/letra/áudio — sem BPM
 *  nesta camada, ver `resolverTomAudio` abaixo). Nunca falha por um
 *  candidato não se conseguir enriquecer — só vem com menos dados.
 *  `pagina` (0, 1, 2…) pede mais resultados do Deezer; devolve também
 *  `temMais`, para o "Ver mais" só aparecer quando faz sentido. */
export const pesquisarMusica = (nome, pagina = 0) =>
  chamar("pesquisarMusicaLouvor")({ nome, pagina }).then((r) => r.data);

/** Vídeo do YouTube só para a música escolhida (não em cada
 *  candidato da lista) — a cota diária da API é pequena demais para
 *  gastar em busca que talvez nem vire cadastro. Ver
 *  resolverVideoMusica em functions/index.js. */
export const resolverVideo = (titulo, artista) =>
  chamar("resolverVideoMusica")({ titulo, artista }).then((r) => r.data.video);

/** Tom e BPM por análise dos 30s de prévia do Deezer — só entra
 *  quando o Cifra Club não achou nada, e só para a música escolhida
 *  (nunca em lote pelos candidatos). Ver resolverTomAudioMusica em
 *  functions/index.js. */
export const resolverTomAudio = (deezerId, titulo, artista) =>
  chamar("resolverTomAudioMusica")({ deezerId, titulo, artista }).then((r) => r.data);
