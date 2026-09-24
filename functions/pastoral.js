/**
 * Painel Pastoral — o que a igreja vê por cima das 10 bases.
 *
 * Ficheiro próprio pela mesma razão do `kinder.js`: o `index.js` já
 * passou das 4500 linhas, e isto é um módulo com uma fronteira nítida
 * (ler muitas bases de uma vez, nunca escrever nelas).
 *
 * ── Porque é quase tudo Cloud Function, e não regras novas ──────
 *
 * O painel precisa de ler inventário, equipamentos, melhorias, wiki e
 * pessoas de TODAS as bases. Abrir isso nas `firestore.rules` obrigaria
 * a repetir `|| vejoTudoPastoral()` em ~15 blocos — quinze sítios novos
 * onde enganar-se, num ficheiro que faz deploy sozinho ao entrar na
 * `main`. O Admin SDK ignora as regras, por isso o agregador lê tudo
 * aqui e devolve só o resumo. As regras ganham duas linhas, não quinze:
 * `contactos` (o funil) e `estatisticasCulto` (o arquivo do culto), que
 * são listas a sério, não contagens, e teriam de vir paginadas por uma
 * função só para serem mostradas.
 *
 * O que JÁ era legível por qualquer pessoa autenticada não passa por
 * aqui de propósito — `eventos/{e}/checklist`, `eventos/{e}/contagem`,
 * `eventos/{e}/cultoAoVivo` e `bases/{b}` continuam a ser lidos pelo
 * cliente em `onSnapshot`. É o que faz o ecrã de domingo ser ao vivo:
 * uma função que devolve um retrato não substitui uma subscrição, e
 * chamá-la a cada toque de checkbox das 10 bases seria caro e lento
 * (o mesmo raciocínio já escrito em `checklistCrossBase`).
 *
 * ── O painel não decide nada ──────────────────────────────────
 *
 * Decisão do dono do produto, 2026-09: observa, não age. A única
 * escrita para fora daqui é o recado (`enviarRecadoPastoral`) — de
 * ida, sem resposta, dispensável pelo líder. Não aprova reembolsos,
 * não mexe em escalas, não marca checklists. O que o pastor publica
 * a sério — a ordem do culto — passa pela `publicarOrdemCulto` que já
 * existe, com a claim `pode_publicar_culto` que a Backstage já usa;
 * não há função nova para isso, de propósito.
 */
// região e CORS antes de qualquer onCall deste ficheiro (ver opcoes.js)
import "./opcoes.js";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import admin from "firebase-admin";
import { randomBytes, scryptSync } from "node:crypto";

const db = () => admin.firestore();

/** Ocorrências da Kinder (queda, febre — dados de saúde de menores)
 *  NUNCA entram em nada deste ficheiro. Decisão explícita do dono do
 *  produto ao desenhar o painel: é a categoria mais sensível do
 *  sistema, a líder da base já as trata, e um painel de observação
 *  não é motivo suficiente para as espalhar. Se um dia alguém
 *  acrescentar `ocorrencias` a `resumoDaBase`, está a desfazer uma
 *  decisão, não a completar um esquecimento. */

/** A capacidade nova: `bases/{b}.visaoPastoral == true` →
 *  `ve_tudo_pastoral` (ver claimsExtraDaBase em index.js). Mesmo
 *  mecanismo de `ve_todas_escalas` (Backstage) e `ve_todos_reembolsos`
 *  (Financeiro) — não há papel "admin_igreja" nenhum, é uma capacidade
 *  de base, como sempre (CLAUDE.md raiz, regra 4). */
function exigeVisaoPastoral(req) {
  if (req.auth?.token?.ve_tudo_pastoral !== true) {
    throw new HttpsError("permission-denied", "Este painel é da equipa pastoral.");
  }
  return req.auth.uid;
}

/** As bases ativas, por ordem alfabética — a mesma leitura que
 *  `escalasCrossBase`/`checklistCrossBase` já fazem. A própria base
 *  pastoral fica de fora de tudo o que é "as bases da igreja": não
 *  tem escala, nem checklist, nem inventário, e apareceria como uma
 *  linha permanentemente vazia em todos os ecrãs. */
async function basesDaIgreja() {
  const snap = await db().collection("bases").get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => b.ativa !== false && b.visaoPastoral !== true)
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt"));
}

const contar = (snap) => snap.size;

/** Quantos estão escalados num documento de escala — as duas formas
 *  que o repo usa (lista simples e lugares por ministério), a mesma
 *  deteção de `escalasCrossBase`. Extraído porque passou a ser
 *  precisa em três sítios (`resumoDaBase`, `desgastePastoral` e agora
 *  o "voluntários por culto" de `historicoPastoral`), não só um. */
function contarEscalados(d) {
  if (!d) return 0;
  return Array.isArray(d.lugares) && d.lugares.length
    ? d.lugares.filter((l) => l.titularId).length
    : (d.pessoas || []).length;
}

/** "Hoje" em Lisboa — mesmo cálculo de `hojeISOLisboa` em index.js,
 *  duplicado aqui em vez de importado (mesma convenção de mural.js:
 *  este ficheiro fica lido de ponta a ponta sem saltar para outro). */
const hojeISOLisboa = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());

/** O próximo culto a partir de hoje (ou hoje, se for domingo) — o
 *  mesmo "próximo culto" que qualquer ecrã do painel abre por
 *  omissão. `panoramaPastoral` chama isto quando ninguém pede um
 *  `eventoId` específico: sem isto, `escalaFeita` comparava sempre
 *  contra um evento nenhum (`eventoId: null`) e ficava `false` para
 *  as dez bases, sempre — bug real, nunca reparado por ninguém ter
 *  chamado esta função com um `eventoId` a sério. */
async function proximoEventoId() {
  const hoje = hojeISOLisboa();
  const snap = await db().collection("eventos")
    .where(admin.firestore.FieldPath.documentId(), ">=", hoje)
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(5)
    .get();
  const evento = snap.docs.find((d) => d.data().ativo !== false);
  return evento?.id ?? null;
}

/* ══════════════════════════════════════════════════════════════
 *  PANORAMA — uma chamada, o estado das 10 bases
 * ══════════════════════════════════════════════════════════════
 *
 * É a chamada mais cara do sistema (≈9 leituras por base), por isso
 * devolve CONTAGENS, não listas: o painel mostra "3 por aprovar", e
 * quem quer saber quais toca e vai ao detalhe. Devolver as listas
 * inteiras de 10 bases seria um payload de megabytes para desenhar
 * dez números.
 *
 * Exceção deliberada: avarias e itens em falta são só um punhado por
 * base (nunca o inventário inteiro), e "2 avariados" sem dizer QUAIS
 * obriga a abrir a app da base só para saber o quê — por isso essas
 * duas trazem também os nomes, não só a contagem.
 *
 * Cada bloco falha sozinho (`Promise.allSettled`): uma base sem a
 * coleção `melhorias` não pode tirar do ar o painel inteiro. Uma base
 * nova entra aqui sem tocar em nada — a lista sai de `bases/`, nunca
 * de uma lista fixa de nomes.
 */
async function resumoDaBase(b, eventoId) {
  const p = `bases/${b.id}`;
  const [
    pessoas, funcoes, inventario, melhorias,
    reembolsos, escala, wikiIndice,
  ] = await Promise.allSettled([
    db().collection(`${p}/pessoas`).where("ativo", "==", true).get(),
    db().collection(`${p}/funcoes`).where("ativa", "==", true).get(),
    db().collection(`${p}/inventario`).get(),
    db().collection(`${p}/melhorias`).get(),
    db().collection(`${p}/reembolsos`).get(),
    eventoId ? db().doc(`eventos/${eventoId}/escalas/${b.id}`).get() : Promise.resolve(null),
    db().doc(`wikiIndice/${b.id}`).get(),
  ]);

  const ok = (r) => (r.status === "fulfilled" ? r.value : null);
  const docs = (r) => (ok(r) ? ok(r).docs.map((d) => ({ id: d.id, ...d.data() })) : []);

  // ── inventário: uma coleção, dois modos. O que a Técnica e a
  // Louvor chamam "Equipamentos" vive em `bases/{b}/inventario`
  // também (ver refEquipamento em index.js — o nome da coleção é
  // `inventario`, não `equipamentos`); `bases/{b}/equipamentos` é
  // outra coisa, a custódia de dois aparelhos da Comunicação, e não
  // entra aqui. O campo `estado` é o que separa os dois modos: só o
  // item de património o tem, e só ele pode estar avariado.
  const itens = docs(inventario).filter((i) => i.ativo !== false);
  const patrimonio = itens.filter((i) => typeof i.estado === "string");
  const consumiveis = itens.filter((i) => typeof i.estado !== "string");

  const emFalta = consumiveis.filter((i) => typeof i.minimo === "number" && (i.quantidade ?? 0) <= i.minimo);
  // tudo o que não é "ok" conta como problema, para um estado novo
  // ("em reparação") não passar despercebido só por não estar numa
  // lista fixa escrita aqui
  const avariados = patrimonio.filter((i) => i.estado !== "ok");

  const melhoriasAtivas = docs(melhorias).filter((m) => m.ativo !== false && m.estado !== "resolvida");
  const pedidos = docs(reembolsos);
  // wikiIndice/{base} guarda `itens` (não `artigos`), e a dúvida traz
  // `resolvida` — derivada de `resolvidaPorRespostaId` em
  // atualizarIndiceWiki. Só as bases com Wiki têm este documento; as
  // outras caem no `{}` e ficam a zero, sem erro.
  const wiki = ok(wikiIndice)?.exists ? ok(wikiIndice).data() : {};
  const duvidasSemResposta = (wiki.itens || []).filter((a) => a.tipo === "duvida" && !a.resolvida).length;

  const e = ok(escala);
  const dadosEscala = e?.exists ? e.data() : null;
  const escalados = contarEscalados(dadosEscala);

  // o líder da base, a sério — para "Trocar líder" (Bases.jsx) mostrar
  // quem já é, sem mais uma chamada. Já estava na memória (a mesma
  // leitura de `pessoasAtivas` acima), só faltava procurar.
  const pessoasDocs = docs(pessoas);
  const liderDoc = pessoasDocs.find((p) => p.papel === "lider_base");
  const liderBase = liderDoc ? { id: liderDoc.id, nome: liderDoc.nome ?? liderDoc.id } : null;

  return {
    baseId: b.id,
    nome: b.nome ?? b.id,
    cor: b.cor ?? null,
    horaChegada: b.horaChegada ?? null,

    pessoasAtivas: ok(pessoas) ? contar(ok(pessoas)) : 0,
    funcoesAtivas: ok(funcoes) ? contar(ok(funcoes)) : 0,

    escalaFeita: escalados > 0,
    escalados,
    temLiderEscala: !!dadosEscala?.liderEscala,
    // `bases/{b}.semEscalaDeCulto` marca uma base que nunca serve no
    // culto de domingo (Financeiro, Pastoral) — sem isto, "sem escala"
    // ficava permanentemente vermelho para elas, todas as semanas, o
    // mesmo problema que o Financeiro já tinha antes deste painel
    // existir (reportado 2026-09: "nunca vai ter escala mesmo").
    escalaAplicavel: b.semEscalaDeCulto !== true,
    liderBase,

    inventarioTotal: consumiveis.length,
    inventarioEmFalta: emFalta.length,
    inventarioEmFaltaNomes: emFalta.map((i) => i.nome ?? i.id),
    equipamentosTotal: patrimonio.length,
    equipamentosAvariados: avariados.length,
    equipamentosAvariadosNomes: avariados.map((i) => i.nome ?? i.id),

    melhoriasAbertas: melhoriasAtivas.length,
    // "impede_culto" é a gravidade que para um domingo (ver GRAVIDADES
    // em index.js: impede_culto | atrapalha | melhoria) — é a única
    // que merece contagem própria no painel, e a única grave o
    // suficiente para valer a pena nomear (as "atrapalha"/"melhoria"
    // continuam só contagem — não param nenhum domingo)
    melhoriasGraves: melhoriasAtivas.filter((m) => m.gravidade === "impede_culto").length,
    melhoriasGravesNomes: melhoriasAtivas.filter((m) => m.gravidade === "impede_culto").map((m) => m.titulo ?? m.id),
    duvidasSemResposta,

    reembolsosPorAprovar: pedidos.filter((r) => r.estado === "submetido").length,
    reembolsosPorPagar: pedidos.filter((r) => r.estado === "aprovado").length,
  };
}

export const panoramaPastoral = onCall(async (req) => {
  exigeVisaoPastoral(req);
  const { eventoId } = req.data || {};
  const [bases, alvo] = await Promise.all([basesDaIgreja(), eventoId ? eventoId : proximoEventoId()]);
  const resumos = await Promise.all(bases.map((b) => resumoDaBase(b, alvo)));
  return { bases: resumos, eventoId: alvo, geradoEm: Date.now() };
});

/** Troca o líder de uma base — pedido 2026-09 ("um menu onde o pastor
 *  possa alterar os líderes de cada base"). É uma decisão nova do
 *  dono do produto: até aqui só o próprio líder trocava
 *  (`editarVoluntario`, functions/index.js) — essa função só mexe na
 *  base de quem chama (`baseId` sai do TOKEN, nunca de um parâmetro,
 *  regra 4 do CLAUDE.md raiz), por isso não serve para o pastor mudar
 *  o líder de uma base onde ele próprio não está. Esta é a exceção:
 *  `baseId` entra como argumento, protegida por `ve_tudo_pastoral` em
 *  vez de "sou desta base". Mesmo invariante de sempre — só um líder
 *  de cada vez, promover alguém demove quem lá estava para
 *  "voluntario". */
export const definirLiderBase = onCall(async (req) => {
  exigeVisaoPastoral(req);
  const { baseId, pessoaId } = req.data || {};
  if (!baseId || !pessoaId) throw new HttpsError("invalid-argument", "Falta a base ou a pessoa.");

  const base = await db().doc(`bases/${baseId}`).get();
  if (!base.exists || base.data().ativa === false) throw new HttpsError("not-found", "Base desconhecida.");
  if (base.data().visaoPastoral === true) throw new HttpsError("invalid-argument", "A base pastoral não tem líder de base.");

  const ref = db().doc(`bases/${baseId}/pessoas/${pessoaId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data().ativo === false) {
    throw new HttpsError("not-found", "Pessoa não encontrada ou inativa nesta base.");
  }

  const outros = await db().collection(`bases/${baseId}/pessoas`).where("papel", "==", "lider_base").get();
  const lote = db().batch();
  outros.forEach((d) => { if (d.id !== pessoaId) lote.update(d.ref, { papel: "voluntario" }); });
  lote.update(ref, { papel: "lider_base" });
  await lote.commit();

  return { ok: true };
});

/* ══════════════════════════════════════════════════════════════
 *  PESSOAS — quem serve na igreja toda, e quem serve em duas bases
 * ══════════════════════════════════════════════════════════════
 *
 * `pessoas/{uid}` (global) tem o mapa `bases` — é de lá que sai o
 * multi-base, sem cruzar dez listas à mão. O nome e a foto vêm de lá
 * também; o telefone e o papel são de `bases/{b}/pessoas` (é lá que
 * vivem, por base) e por isso vêm da base onde a pessoa serve.
 *
 * Devolve a lista toda, não contagens: são ~150 pessoas, cabe numa
 * chamada, e o ecrã precisa de nomes para a lista de quem serve em
 * mais do que uma base valer alguma coisa.
 */
export const pessoasPastoral = onCall(async (req) => {
  exigeVisaoPastoral(req);
  const bases = await basesDaIgreja();

  const porBase = await Promise.all(bases.map(async (b) => {
    const snap = await db().collection(`bases/${b.id}/pessoas`).get();
    return {
      baseId: b.id, nome: b.nome ?? b.id, cor: b.cor ?? null,
      pessoas: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }));

  // junta por pessoa: uma linha por ser humano, com as bases onde
  // serve. O uid é o mesmo em todas as bases (identidade global,
  // regra 2 do CLAUDE.md raiz) — é isso que torna isto possível.
  const pessoas = new Map();
  for (const { baseId, nome: nomeBase, cor, pessoas: lista } of porBase) {
    for (const p of lista) {
      if (!pessoas.has(p.id)) {
        pessoas.set(p.id, {
          id: p.id, nome: p.nome, foto: p.foto ?? null,
          telefone: p.telefone ?? "", bases: [],
        });
      }
      const registo = pessoas.get(p.id);
      registo.bases.push({
        baseId, nome: nomeBase, cor, papel: p.papel ?? "voluntario", ativo: p.ativo !== false,
        // sala fixa da Kinder (baby/fun/junior) — null em qualquer
        // outra base, que não tem este campo (pedido 2026-09: mostrar
        // em qual sala cada líder/auxiliar da Kinder serve).
        categoria: p.categoria ?? null,
      });
      // o telefone pode estar preenchido numa base e vazio noutra —
      // fica o primeiro que exista, em vez de o último a ser lido
      if (!registo.telefone && p.telefone) registo.telefone = p.telefone;
      if (!registo.foto && p.foto) registo.foto = p.foto;
    }
  }

  return {
    pessoas: [...pessoas.values()].sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt")),
    bases: bases.map((b) => ({ baseId: b.id, nome: b.nome ?? b.id, cor: b.cor ?? null })),
  };
});

/* ══════════════════════════════════════════════════════════════
 *  PATRIMÓNIO — o que a igreja tem, somado
 * ══════════════════════════════════════════════════════════════
 *
 * `bases/{b}/inventario` guarda os dois modos que o repo usa, e o
 * campo `estado` é o que os separa: item de património (um item = uma
 * coisa, com estado e valor de compra — o que a Técnica e a Louvor
 * chamam "Equipamentos") ou consumível (quantidade em stock, com
 * mínimo — o que a Apoio e a Pessoal chamam "Inventário"). Sai daqui
 * achatado numa lista só, cada item com `modo`, para o ecrã somar
 * valor e mostrar avarias sem precisar de saber que base usa qual.
 *
 * `valorCompra` é opcional e em CÊNTIMOS, como tudo o que é dinheiro
 * neste repo (ver o Financeiro) — somar euros em vírgula flutuante dá
 * respostas que não fecham.
 *
 * `bases/{b}/equipamentos` (a custódia de dois aparelhos da
 * Comunicação: quem está com cada um) fica de fora — não é património
 * a somar, é um estado de "com quem está", e misturar as duas coisas
 * numa lista de valor só daria um total errado.
 */
export const patrimonioPastoral = onCall(async (req) => {
  exigeVisaoPastoral(req);
  const bases = await basesDaIgreja();

  const porBase = await Promise.all(bases.map(async (b) => {
    const snap = await db().collection(`bases/${b.id}/inventario`).get().catch(() => null);
    const itens = (snap?.docs ?? [])
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((i) => i.ativo !== false)
      .map((i) => ({
        id: i.id,
        modo: typeof i.estado === "string" ? "patrimonio" : "consumivel",
        nome: i.nome ?? "(sem nome)",
        estado: i.estado ?? null,
        quantidade: typeof i.quantidade === "number" ? i.quantidade : null,
        minimo: typeof i.minimo === "number" ? i.minimo : null,
        unidade: i.unidade ?? null,
        categoria: i.categoria ?? null,
        local: i.local ?? null,
        tipo: i.tipo ?? null,
        valorCompra: typeof i.valorCompra === "number" ? i.valorCompra : null,
      }));

    return { baseId: b.id, nome: b.nome ?? b.id, cor: b.cor ?? null, itens };
  }));

  return { bases: porBase };
});

/* ══════════════════════════════════════════════════════════════
 *  HISTÓRICO — os números que viram gráfico
 * ══════════════════════════════════════════════════════════════
 *
 * Um só pedido para o ecrã de Números, com uma janela de datas: a
 * contagem de presentes (Base Pessoal), a oferta contada (Financeiro),
 * e o culto previsto vs. real (`estatisticasCulto`, gravado ao
 * finalizar o culto ao vivo — o arquivo que estava à espera deste
 * painel desde que foi escrito).
 *
 * A janela é obrigatória e limitada a 3 anos: sem limite, um painel
 * aberto uma vez por mês passa a ler o histórico inteiro da igreja a
 * cada abertura.
 */
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const historicoPastoral = onCall(async (req) => {
  exigeVisaoPastoral(req);
  const { desde, ate } = req.data || {};
  if (!ISO.test(String(desde || "")) || !ISO.test(String(ate || ""))) {
    throw new HttpsError("invalid-argument", "Período inválido.");
  }
  if (desde > ate) throw new HttpsError("invalid-argument", "O período está ao contrário.");
  const anos = (new Date(ate) - new Date(desde)) / (365 * 24 * 3600 * 1000);
  if (anos > 3) throw new HttpsError("invalid-argument", "No máximo 3 anos de cada vez.");

  // `eventos/{AAAA-MM-DD}` — o id é a data, por isso o intervalo é
  // pelo id do documento e não precisa de índice nenhum.
  const eventosSnap = await db().collection("eventos")
    .where(admin.firestore.FieldPath.documentId(), ">=", desde)
    .where(admin.firestore.FieldPath.documentId(), "<=", ate)
    .get();

  const eventos = eventosSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => e.ativo !== false)
    .sort((a, b) => a.id.localeCompare(b.id));

  // as dez bases, para contar voluntários por culto — a mesma lista
  // que `panoramaPastoral`/`desgastePastoral` já buscam, só que aqui
  // uma vez só para a janela inteira, não por culto
  const bases = await basesDaIgreja();

  // visitantes CADASTRADOS no Formulário da Base Pessoal (contactos,
  // `eventoId` = o culto onde chegaram — regra 7 do CLAUDE.md raiz),
  // não a contagem manual de bulto (`contagem.visitantes`, já lida
  // abaixo). Pedido 2026-09: um gráfico complementar em Números, com o
  // mesmo universo que "Pessoas → Visitantes" já mostra — por isso
  // exclui arquivados, o mesmo filtro de `ouvirContactos`. Uma
  // chamada só para a janela inteira, como a oferta mais abaixo.
  const contactosSnap = await db().collection("contactos")
    .where("eventoId", ">=", desde).where("eventoId", "<=", ate).get();
  const cadastradosPorEvento = new Map();
  for (const doc of contactosSnap.docs) {
    const d = doc.data();
    if (d.arquivado === true || !d.eventoId) continue;
    cadastradosPorEvento.set(d.eventoId, (cadastradosPorEvento.get(d.eventoId) ?? 0) + 1);
  }

  const detalhes = await Promise.all(eventos.map(async (e) => {
    const [contagem, estatisticas, acomodacao, mapaAoVivo, kinder, escalas] = await Promise.allSettled([
      db().doc(`eventos/${e.id}/contagem/geral`).get(),
      db().doc(`eventos/${e.id}/estatisticasCulto/registo`).get(),
      // O resumo do mapa do auditório, fechado pela Base Pessoal no fim
      // de cada culto. Está gravado desde 2026-09 com um comentário a
      // dizer que era "o que vai alimentar o mapa de calor do painel do
      // pastor mais tarde" (ResumosAcomodacao.jsx) — é aqui.
      db().doc(`bases/pessoal/acomodacaoResumos/${e.id}`).get(),
      // O mapa AO VIVO, fechado ou não — pedido explícito (2026-09):
      // "alguém preencheu mas não salvou/fechou, azar dela, os números
      // vão pros painéis da mesma forma". Sem fecho, `resumoAcomodacao`
      // nunca corre (só `fecharAcomodacao` a chama), por isso a conta
      // sobre `lugares` é refeita aqui — ver `resumoAcomodacaoAoVivo`.
      db().doc(`eventos/${e.id}/acomodacao/mapa`).get(),
      // O check-in a sério da Kinder, para cruzar com as salas que a
      // Pessoal preenche à mão. `select` porque só interessam dois
      // campos: a leitura continua a ser um documento por criança
      // (~50 por culto), mas o payload fica mínimo.
      db().collection(`eventos/${e.id}/checkinKinder`).select("categoria", "anulado").get(),
      // Quantos foram escalados neste culto, nas dez bases — o gráfico
      // "Voluntários por culto" pedido em 2026-09. `allSettled`
      // dentro de `allSettled`: uma leitura falhada (rede, o que for)
      // não pode zerar o culto inteiro — antes, uma só base a falhar
      // fazia o Promise.all rejeitar tudo, e o domingo desaparecia do
      // gráfico sem ninguém perceber porquê (reportado 2026-09: "falta
      // as informações dos outros cultos").
      Promise.allSettled(bases.map((b) => db().doc(`eventos/${e.id}/escalas/${b.id}`).get())),
    ]);
    const ok = (r) => (r.status === "fulfilled" && r.value?.exists ? r.value.data() : null);
    const c = ok(contagem);
    const s = ok(estatisticas);
    const a = ok(acomodacao);
    const mapa = ok(mapaAoVivo);
    const voluntarios = escalas.status === "fulfilled"
      ? escalas.value.reduce((t, r) => t + (r.status === "fulfilled" && r.value.exists ? contarEscalados(r.value.data()) : 0), 0)
      : 0;

    return {
      eventoId: e.id,
      data: e.data ?? e.id,
      tipo: e.tipo ?? null,
      tipoCulto: e.tipoCulto ?? null,
      ordemPublicada: !!e.ordem,
      // a contagem da Pessoal é um mapa de categorias → número; o
      // total é a soma, e não um campo gravado (foi assim que nasceu)
      contagem: c ? resumirContagem(c) : null,
      culto: s ? resumirCulto(s) : null,
      // fechado primeiro (é a fonte oficial, já com fechadoEm/fechadoPor);
      // sem fecho, calcula-se em cima do mapa ao vivo — nunca os dois
      acomodacao: a ? resumirAcomodacao(a) : (mapa?.lugares ? resumoAcomodacaoAoVivo(mapa.lugares) : null),
      kinder: kinder.status === "fulfilled" ? resumirKinder(kinder.value) : null,
      voluntarios,
      visitantesCadastrados: cadastradosPorEvento.get(e.id) ?? 0,
    };
  }));

  // oferta: vive em bases/financeiro/contagensOferta, com `data` no
  // mesmo formato do id do evento — por isso cruza sem chave estrangeira
  // (débito consciente já registado no CLAUDE.md do Financeiro).
  const ofertaSnap = await db().collection("bases/financeiro/contagensOferta")
    .where("data", ">=", desde).where("data", "<=", ate).get();
  const oferta = ofertaSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .map((o) => ({ data: o.data, total: o.total ?? 0 }))
    .sort((a, b) => a.data.localeCompare(b.data));

  return { cultos: detalhes, oferta };
});

/** A contagem da Pessoal guarda `categorias.{id} = {valor, origem,
 *  preenchidoPor, preenchidoEm}` — categorias que, de propósito, NÃO
 *  formam um total (ver o comentário no topo de
 *  apps/pessoal/src/lib/contagem.js: cada uma tem o significado que já
 *  tinha no relatório do culto em papel).
 *
 *  "Membros" saiu do catálogo (pedido 2026-09: sem padrão de
 *  preenchimento a sério, ninguém contava) — `auditorio` (o que
 *  alimenta "Presença na igreja" em Números) passa a somar só
 *  visitantes+voluntários. `juniorFun` virou `junior`/`fun`
 *  separados, no mesmo lote em que passam a `origem: "automatica"`
 *  (painéis das salas — Kinder/SHIFT/New).
 *
 *  `valor: null` é "por contar", diferente de zero — e um culto com
 *  metade das categorias por contar não pode aparecer no gráfico como
 *  um domingo fraco. Daí `finalizada`: só a contagem que a Pessoal
 *  marcou como terminada entra nas tendências. */
const AUDITORIO = ["visitantes", "voluntarios"];
const SALAS = ["new", "shift", "junior", "fun", "baby"];

function resumirContagem(c) {
  const cats = c.categorias || {};
  const valor = (id) => {
    const v = cats[id]?.valor;
    return typeof v === "number" ? v : null;
  };
  const somar = (ids) => {
    const nums = ids.map(valor).filter((n) => n !== null);
    return nums.length ? nums.reduce((t, n) => t + n, 0) : null;
  };

  return {
    finalizada: !!c.finalizadoEm,
    auditorio: somar(AUDITORIO),
    salas: somar(SALAS),
    visitantes: valor("visitantes"),
    voluntarios: valor("voluntarios"),
    apelo: valor("apelo"),
    // as salas uma a uma, para o painel poder cruzar as três que a
    // Kinder conta (baby/fun/junior) com o check-in dela, sem somar a
    // New e a SHIFT — que têm sala própria e nunca passam pelo
    // check-in da Kinder, e fariam a comparação nunca bater certo
    new: valor("new"),
    shift: valor("shift"),
    junior: valor("junior"),
    fun: valor("fun"),
    baby: valor("baby"),
  };
}

/** O mapa do auditório, FECHADO no fim do culto pela Base Pessoal.
 *  `percentagem` já vem calculada de lá (`resumoAcomodacao`,
 *  index.js) sobre a capacidade ÚTIL — lugares totais menos os
 *  reservados e os bloqueados. Não se recalcula aqui: seria a mesma
 *  conta em dois sítios, a divergir no dia em que um mudasse. */
function resumirAcomodacao(a) {
  return {
    ocupados: a.ocupados ?? 0,
    visitantes: a.visitantes ?? 0,
    livres: a.livres ?? 0,
    reservados: a.reservados ?? 0,
    bloqueados: a.bloqueados ?? 0,
    capacidadeUtil: a.capacidadeUtil ?? 0,
    percentagem: a.percentagem ?? 0,
  };
}

/** A mesma conta de `resumoAcomodacao` (functions/index.js), para um
 *  mapa que ainda NÃO foi fechado — sem `fechadoEm`/`fechadoPor`, que
 *  só fazem sentido num fecho a sério. Duplicada, não importada: as
 *  duas versões calculam a mesma coisa a partir de `lugares`, e uma
 *  função interna do `index.js` não está exportada — repetir dez
 *  linhas aqui é mais simples do que abrir uma exportação só para
 *  isto. Pedido explícito (2026-09): "azar dela" — quem preencheu o
 *  mapa mas não fechou não deve sumir das estatísticas por isso. */
function resumoAcomodacaoAoVivo(lugares) {
  const contagem = { livre: 0, ocupado: 0, visitante: 0, reservado: 0, bloqueado: 0 };
  Object.values(lugares).forEach((estado) => { if (estado in contagem) contagem[estado]++; });
  const ocupados = contagem.ocupado + contagem.visitante;
  const capacidadeUtil = Object.keys(lugares).length - contagem.reservado - contagem.bloqueado;
  return {
    ocupados: contagem.ocupado,
    visitantes: contagem.visitante,
    livres: contagem.livre,
    reservados: contagem.reservado,
    bloqueados: contagem.bloqueado,
    capacidadeUtil,
    percentagem: capacidadeUtil ? ocupados / capacidadeUtil : 0,
  };
}

/** O check-in da Kinder, por sala. `anulado` é um check-in desfeito
 *  (engano à porta), não uma criança que saiu — a saída tem campo
 *  próprio (`saidaEm`) e continua a contar como "esteve cá", que é o
 *  que interessa para comparar com uma contagem de presenças. */
function resumirKinder(snap) {
  const contagem = { baby: 0, fun: 0, junior: 0 };
  let total = 0;
  snap.forEach((d) => {
    const k = d.data();
    if (k.anulado === true) return;
    total++;
    if (k.categoria in contagem) contagem[k.categoria]++;
  });
  return { total, ...contagem };
}

/** Previsto (o que a ordem do culto dizia) vs. real (o que o FreeShow
 *  registou ao vivo) — a conta que `arquivarCultoTerminado` deixou por
 *  fazer de propósito ("ficam para quando esse painel existir").
 *
 *  Cada secção real só tem `horaReal` ("10:34"), a hora a que
 *  COMEÇOU — nenhuma tem hora de fim gravada. Por isso duas perguntas
 *  diferentes precisam de duas contas diferentes:
 *
 *  - "Quando isto acabou, já íamos com quanto atraso?" (`atrasoFinal`,
 *    "No fim" no ecrã) é sobre a hora de relógio: a entrada do último
 *    momento que foi ao ar, comparada com a hora a que devia ter
 *    começado.
 *  - "Que bloco é que comeu o tempo todo?" (`atrasos[].atraso`, o
 *    "gargalo") NÃO pode ser a mesma conta — um momento que começa
 *    tarde porque o anterior se alongou não é ele que está atrasado, é
 *    o anterior. Por isso é a diferença entre quanto o bloco DUROU a
 *    sério e quanto devia durar (`minutos`, escrito na ordem) —
 *    reportado 2026-09 ("Atraso é a diferença de tempo que durou o
 *    bloco real, do tempo previsto, não a hora que terminou").
 *
 *    A duração real vem da ORDEM CRONOLÓGICA a sério
 *    (`timestampReal`, em milissegundos — não `horaReal`, que só tem
 *    o minuto), não da ordem PREVISTA: o mesmo raciocínio de
 *    `cruzarComReal` (@portal/shared/lib/ordemAoVivo.js), porque o que
 *    foi ao ar pode não bater com o que estava escrito (um vídeo
 *    extra, uma troca de ordem ao vivo). Contar pela ordem prevista
 *    juntava a duração ao momento errado sempre que isso acontecia —
 *    reportado 2026-09 ("os tempos previstos estão contados errado").
 *    O último momento a ir ao ar fecha contra `finalizadoEm` (o clique
 *    em "Finalizar culto", a única hora de fim que existe em todo o
 *    sistema) em vez de ficar sem duração — sem isto, o que por acaso
 *    fecha o culto (quase sempre Mensagem ou Apelo) nunca tinha atraso
 *    nenhum e desaparecia da lista ("as categorias só mostra 4").
 *
 *  Corrigir um bloco (`corrigirDuracaoSecaoCulto`) grava
 *  `duracaoCorrigidaMin` NA PRÓPRIA secção — sobrepõe-se ao cálculo
 *  cronológico para aquele momento, sempre. É de propósito uma
 *  correção de DURAÇÃO, não de hora de relógio: a primeira versão
 *  desta função deixava corrigir a hora de entrada, mas isso é a
 *  pergunta errada — reportado 2026-09 ("a correção está para a hora
 *  do relógio, mas precisa ser para a duração do bloco"). Ninguém
 *  sabe de cor a que horas um momento entrou; sabe quanto tempo durou.
 *
 *  Casa por nome normalizado, o mesmo critério de `cruzarComReal`
 *  (@portal/shared/lib/ordemAoVivo.js) e de `normalizarNome` em
 *  freeshow.js — repetido aqui em três linhas porque as Functions não
 *  importam de `packages/shared` (não entra no bundle do deploy). */
const chaveNome = (s) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

const emMinutos = (hora) => {
  if (!/^\d{1,2}:\d{2}$/.test(String(hora || ""))) return null;
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

function resumirCulto(s) {
  const reais = Array.isArray(s.secoesReais) ? s.secoesReais : [];
  const previstos = Array.isArray(s.momentosPrevistos) ? s.momentosPrevistos : [];

  // primeira ocorrência de cada nome = a vez que entrou ao ar
  const porNome = new Map();
  for (const sec of reais) {
    const k = chaveNome(sec.nomeCorrespondente || sec.nomeFreeshow);
    if (k && !porNome.has(k)) porNome.set(k, sec);
  }

  // a duração real de cada momento, pela ordem em que foi ao ar de
  // verdade (timestampReal, ms) — não pela ordem prevista
  const cronologico = [...porNome.values()]
    .filter((sec) => typeof sec.timestampReal?.toMillis === "function")
    .sort((a, b) => a.timestampReal.toMillis() - b.timestampReal.toMillis());

  const fimDoCultoMs = typeof s.finalizadoEm?.toMillis === "function" ? s.finalizadoEm.toMillis() : null;
  const duracaoMsPorChave = new Map();
  for (let i = 0; i < cronologico.length; i++) {
    const atual = cronologico[i];
    const fimMs = i + 1 < cronologico.length ? cronologico[i + 1].timestampReal.toMillis() : fimDoCultoMs;
    if (fimMs === null) continue;
    const ms = fimMs - atual.timestampReal.toMillis();
    if (ms >= 0) duracaoMsPorChave.set(chaveNome(atual.nomeCorrespondente || atual.nomeFreeshow), ms);
  }
  // a correção manual (`corrigirDuracaoSecaoCulto`) ganha sempre ao
  // cálculo automático, para o momento que foi corrigido — inclusive
  // quando o automático não tinha conseguido calcular nada (o último
  // momento do culto, por exemplo)
  for (const [chave, sec] of porNome) {
    if (typeof sec.duracaoCorrigidaMin === "number") duracaoMsPorChave.set(chave, sec.duracaoCorrigidaMin * 60000);
  }

  // casados, na ordem prevista — é a partir desta lista que se conta o
  // desvio de relógio ("No fim"); a duração de cada bloco vem do mapa
  // cronológico acima, não desta lista
  const casados = previstos
    .map((m) => {
      const real = porNome.get(chaveNome(m.momento));
      if (!real) return null;
      const previstoMin = emMinutos(m.hora);
      const realMin = emMinutos(real.horaReal);
      if (previstoMin === null || realMin === null) return null;
      return {
        momento: m.momento, previstoHora: m.hora, realHora: real.horaReal,
        previstoMin, realMin, duracaoPrevista: Number(m.minutos) || null,
      };
    })
    .filter(Boolean);

  const atrasos = casados.map((m) => {
    const duracaoMs = duracaoMsPorChave.get(chaveNome(m.momento));
    const duracaoReal = duracaoMs !== undefined ? Math.round(duracaoMs / 60000) : null;
    const atraso = (duracaoReal !== null && m.duracaoPrevista !== null) ? duracaoReal - m.duracaoPrevista : null;
    return {
      momento: m.momento, previsto: m.previstoHora, real: m.realHora,
      duracaoPrevista: m.duracaoPrevista, duracaoReal, atraso,
    };
  });

  const comAtraso = atrasos.filter((a) => a.atraso !== null);
  const gargalo = comAtraso.length
    ? comAtraso.reduce((pior, a) => (a.atraso > pior.atraso ? a : pior))
    : null;

  const correspondidos = new Set(previstos.map((m) => chaveNome(m.momento)));

  return {
    // a duração prevista é bem definida (está escrita na ordem); a
    // real não existe para todos, e é por isso que não vem aqui um par
    minutosPrevistos: previstos.reduce((t, m) => t + (Number(m.minutos) || 0), 0),
    atrasos,
    atrasoFinal: casados.length ? casados.at(-1).realMin - casados.at(-1).previstoMin : null,
    // o momento que mais comeu o tempo do culto, e quanto — a última
    // linha do "O culto começa a horas?" (ver Numeros.jsx)
    gargalo: gargalo ? { momento: gargalo.momento, atraso: gargalo.atraso } : null,
    momentosPrevistos: previstos.length,
    // momentos que o culto nunca chegou a pôr no ar, e secções que
    // foram ao ar sem estarem na ordem — as duas coisas dizem algo
    // sobre o domingo, e nenhuma aparece em lado nenhum hoje
    naoRealizados: previstos.filter((m) => !porNome.has(chaveNome(m.momento))).length,
    extras: [...porNome.keys()].filter((k) => !correspondidos.has(k)).length,
  };
}

/** Corrige a duração de um momento de um culto JÁ FECHADO — pedido
 *  explícito (2026-09: "os tempos agora marcam certos, mas preciso de
 *  poder editar tempos de cultos já fechados. Onde faço isso?", depois
 *  ajustado: "a correção está para a hora do relógio, mas precisa ser
 *  para a duração do bloco"). Não existia caminho nenhum para isto:
 *  `editarSecaoAoVivo` (functions/index.js) só mexe em
 *  `cultoAoVivo/registo`, o rascunho ao vivo — depois de "Finalizar
 *  culto" copiar tudo para `estatisticasCulto/registo`
 *  (`arquivarCultoTerminado`), esse rascunho já não é lido por nada, e
 *  o arquivo ficava congelado para sempre, erro incluído.
 *
 *  Grava só `duracaoCorrigidaMin` na secção — não mexe em `horaReal`
 *  nem em `timestampReal` (ninguém sabe de cor a que horas um momento
 *  entrou; sabe quanto tempo durou). `resumirCulto` lê este campo e
 *  sobrepõe-se sempre ao cálculo automático para aquele momento.
 *
 *  Só a equipa pastoral corrige — nenhuma base tem tela para isto, e
 *  não faria sentido dar-lhes: o arquivo é só lido por este painel. */
export const corrigirDuracaoSecaoCulto = onCall(async (req) => {
  const uid = exigeVisaoPastoral(req);
  const { eventoId, nome, duracaoMin } = req.data || {};
  const duracao = Number(duracaoMin);
  if (!eventoId || !String(nome || "").trim() || !Number.isFinite(duracao) || duracao < 0 || duracao > 600) {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }

  const ref = db().doc(`eventos/${eventoId}/estatisticasCulto/registo`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Este culto ainda não foi finalizado ao vivo.");

  const secoes = snap.data().secoesReais || [];
  const chave = chaveNome(nome);
  const i = secoes.findIndex((sec) => chaveNome(sec.nomeCorrespondente || sec.nomeFreeshow) === chave);
  if (i < 0) throw new HttpsError("not-found", "Este momento não está registado neste culto.");

  const corrigida = {
    ...secoes[i],
    duracaoCorrigidaMin: duracao,
    corrigidoManualmente: true,
    corrigidoPor: uid,
    // Timestamp.now(), nunca FieldValue.serverTimestamp() aqui: esta
    // secção é um ELEMENTO de um array (`secoesReais`) gravado por
    // inteiro, e o Firestore recusa um sentinel `serverTimestamp()`
    // dentro de um array — lança já na escrita ("cannot be used inside
    // an array"), sem entrar em nenhum try/catch daqui (era a causa
    // real do 500 "internal" reportado 2026-09 ao corrigir a duração —
    // nada a ver com o bug dos exports em falta, esse já corrigido).
    // `Timestamp.now()` é um valor a sério, não um sentinel: escreve
    // dentro de um array sem problema nenhum.
    corrigidoEm: admin.firestore.Timestamp.now(),
  };
  await ref.set({ secoesReais: secoes.with(i, corrigida) }, { merge: true });
  return { ok: true };
});

/* ══════════════════════════════════════════════════════════════
 *  DESGASTE — quem está a servir domingo sim, domingo sim
 * ══════════════════════════════════════════════════════════════
 *
 * A pergunta que nenhuma base consegue fazer sozinha, por
 * construção: o líder da Apoio vê que a Joana serviu 4 dos últimos 8
 * domingos dele e acha pouco; o da Kinder vê os outros 4 e acha o
 * mesmo. Ninguém vê os 8.
 *
 * O sistema já IMPEDE escalar a mesma pessoa em duas bases no mesmo
 * culto (`eventos/{e}/indisponibilidades`) — o que nunca fez foi
 * mostrar quem está a carregar dois compromissos em semanas
 * alternadas, que é onde as pessoas se gastam sem ninguém reparar.
 *
 * Conta CULTOS, não escalas: servir em duas bases no mesmo domingo é
 * um domingo, não dois. Quem serve nas duas está lá o dia inteiro, e
 * contar 2 daria a essa pessoa um número maior do que os domingos que
 * existem no período — o que faria a lista parecer avariada em vez de
 * grave.
 *
 * Lê as duas formas de escala do repo, a mesma deteção de
 * `escalasCrossBase`: lista simples (`pessoas[]`) e lugares por
 * ministério (`lugares[]`, titular e aprendiz contam os dois — um
 * aprendiz está lá o culto todo).
 */
export const desgastePastoral = onCall(async (req) => {
  exigeVisaoPastoral(req);
  const { desde, ate } = req.data || {};
  if (!ISO.test(String(desde || "")) || !ISO.test(String(ate || ""))) {
    throw new HttpsError("invalid-argument", "Período inválido.");
  }
  if (desde > ate) throw new HttpsError("invalid-argument", "O período está ao contrário.");

  const bases = await basesDaIgreja();
  const eventosSnap = await db().collection("eventos")
    .where(admin.firestore.FieldPath.documentId(), ">=", desde)
    .where(admin.firestore.FieldPath.documentId(), "<=", ate)
    .get();

  const eventos = eventosSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((e) => e.ativo !== false)
    .sort((a, b) => a.id.localeCompare(b.id));

  // uid → { cultos: Set, bases: Set }. O Set de cultos é o que faz
  // "duas bases no mesmo domingo" contar uma vez só.
  const porPessoa = new Map();
  const registar = (uid, eventoId, baseId) => {
    if (!uid) return;
    if (!porPessoa.has(uid)) porPessoa.set(uid, { cultos: new Set(), bases: new Set() });
    const p = porPessoa.get(uid);
    p.cultos.add(eventoId);
    p.bases.add(baseId);
  };

  await Promise.all(eventos.map(async (e) => {
    const escalas = await Promise.all(bases.map((b) =>
      db().doc(`eventos/${e.id}/escalas/${b.id}`).get().catch(() => null)));
    escalas.forEach((snap, i) => {
      if (!snap?.exists) return;
      const d = snap.data();
      const baseId = bases[i].id;
      if (Array.isArray(d.lugares) && d.lugares.length) {
        for (const l of d.lugares) {
          registar(l.titularId, e.id, baseId);
          registar(l.aprendizId, e.id, baseId);
        }
      } else {
        for (const uid of d.pessoas || []) registar(uid, e.id, baseId);
      }
    });
  }));

  // o nome e a foto vêm de pessoas/{uid} (global) — nunca de
  // bases/{b}/pessoas de uma base específica, que daria nomes
  // diferentes conforme a base por onde se entrasse primeiro. O
  // telefone é só por base (mesmo motivo de pessoasPastoral acima);
  // como já sabemos em que bases cada pessoa serviu (`p.bases`), basta
  // ler UMA delas — a primeira em que apareceu — para conseguir
  // "Falar por WhatsApp" sem multiplicar leituras por base servida.
  const uids = [...porPessoa.keys()];
  const globais = await Promise.all(uids.map((u) => db().doc(`pessoas/${u}`).get().catch(() => null)));
  const infoDe = Object.fromEntries(
    globais.filter((s) => s?.exists).map((s) => [s.id, { nome: s.data().nome ?? null, foto: s.data().foto ?? null }]));
  const telefones = await Promise.all(uids.map((uid) => {
    const primeiraBase = [...porPessoa.get(uid).bases][0];
    return db().doc(`bases/${primeiraBase}/pessoas/${uid}`).get().catch(() => null);
  }));
  const telefoneDe = Object.fromEntries(
    uids.map((uid, i) => [uid, telefones[i]?.exists ? (telefones[i].data().telefone ?? "") : ""]));

  const nomeBase = Object.fromEntries(bases.map((b) => [b.id, b.nome ?? b.id]));

  const pessoas = uids.map((uid) => {
    const p = porPessoa.get(uid);
    return {
      uid,
      nome: infoDe[uid]?.nome ?? null,
      foto: infoDe[uid]?.foto ?? null,
      telefone: telefoneDe[uid] ?? "",
      cultos: p.cultos.size,
      // eventoId JÁ é a data (eventos/{AAAA-MM-DD}, regra 7 do CLAUDE.md
      // raiz) — o Set de cultos é, sem mais nada, o Set de datas.
      // Serve para comprovar o número ao tocar na pessoa.
      datas: [...p.cultos].sort(),
      bases: [...p.bases].map((b) => ({ baseId: b, nome: nomeBase[b] ?? b })),
    };
  })
    .filter((p) => p.nome)          // o uid "dev-admin" nunca existe em pessoas/{uid}
    .sort((a, b) => b.cultos - a.cultos || (a.nome || "").localeCompare(b.nome || "", "pt"));

  return { pessoas, totalCultos: eventos.length };
});

/* ══════════════════════════════════════════════════════════════
 *  FUNIL DE VISITANTES
 * ══════════════════════════════════════════════════════════════
 *
 * `contactos` é global desde que nasceu, com um comentário nas regras
 * a dizer porquê: "o painel do pastor (ainda não existe) vai precisar
 * de ler isto por cima de todas as bases, um dia". É hoje.
 *
 * A Base Pessoal cria sempre com `etapa: "visita"` — as regras
 * garantem-no, e as etapas seguintes são só daqui. A leitura abre-se
 * nas regras (é uma lista a sério, com busca e filtro; passá-la por
 * uma função seria perder o tempo real e ganhar paginação à mão); a
 * ESCRITA da etapa passa por aqui, para o histórico ficar gravado na
 * mesma escrita — coisa que uma regra não garante.
 */
const ETAPAS = ["visita", "contactado", "gd", "membro", "voluntario", "servindo"];

export const moverEtapaContacto = onCall(async (req) => {
  const uid = exigeVisaoPastoral(req);
  const { contactoId, etapa, nota } = req.data || {};
  if (!contactoId) throw new HttpsError("invalid-argument", "Falta o contacto.");
  if (!ETAPAS.includes(etapa)) throw new HttpsError("invalid-argument", "Etapa desconhecida.");

  const ref = db().doc(`contactos/${contactoId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Contacto não encontrado.");
  const anterior = snap.data().etapa ?? "visita";
  if (anterior === etapa) return { ok: true, semMudanca: true };

  // Andar para trás é permitido de propósito: alguém que foi marcado
  // como "membro" por engano tem de poder voltar. O histórico regista
  // as duas direções, por isso não se perde nada ao corrigir.
  await ref.set({
    etapa,
    etapaEm: admin.firestore.FieldValue.serverTimestamp(),
    etapaPor: uid,
    historicoEtapas: admin.firestore.FieldValue.arrayUnion({
      de: anterior, para: etapa, em: new Date().toISOString(), por: uid,
      nota: String(nota ?? "").trim() || null,
    }),
  }, { merge: true });

  return { ok: true, de: anterior, para: etapa };
});

/** "Excluir" um contacto do funil — pedido 2026-09. Nunca é um delete
 *  a sério (regra 5 do CLAUDE.md raiz: nada é apagado, é desativado):
 *  `arquivado:true` é o MESMO campo que a Base Pessoal já usa no
 *  Formulário dela (`arquivarContacto`, apps/pessoal/src/lib/
 *  contactos.js) — `ouvirContactos` já filtra por ele, dos dois
 *  lados. As regras só deixam a Pessoal escrever em `contactos/{id}`
 *  (`firestore.rules`: "o painel NÃO escreve por esta via"); por isso
 *  isto é Cloud Function, como `moverEtapaContacto`, não escrita
 *  direta. */
export const arquivarContactoPastoral = onCall(async (req) => {
  exigeVisaoPastoral(req);
  const { contactoId } = req.data || {};
  if (!contactoId) throw new HttpsError("invalid-argument", "Falta o contacto.");
  const ref = db().doc(`contactos/${contactoId}`);
  try {
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Contacto não encontrado.");
    await ref.set({ arquivado: true }, { merge: true });
    return { ok: true };
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    // reportado 2026-09 como "internal" sem mais detalhe — o cliente
    // nunca vê a mensagem real de um erro que não é HttpsError (Cloud
    // Functions esconde-a por segurança). Isto grava o erro a sério no
    // Cloud Logging, para a próxima falha dar para diagnosticar.
    console.error("arquivarContactoPastoral falhou", { contactoId }, e);
    throw new HttpsError("internal", "Não foi possível excluir — tenta outra vez.");
  }
});

/** Só a ETIQUETA do culto (`eventos/{e}.tipoCulto`), sem tocar na
 *  ordem — pedido do dono do produto (2026-09): o Painel Pastoral muda
 *  a etiqueta, a ordem continua a subir pela Backstage em PDF.
 *  `publicarOrdemCulto` também grava `tipoCulto`, mas substitui a
 *  `ordem` inteira e exige `pode_publicar_culto`, que a pastoral não
 *  tem de propósito (ver apps/pastoral/CLAUDE.md). A Backstage abre o
 *  seletor dela a partir deste mesmo campo, por isso publicar o PDF
 *  depois mantém a etiqueta escolhida aqui, a não ser que a mudem lá.
 *  Só aceita ids do catálogo `config/tiposCulto` — o texto solto de
 *  "+ Outro" já não existe desde que passou a gravar no catálogo. */
const TIPOS_CULTO_ARRANQUE = ["ceia", "contribua", "familia"];
export const definirTipoCulto = onCall(async (req) => {
  exigeVisaoPastoral(req);
  const { eventoId, tipoCulto } = req.data || {};
  if (!eventoId || typeof tipoCulto !== "string") {
    throw new HttpsError("invalid-argument", "Dados inválidos.");
  }
  const cat = await db().doc("config/tiposCulto").get();
  const lista = cat.exists && Array.isArray(cat.data().lista) && cat.data().lista.length
    ? cat.data().lista.map((t) => t.id)
    : TIPOS_CULTO_ARRANQUE;
  if (!lista.includes(tipoCulto)) {
    throw new HttpsError("invalid-argument", "Esse tipo de culto não está na lista.");
  }
  const ref = db().doc(`eventos/${eventoId}`);
  if (!(await ref.get()).exists) throw new HttpsError("not-found", "Culto não encontrado.");
  await ref.set({ tipoCulto }, { merge: true });
  return { ok: true };
});

/* ══════════════════════════════════════════════════════════════
 *  AGENDA — eventos da igreja criados pelo pastor
 * ══════════════════════════════════════════════════════════════
 *
 * Pedido 2026-09: um calendário no painel com os eventos da igreja e
 * os privados de cada pastor. Os PRIVADOS são escrita direta
 * (`bases/pastoral/agenda`, ver firestore.rules). Os da IGREJA são
 * os mesmos `eventos/{data}` que as dez bases já leem — calendário,
 * escala, enquete — por isso passam por aqui (eventos é write:false).
 *
 * "Só algumas bases servem" NÃO é um campo novo: grava-se
 * `escopo:"global"` com as outras em `dispensadaPor`, que é o que
 * cada base já usa para esconder um evento ("não servimos",
 * `visivelParaBase` em cada lib/painel.js). Assim nenhuma base
 * precisou de mudar uma linha, e o líder de uma base não escolhida
 * pode, na mesma, desmarcar o "não servimos" e servir.
 *
 * Só eventos com `tipo` (os cultos especiais) — os domingos são de
 * `gerarDomingos` e não se editam nem apagam daqui. Um evento
 * `escopo:"base"` é de uma base só e continua a ser dela. */
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID_EVENTO = /^\d{4}-\d{2}-\d{2}(-[0-9]{4}(-\d+)?)?$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function hojeEmLisboa() {
  const partes = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo) => partes.find((p) => p.type === tipo)?.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

/** As bases que servem em cultos — sem as que não têm escala (Financeiro). */
async function basesQueServem() {
  return (await basesDaIgreja()).filter((b) => b.semEscalaDeCulto !== true).map((b) => b.id);
}

function exigeEventoDaIgrejaEditavel(snap) {
  if (!snap.exists || snap.data().ativo === false) throw new HttpsError("not-found", "Evento não encontrado.");
  const d = snap.data();
  if (!d.tipo) throw new HttpsError("failed-precondition", "Os domingos não se mudam por aqui.");
  if (d.escopo === "base") {
    throw new HttpsError("failed-precondition", "Este evento é só de uma base — muda-se nessa base.");
  }
  return d;
}

/** Vários eventos no mesmo dia (pedido 2026-09), desde que a horas
 *  diferentes. O primeiro de cada dia continua com o id = data (é o
 *  que o check-in, a contagem e o "culto de hoje" das bases procuram);
 *  os seguintes ganham `data-HHMM` (e `-2`, `-3`… se ainda colidir).
 *  Tudo o resto nas bases lê os eventos pelo campo `data`, e
 *  `dataPorExtenso` só usa os três primeiros pedaços do id. */
function idParaNovoEvento(data, horaCulto, docsDoDia) {
  const livre = (id) => {
    const d = docsDoDia.find((x) => x.id === id);
    return !d || d.data().ativo === false;
  };
  if (livre(data)) return data;
  const base = `${data}-${horaCulto.replace(":", "")}`;
  let id = base, n = 2;
  while (!livre(id)) id = `${base}-${n++}`;
  return id;
}

const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const porExtenso = (iso) => `${Number(iso.slice(8, 10))} de ${MESES_PT[Number(iso.slice(5, 7)) - 1]}`;

/** Somar semanas sem fuso: meio-dia UTC nunca muda de dia. */
function mais7(data, semanas) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * semanas);
  return d.toISOString().slice(0, 10);
}

/** Outro evento ativo no mesmo dia e à mesma hora bloqueia SEMPRE
 *  (pedido 2026-09) — seja de que base for, domingo incluído. */
function conflitoDeHora(docsDoDia, horaCulto, ignorarId) {
  return docsDoDia.find((d) => d.id !== ignorarId && d.data().ativo !== false && d.data().horaCulto === horaCulto) ?? null;
}

const docsDoDia = async (data) => (await db().collection("eventos").where("data", "==", data).get()).docs;

export const guardarEventoIgreja = onCall(async (req) => {
  const uid = exigeVisaoPastoral(req);
  const { data, nome, horaCulto, horaChegada, local, nota, bases, editar } = req.data || {};
  // `editar:true` sem eventoId é o formato de antes de haver vários
  // eventos por dia (o id era sempre a data)
  const eventoId = req.data?.eventoId || (editar ? data : null);
  const semanas = eventoId ? 1 : Number(req.data?.semanas ?? 1);
  if (!DATA_ISO.test(String(data || ""))) throw new HttpsError("invalid-argument", "Data inválida.");
  if (typeof nome !== "string" || !nome.trim() || nome.trim().length > 60) {
    throw new HttpsError("invalid-argument", "Falta o nome do evento.");
  }
  if (!HORA.test(String(horaCulto || "")) || !HORA.test(String(horaChegada || ""))) {
    throw new HttpsError("invalid-argument", "Horas inválidas.");
  }
  if ((local && (typeof local !== "string" || local.length > 80)) || (nota && (typeof nota !== "string" || nota.length > 300))) {
    throw new HttpsError("invalid-argument", "Local ou nota demasiado longos.");
  }
  if (!Number.isInteger(semanas) || semanas < 1 || semanas > 52) {
    throw new HttpsError("invalid-argument", "Repetir: entre 1 e 52 semanas.");
  }
  const servem = await basesQueServem();
  if (!Array.isArray(bases) || !bases.length) throw new HttpsError("invalid-argument", "Escolhe pelo menos uma base.");
  if (bases.some((b) => !servem.includes(b))) throw new HttpsError("invalid-argument", "Base desconhecida.");

  const campos = {
    tipo: nome.trim(), horaCulto, horaChegada,
    local: local?.trim() || null, nota: nota?.trim() || null,
    dispensadaPor: servem.filter((b) => !bases.includes(b)),
  };

  if (eventoId) {
    if (!ID_EVENTO.test(eventoId)) throw new HttpsError("invalid-argument", "Evento inválido.");
    const ref = db().doc(`eventos/${eventoId}`);
    const atual = exigeEventoDaIgrejaEditavel(await ref.get());
    const outro = conflitoDeHora(await docsDoDia(atual.data), horaCulto, eventoId);
    if (outro) {
      throw new HttpsError("already-exists",
        `Já há "${outro.data().tipo || "Culto de domingo"}" às ${horaCulto} nesse dia — escolhe outra hora.`);
    }
    await ref.set({
      ...campos, atualizadoPor: uid, atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { eventoIds: [eventoId] };
  }

  // repetir = o mesmo evento em N semanas seguidas. Tudo ou nada: se
  // alguma dessas datas já tem um evento àquela hora, não cria nenhum
  // e diz quais — criar metade em silêncio era pior.
  const datas = Array.from({ length: semanas }, (_, k) => mais7(data, k));
  const dias = await Promise.all(datas.map(docsDoDia));
  const ocupadas = datas
    .map((d, k) => [d, conflitoDeHora(dias[k], horaCulto, null)])
    .filter(([, c]) => c)
    .map(([d, c]) => `${porExtenso(d)} (${c.data().tipo || "Culto de domingo"})`);
  if (ocupadas.length) {
    throw new HttpsError("already-exists", `Já há um evento às ${horaCulto} em: ${ocupadas.join(", ")}. Nada foi criado.`);
  }
  const lote = db().batch();
  const ids = datas.map((d, k) => {
    const id = idParaNovoEvento(d, horaCulto, dias[k]);
    // .set() sem merge, como criarCultoEspecial: um `ativo:false`
    // antigo com o mesmo id é substituído por inteiro
    lote.set(db().doc(`eventos/${id}`), {
      data: d, ...campos, escopo: "global", baseId: null, origem: "pastoral",
      criadoPor: uid, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    return id;
  });
  await lote.commit();
  return { eventoIds: ids };
});

/** Apagar a sério, como `excluirCultoEspecial` (o id é a data, ou
 *  `data-HHMM` — um `ativo:false` prendia esse id para sempre), mas com as escalas de
 *  TODAS as bases, não só a de quem apaga. Só eventos futuros: um que
 *  já passou tem contagem/checklist/registo, e isso é histórico
 *  (regra 5 do CLAUDE.md raiz). O cliente avisa antes quais bases já
 *  tinham escalado gente. */
export const apagarEventoIgreja = onCall(async (req) => {
  exigeVisaoPastoral(req);
  const { eventoId } = req.data || {};
  if (!ID_EVENTO.test(String(eventoId || ""))) throw new HttpsError("invalid-argument", "Falta o evento.");
  const ref = db().doc(`eventos/${eventoId}`);
  const d = exigeEventoDaIgrejaEditavel(await ref.get());
  if (d.data < hojeEmLisboa()) {
    throw new HttpsError("failed-precondition", "Um evento que já passou não se apaga — é histórico.");
  }
  await db().recursiveDelete(ref);
  return { ok: true };
});

/* ══════════════════════════════════════════════════════════════
 *  RECADO DO PASTOR — de ida, sem resposta
 * ══════════════════════════════════════════════════════════════
 *
 * Decisão explícita (2026-09): não é um pedido com estado nem uma
 * conversa. O pastor escreve, aparece no Início da base, o líder lê e
 * dispensa. Sem "feito", sem resposta, sem notificação — nenhuma base
 * tem push ou email (ver MELHORIAS-ENTRE-BASES.md), e fingir que tem
 * seria pior do que não ter.
 *
 * Coleção própria na raiz (`recados`), não `bases/{b}/avisos`: os
 * avisos são do líder para a equipa dele e só a Louvor os mostra hoje;
 * misturar as duas coisas obrigava a Louvor a distinguir origens no
 * mesmo ecrã, e as outras nove a ganhar a tela de avisos inteira só
 * para ver um recado. Assim cada base ganha um componente pequeno e
 * partilhado, e o que já existe não muda.
 *
 * Dispensar é escrita direta do líder (ver firestore.rules) — não vale
 * uma ida ao servidor para pôr um booleano, e o líder já é quem pode.
 */
export const enviarRecadoPastoral = onCall(async (req) => {
  const uid = exigeVisaoPastoral(req);
  const { baseId, texto, urgente } = req.data || {};
  const limpo = String(texto ?? "").trim();
  if (!limpo) throw new HttpsError("invalid-argument", "O recado está vazio.");
  if (limpo.length > 600) throw new HttpsError("invalid-argument", "Recado demasiado longo (máx. 600 caracteres).");

  const base = await db().doc(`bases/${baseId}`).get();
  if (!base.exists || base.data().ativa === false) {
    throw new HttpsError("not-found", "Base desconhecida.");
  }

  // O nome de quem envia fica gravado (não só o uid): o líder vê "do
  // Pastor" e não um identificador. Vem de bases/pastoral/pessoas,
  // onde o autor serve — nunca de uma constante em código.
  const autor = await db().doc(`bases/${req.auth.token.baseId}/pessoas/${uid}`).get();

  const ref = await db().collection("recados").add({
    baseId,
    texto: limpo,
    urgente: urgente === true,
    autorUid: uid,
    autorNome: autor.exists ? (autor.data().nome ?? null) : null,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    dispensado: false,
  });

  return { ok: true, id: ref.id };
});

/** Os recados que o pastor já mandou, para ele ver o que está por ler
 *  sem ter de adivinhar. Leitura só dele — a regra de `recados` deixa
 *  cada base ler os seus, e o painel ler todos. */
export const recadosPastoral = onCall(async (req) => {
  exigeVisaoPastoral(req);
  const snap = await db().collection("recados")
    .orderBy("criadoEm", "desc").limit(60).get();
  return {
    recados: snap.docs.map((d) => {
      const r = d.data();
      return {
        id: d.id, baseId: r.baseId, texto: r.texto, urgente: !!r.urgente,
        dispensado: !!r.dispensado,
        criadoEm: r.criadoEm?.toMillis?.() ?? null,
        dispensadoEm: r.dispensadoEm?.toMillis?.() ?? null,
      };
    }),
  };
});

/* ══════════════════════════════════════════════════════════════
 *  EQUIPA PASTORAL — a única base onde "todos são admin"
 * ══════════════════════════════════════════════════════════════
 *
 * Pedido 2026-09: "alterar o código de outro, e poder criar novos
 * utilizadores — todos com permissão de admin". Esclarecido com o
 * dono do produto: SÓ dentro da própria equipa pastoral, não nas
 * outras dez bases — não é o nascimento de um papel "admin_igreja"
 * (ver o cabeçalho deste ficheiro e o CLAUDE.md desta app).
 *
 * `exigeVisaoPastoral` é o gate certo, não `exigeLider` (que só
 * aceita lider_base/auxiliar — em `bases/pastoral` isso deixaria a
 * maioria da equipa de fora, e "auxiliar" nem é um papel válido
 * aqui, `bases/pastoral` não está em BASES_COM_AUXILIAR de
 * index.js). `ve_tudo_pastoral` é a capacidade de quem SERVE na
 * base pastoral, qualquer papel — exatamente "todos" do pedido.
 *
 * hash()/PIN_PADRAO duplicados de index.js (mesma convenção deste
 * ficheiro: pastoral.js não importa de index.js, para não abrir uma
 * exportação só para isto — ver resumoAcomodacaoAoVivo acima). O
 * formato do hash tem de ficar byte a byte igual (scrypt, salt de 16
 * bytes em hex + hash de 64 bytes em hex, unidos por ":"), porque é
 * o `confere()` de index.js que autentica no login — não há um
 * "confere" próprio aqui.
 */
const PIN_PADRAO_PASTORAL = { lider_base: "123456", voluntario: "1234" };
function hashPin(pin) {
  const sal = randomBytes(16).toString("hex");
  return `${sal}:${scryptSync(pin, sal, 64).toString("hex")}`;
}

/** Cria uma pessoa na equipa pastoral, ou liga uma que já existe
 *  noutra base — nunca duplica identidade (regra 9 do CLAUDE.md
 *  raiz). Ao contrário de `criarVoluntario` (index.js), que exige o
 *  líder escolher explicitamente "já é voluntário noutra base?" via
 *  `procurarPessoaGlobal`, aqui a equipa é pequena e a UI não tem
 *  esse ecrã de busca — por isso o telefone já faz a ligação
 *  sozinho quando bate com alguém que já existe. */
export const criarPessoaPastoral = onCall(async (req) => {
  exigeVisaoPastoral(req);
  const { nome, telefone = "", papel = "voluntario" } = req.data || {};
  if (!["voluntario", "lider_base"].includes(papel)) {
    throw new HttpsError("invalid-argument", "Papel inválido.");
  }
  if (!String(nome || "").trim()) throw new HttpsError("invalid-argument", "Falta o nome.");
  const nomeLimpo = nome.trim();
  const telefoneLimpo = String(telefone || "").trim();

  // só um líder de cada vez — mesmo invariante de sempre (ver
  // definirLiderBase acima e editarVoluntario em index.js)
  if (papel === "lider_base") {
    const outros = await db().collection("bases/pastoral/pessoas").where("papel", "==", "lider_base").get();
    const lote = db().batch();
    outros.forEach((d) => lote.update(d.ref, { papel: "voluntario" }));
    await lote.commit();
  }

  if (telefoneLimpo) {
    const existente = await db().collectionGroup("pessoas").where("telefone", "==", telefoneLimpo).limit(1).get();
    if (!existente.empty) {
      const pessoaId = existente.docs[0].id;
      const jaAqui = await db().doc(`bases/pastoral/pessoas/${pessoaId}`).get();
      if (jaAqui.exists && jaAqui.data().ativo !== false) {
        throw new HttpsError("already-exists", "Já há alguém na equipa pastoral com este telefone.");
      }
      const globalSnap = await db().doc(`pessoas/${pessoaId}`).get();
      await db().doc(`bases/pastoral/pessoas/${pessoaId}`).set({
        nome: nomeLimpo, telefone: telefoneLimpo, papel, ativo: true,
        foto: globalSnap.exists ? (globalSnap.data().foto ?? null) : null,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db().doc(`pessoas/${pessoaId}`).set({ bases: { pastoral: true } }, { merge: true });
      return { pessoaId, pinProvisorio: null };
    }
  }

  const provisorio = PIN_PADRAO_PASTORAL[papel] ?? PIN_PADRAO_PASTORAL.voluntario;
  const ref = db().collection("bases/pastoral/pessoas").doc();
  await ref.set({
    nome: nomeLimpo, telefone: telefoneLimpo, papel, ativo: true, foto: null,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db().doc(`pessoas/${ref.id}`).set({
    nome: nomeLimpo, foto: null, bases: { pastoral: true },
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db().doc(`pessoas/${ref.id}/privado/auth`).set({
    pinHash: hashPin(provisorio), pinDigitos: provisorio.length,
    provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null,
  });
  return { pessoaId: ref.id, pinProvisorio: provisorio };
});

/** Repõe o código de outro membro da equipa pastoral para o valor
 *  fixo de sempre (mesmo `PIN_PADRAO`/comportamento de `reporPin`,
 *  index.js) — `provisorio:true` obriga a trocar no próximo acesso. */
export const reporPinPastoral = onCall(async (req) => {
  exigeVisaoPastoral(req);
  const { pessoaId } = req.data || {};
  if (!pessoaId) throw new HttpsError("invalid-argument", "Falta a pessoa.");
  const snap = await db().doc(`bases/pastoral/pessoas/${pessoaId}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "Pessoa não encontrada.");
  const provisorio = PIN_PADRAO_PASTORAL[snap.data().papel] ?? PIN_PADRAO_PASTORAL.voluntario;
  await db().doc(`pessoas/${pessoaId}/privado/auth`).set({
    pinHash: hashPin(provisorio), pinDigitos: provisorio.length,
    provisorio: true, falhas: 0, jaBloqueou: false, bloqueadoAte: null,
  }, { merge: true });
  return { pinProvisorio: provisorio };
});
