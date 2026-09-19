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
 * Cada bloco falha sozinho (`Promise.allSettled`): uma base sem a
 * coleção `melhorias` não pode tirar do ar o painel inteiro. Uma base
 * nova entra aqui sem tocar em nada — a lista sai de `bases/`, nunca
 * de uma lista fixa de nomes.
 */
async function resumoDaBase(b, eventoId) {
  const p = `bases/${b.id}`;
  const [
    pessoas, funcoes, inventario, melhorias,
    reembolsos, listas, escala, wikiIndice,
  ] = await Promise.allSettled([
    db().collection(`${p}/pessoas`).where("ativo", "==", true).get(),
    db().collection(`${p}/funcoes`).where("ativa", "==", true).get(),
    db().collection(`${p}/inventario`).get(),
    db().collection(`${p}/melhorias`).get(),
    db().collection(`${p}/reembolsos`).get(),
    db().collection(`${p}/listasCompras`).where("estado", "==", "aberta").get(),
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
  // as duas formas de escala do repo (lista simples e lugares por
  // ministério) — a mesma deteção de `escalasCrossBase`, que nunca
  // precisou de saber o nome da base para escolher
  const escalados = dadosEscala
    ? (Array.isArray(dadosEscala.lugares) && dadosEscala.lugares.length
        ? dadosEscala.lugares.filter((l) => l.titularId).length
        : (dadosEscala.pessoas || []).length)
    : 0;

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

    inventarioTotal: consumiveis.length,
    inventarioEmFalta: emFalta.length,
    equipamentosTotal: patrimonio.length,
    equipamentosAvariados: avariados.length,

    melhoriasAbertas: melhoriasAtivas.length,
    // "impede_culto" é a gravidade que para um domingo (ver GRAVIDADES
    // em index.js: impede_culto | atrapalha | melhoria) — é a única
    // que merece contagem própria no painel
    melhoriasGraves: melhoriasAtivas.filter((m) => m.gravidade === "impede_culto").length,
    duvidasSemResposta,
    listasComprasAbertas: ok(listas) ? contar(ok(listas)) : 0,

    reembolsosPorAprovar: pedidos.filter((r) => r.estado === "submetido").length,
    reembolsosPorPagar: pedidos.filter((r) => r.estado === "aprovado").length,
  };
}

export const panoramaPastoral = onCall(async (req) => {
  exigeVisaoPastoral(req);
  const { eventoId } = req.data || {};
  const bases = await basesDaIgreja();
  const resumos = await Promise.all(bases.map((b) => resumoDaBase(b, eventoId || null)));
  return { bases: resumos, geradoEm: Date.now() };
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
      registo.bases.push({ baseId, nome: nomeBase, cor, papel: p.papel ?? "voluntario", ativo: p.ativo !== false });
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

  const detalhes = await Promise.all(eventos.map(async (e) => {
    const [contagem, estatisticas] = await Promise.allSettled([
      db().doc(`eventos/${e.id}/contagem/geral`).get(),
      db().doc(`eventos/${e.id}/estatisticasCulto/registo`).get(),
    ]);
    const ok = (r) => (r.status === "fulfilled" && r.value?.exists ? r.value.data() : null);
    const c = ok(contagem);
    const s = ok(estatisticas);

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
 *  preenchidoPor, preenchidoEm}` — nove categorias que, de propósito,
 *  NÃO formam um total (ver o comentário no topo de
 *  apps/pessoal/src/lib/contagem.js: cada uma tem o significado que já
 *  tinha no relatório do culto em papel).
 *
 *  Por isso não se soma tudo. O que sai daqui é o auditório
 *  (membros + visitantes + voluntários — as três que contam pessoas
 *  na sala ao mesmo tempo) e as salas separadas; somar "apelo" a
 *  "membros" contaria a mesma pessoa duas vezes.
 *
 *  `valor: null` é "por contar", diferente de zero — e um culto com
 *  metade das categorias por contar não pode aparecer no gráfico como
 *  um domingo fraco. Daí `finalizada`: só a contagem que a Pessoal
 *  marcou como terminada entra nas tendências. */
const AUDITORIO = ["membros", "visitantes", "voluntarios"];
const SALAS = ["new", "shift", "juniorFun", "baby"];

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
    membros: valor("membros"),
    visitantes: valor("visitantes"),
    voluntarios: valor("voluntarios"),
    apelo: valor("apelo"),
  };
}

/** Previsto (o que a ordem do culto dizia) vs. real (o que o FreeShow
 *  registou ao vivo) — a conta que `arquivarCultoTerminado` deixou por
 *  fazer de propósito ("ficam para quando esse painel existir").
 *
 *  Compara HORAS DE ENTRADA, não durações. Cada secção real tem
 *  `horaReal` ("10:34") e nenhuma tem hora de fim: só se sabe quando
 *  cada coisa COMEÇOU. Inventar uma duração a partir da secção
 *  seguinte daria ao último momento do culto uma duração de zero, e
 *  "o culto durou 4 minutos a menos" seria mentira todas as semanas.
 *  O atraso na entrada de cada momento é exato e é a pergunta que o
 *  pastor faz de verdade: "a mensagem começou a horas?".
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

  const atrasos = [];
  for (const m of previstos) {
    const real = porNome.get(chaveNome(m.momento));
    const previsto = emMinutos(m.hora);
    const aconteceu = real ? emMinutos(real.horaReal) : null;
    if (previsto === null || aconteceu === null) continue;
    atrasos.push({ momento: m.momento, previsto: m.hora, real: real.horaReal, atraso: aconteceu - previsto });
  }

  const correspondidos = new Set(previstos.map((m) => chaveNome(m.momento)));

  return {
    // a duração prevista é bem definida (está escrita na ordem); a
    // real não existe, e é por isso que não vem aqui um par
    minutosPrevistos: previstos.reduce((t, m) => t + (Number(m.minutos) || 0), 0),
    atrasos,
    atrasoFinal: atrasos.length ? atrasos.at(-1).atraso : null,
    atrasoMaximo: atrasos.length ? Math.max(...atrasos.map((a) => a.atraso)) : null,
    momentosPrevistos: previstos.length,
    // momentos que o culto nunca chegou a pôr no ar, e secções que
    // foram ao ar sem estarem na ordem — as duas coisas dizem algo
    // sobre o domingo, e nenhuma aparece em lado nenhum hoje
    naoRealizados: previstos.filter((m) => !porNome.has(chaveNome(m.momento))).length,
    extras: [...porNome.keys()].filter((k) => !correspondidos.has(k)).length,
  };
}

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
