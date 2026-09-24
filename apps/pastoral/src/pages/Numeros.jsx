import { useEffect, useMemo, useState } from "react";
import { corrigirDuracaoSecaoCulto, historicoPastoral } from "../lib/pastoral";
import { dataCurta, eur } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import LinhaTempo from "../components/LinhaTempo";
import ColunasPresenca, { SERIES } from "../components/ColunasPresenca";
import { criancasDoCulto, media, presencaDoCulto } from "../lib/presenca";
import Barras from "../components/Barras";
import MapaCalor from "../components/MapaCalor";
import Atraso, { corAtraso, textoAtraso } from "../components/Atraso";

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const PERIODOS = [
  ["3m", "3 meses"],
  ["12m", "12 meses"],
  ["tudo", "Tempo todo"],
];

/** O primeiro ano com dados neste sistema — "Tempo todo" pede ano a
 *  ano daqui até hoje (`historicoPastoral` aceita no máximo 3 anos
 *  por chamada, e um ano por chamada é também o que o resumo "Por
 *  ano" precisa). */
const PRIMEIRO_ANO = 2026;

/** Domingos que ficam de fora de Números — testes, não cultos (pedido
 *  2026-09: "30 ago era só um teste"). Os dados continuam no
 *  Firestore; só não entram nas contas nem nos gráficos daqui. */
const DOMINGOS_IGNORADOS = new Set(["2026-08-30"]);

/** Domingos de antes do Formulário da Base Pessoal, contados na
 *  planilha antiga (pedido 2026-09: "só para ter algo ali"). Um número
 *  fixo aqui, e não contactos inventados em `contactos` — esses
 *  entrariam no funil de visitantes como pessoas que não existem.
 *  Prevalece sobre o que o Formulário tiver para esse domingo. */
const CADASTRADOS_PLANILHA = { "2026-09-06": 9 };

/** Os blocos principais do culto (pedido 2026-09: "quero Louvor,
 *  Contribua, Vídeos — todos num bloco só —, Visitantes, Mensagem e
 *  Apelo; nem precisa de Ceia nem de blocos extra"). Cada momento da
 *  ordem entra no primeiro bloco cujo padrão bate com o nome — os
 *  nomes mudam de domingo para domingo ("Louvor #1", "Louvor #2",
 *  "OD News", "Avisos + Visitantes"), e comparar o nome exato (como
 *  antes) deixava só 2 blocos à vista. O resto (Contagem, Ceia,
 *  Oração final, apresentações…) fica de fora. */
const BLOCOS = [
  ["louvor", "Louvor", /louvor|adora[çc]/i],
  ["contribua", "Contribua", /contribu|oferta|d[íi]zimo/i],
  ["videos", "Vídeos", /v[íi]deo|news|clip/i],
  ["visitantes", "Visitantes", /visitante/i],
  ["mensagem", "Mensagem", /mensagem|prega[çc]|palavra/i],
  ["apelo", "Apelo", /apelo/i],
];
const blocoDe = (momento) => BLOCOS.find(([, , re]) => re.test(momento))?.[0] ?? null;

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Uma ou mais janelas [desde, ate] — "Tempo todo" é uma por ano. */
function janelasDe(periodo) {
  const hoje = new Date();
  const ate = iso(hoje);
  if (periodo === "tudo") {
    const janelas = [];
    for (let a = PRIMEIRO_ANO; a <= hoje.getFullYear(); a++) {
      janelas.push([`${a}-01-01`, a === hoje.getFullYear() ? ate : `${a}-12-31`]);
    }
    return janelas;
  }
  const meses = periodo === "3m" ? 3 : 12;
  return [[iso(new Date(hoje.getFullYear(), hoje.getMonth() - meses, hoje.getDate())), ate]];
}

async function carregarHistorico(periodo) {
  const partes = await Promise.all(janelasDe(periodo).map(([d, a]) => historicoPastoral(d, a)));
  const ok = (data) => !DOMINGOS_IGNORADOS.has(data);
  return {
    cultos: partes.flatMap((p) => p.cultos).filter((c) => ok(c.data)),
    oferta: partes.flatMap((p) => p.oferta).filter((o) => ok(o.data)),
  };
}

/**
 * Está a melhorar ou a piorar?
 *
 * Três coisas que o sistema já grava há meses e que nunca foram
 * olhadas em conjunto por ninguém: a contagem de presentes (Base
 * Pessoal), a oferta contada (Financeiro) e o culto previsto vs. real
 * (`estatisticasCulto`, gravado ao finalizar o culto ao vivo e fechado
 * a toda a gente até este painel existir — a função que o escreve diz,
 * em comentário, que as contas "ficam para quando esse painel
 * existir").
 *
 * Um eixo por gráfico, sempre. Presenças e oferta são grandezas
 * diferentes e vivem em gráficos separados de propósito: sobrepô-las
 * num só, com duas escalas, inventaria uma correlação que os dados não
 * têm — e é a forma mais comum de um painel de gestão mentir sem
 * ninguém reparar.
 */
export default function Numeros({ ativo, definirCabecalho }) {
  const torrada = useTorrada();
  // 3 meses por omissão (pedido 2026-09) — é o que se olha no dia a dia
  const [periodo, setPeriodo] = useState("3m");
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  // qual momento (categoria) do "O culto começa a horas?" está
  // expandido a mostrar o horário de cada culto — mesmo padrão de
  // uma chave só, nunca mais que uma aberta ao mesmo tempo
  const [momentoAberto, setMomentoAberto] = useState(null);
  // qual ocorrência está a ser corrigida (eventoId+momento) — nunca
  // mais que uma de cada vez, mesmo padrão de tudo o resto nesta app
  const [aCorrigir, setACorrigir] = useState(null);
  const [novaDuracao, setNovaDuracao] = useState("");
  const [aGuardarDuracao, setAGuardarDuracao] = useState(false);
  // sobe a cada correção guardada, para o efeito abaixo recarregar o
  // histórico — sem isto, corrigir uma duração não se via em lado
  // nenhum até trocar de período e voltar
  const [recarregar, setRecarregar] = useState(0);
  // a tabela "No fim"/"Gargalo" começa cortada nos 5 cultos mais
  // recentes — pedido 2026-09, mesmo critério de Desgaste (ver
  // Pessoas.jsx)
  const [verTodaTabela, setVerTodaTabela] = useState(false);
  // "Crianças por domingo" também começa nos 5 mais recentes
  const [verTodasCriancas, setVerTodasCriancas] = useState(false);

  useEffect(() => {
    let vivo = true;
    setDados(null); setErro(null);
    carregarHistorico(periodo)
      .then((d) => { if (vivo) setDados(d); })
      .catch((e) => { if (vivo) setErro(e.message || "Não foi possível carregar o histórico."); });
    return () => { vivo = false; };
  }, [periodo, recarregar]);

  async function guardarDuracao() {
    if (!aCorrigir || !novaDuracao) return;
    setAGuardarDuracao(true);
    try {
      await corrigirDuracaoSecaoCulto(aCorrigir.eventoId, aCorrigir.nome, Number(novaDuracao));
      torrada("Duração corrigida");
      setACorrigir(null);
      setRecarregar((n) => n + 1);
    } catch (e) {
      torrada(e.message || "Não foi possível corrigir.");
    } finally {
      setAGuardarDuracao(false);
    }
  }

  /* ── presença domingo a domingo ──────────────────────────── */

  /** A presença de cada culto, já partida em auditório/voluntários/
   *  crianças — a conta (e DE ONDE vem cada parte: a Contagem até
   *  20/9, o Mapa a partir de 27/9, pedido 2026-09) vive em
   *  `lib/presenca.js`, a mesma que o cartão do Mapa de Calor usa.
   *  Só entram os domingos em que se sabe o auditório — é a maior
   *  parte, e um total sem ela seria um "domingo fraco" que não foi.
   *
   *  Já foi `contagem.auditorio` (visitantes+voluntários digitados na
   *  Contagem, só contagens fechadas) e depois o mapa para todos os
   *  domingos — nenhum dos dois era o que a equipa queria ver. */
  const presencaIgreja = useMemo(() => {
    if (!dados) return [];
    return dados.cultos
      .map((c) => ({ c, p: presencaDoCulto(c) }))
      .filter(({ p }) => p.total !== null)
      .map(({ c, p }) => ({ chave: c.eventoId, rotulo: dataCurta(c.data), data: c.data, ...p }));
  }, [dados]);

  /** Visitantes por domingo — da mesma fonte que o auditório desse
   *  domingo (Contagem até 20/9, Mapa depois), nunca misturado. */
  const visitantes = useMemo(() => {
    if (!dados) return [];
    return dados.cultos
      .map((c) => ({ c, p: presencaDoCulto(c) }))
      .filter(({ p }) => p.visitantes !== null)
      .map(({ c, p }) => ({ chave: c.eventoId, rotulo: dataCurta(c.data), valor: p.visitantes }));
  }, [dados]);

  const mediaPresenca = media(presencaIgreja.map((p) => p.total));
  const ultimaPresenca = presencaIgreja.at(-1) ?? null;
  const medias = {
    auditorio: media(presencaIgreja.map((p) => p.auditorio)),
    voluntarios: media(presencaIgreja.map((p) => p.voluntarios)),
    criancas: media(presencaIgreja.map((p) => p.criancas)),
  };
  const totalVisitantes = visitantes.reduce((t, v) => t + v.valor, 0);

  /** Quantos visitantes ficaram CADASTRADOS no Formulário da Base
   *  Pessoal, por culto — pedido 2026-09, complementar ao gráfico
   *  acima (que é a contagem manual de bulto, `contagem.visitantes`,
   *  nem sempre fechada). É o mesmo universo de "Pessoas → Visitantes"
   *  (o funil) — cada domingo aqui é quantos desses contactos
   *  chegaram naquele culto. */
  const visitantesCadastrados = useMemo(() => {
    if (!dados) return [];
    return dados.cultos
      .map((c) => ({ c, n: CADASTRADOS_PLANILHA[c.data] ?? c.visitantesCadastrados }))
      .filter(({ n }) => n > 0)
      .map(({ c, n }) => ({ chave: c.eventoId, rotulo: dataCurta(c.data), valor: n }));
  }, [dados]);

  /** Quantos foram escalados em cada culto, somando as dez bases —
   *  pedido 2026-09. Só entram os cultos com pelo menos um escalado:
   *  zero aqui quase sempre quer dizer "ninguém publicou escala ainda
   *  para este domingo", não "zero voluntários a sério" — mesmo
   *  raciocínio de "zero significa zero, não se aplica não é zero".
   *  Só os últimos 10, sempre — mesmo com "Este ano"/"12 meses"
   *  selecionado, este gráfico não segue o período: é sobre "como
   *  anda a equipa agora", não uma tendência longa. */
  const voluntariosPorCulto = useMemo(() => {
    if (!dados) return [];
    return dados.cultos
      .filter((c) => c.voluntarios > 0)
      .map((c) => ({ chave: c.eventoId, rotulo: dataCurta(c.data), valor: c.voluntarios }))
      .slice(-10);
  }, [dados]);

  /** Se não há dado nenhum de acomodação (fechado ou ao vivo), a
   *  grelha do calor não desenha nenhum quadrado clicável — e a
   *  legenda "toca num domingo" por cima de uma grelha vazia é o que
   *  parecia bugado (mesmo relato: "não tem onde clicar"). */
  const temDadosAcomodacao = useMemo(() => (dados?.cultos ?? []).some((c) => c.acomodacao), [dados]);

  /* ── ofertas ──────────────────────────────────────────────── */

  /** A evolução domingo a domingo — `dados.oferta` já vem ordenado por
   *  data (ver historicoPastoral). Gráfico separado do acumulado por
   *  mês: um é "está a subir ou a descer de domingo para domingo?", o
   *  outro é "quanto entrou em cada mês?" — perguntas diferentes,
   *  cada uma com o gráfico que já responde a ela no resto desta
   *  tela (LinhaTempo para evolução, Barras para magnitude por
   *  categoria). */
  const ofertaPorDomingo = useMemo(() => {
    if (!dados) return [];
    return dados.oferta.map((o) => ({ chave: o.data, rotulo: dataCurta(o.data), valor: o.total / 100 }));
  }, [dados]);

  const ofertaPorMes = useMemo(() => {
    if (!dados) return [];
    const mapa = new Map();
    for (const o of dados.oferta) {
      const [a, m] = o.data.split("-");
      const chave = `${a}-${m}`;
      mapa.set(chave, (mapa.get(chave) ?? 0) + o.total);
    }
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([chave, cents]) => ({
        chave,
        rotulo: `${MESES_PT[Number(chave.slice(5)) - 1]} ${chave.slice(2, 4)}`,
        valor: cents / 100,
      }));
  }, [dados]);

  const totalOferta = ofertaPorMes.reduce((t, m) => t + m.valor, 0);

  /* ── o culto: previsto vs. real ──────────────────────────── */

  const cultosComRegisto = useMemo(
    () => (dados?.cultos ?? []).filter((c) => c.culto && c.culto.atrasoFinal !== null),
    [dados],
  );

  /** Por bloco: o atraso de cada culto é a SOMA dos momentos desse
   *  bloco nesse culto (dois louvores, três vídeos… contam como um
   *  bloco só), e a média é sobre os cultos. `atraso` já vem do
   *  servidor como quanto o bloco DUROU a mais do previsto (ver
   *  `resumirCulto`); o último momento de cada culto não tem duração
   *  real (`atraso: null`) e fica de fora — não se sabe, não é zero.
   *  Os seis aparecem sempre, pela ordem do culto; um sem registo
   *  mostra "—". */
  const atrasoPorMomento = useMemo(() => {
    const porBloco = new Map(BLOCOS.map(([chave, rotulo]) => [chave, { rotulo, porCulto: new Map(), ocorrencias: [] }]));
    for (const c of cultosComRegisto) {
      for (const a of c.culto.atrasos) {
        const chave = blocoDe(a.momento);
        if (!chave || a.atraso === null) continue;
        const reg = porBloco.get(chave);
        reg.porCulto.set(c.eventoId, (reg.porCulto.get(c.eventoId) ?? 0) + a.atraso);
        reg.ocorrencias.push({
          eventoId: c.eventoId, data: c.data, atraso: a.atraso, nome: a.momento,
          duracaoPrevista: a.duracaoPrevista, duracaoReal: a.duracaoReal,
        });
      }
    }
    return [...porBloco.entries()].map(([chave, v]) => ({
      chave, rotulo: v.rotulo, vezes: v.porCulto.size,
      media: media([...v.porCulto.values()]),
      ocorrencias: v.ocorrencias.sort((x, y) => x.data.localeCompare(y.data)),
    }));
  }, [cultosComRegisto]);

  /** "Em média, cada bloco atrasa" — a média dos seis blocos acima,
   *  bloco a bloco em cada culto (mesmo critério: só os principais). */
  const atrasoMedioBlocos = useMemo(() => {
    const valores = [];
    for (const c of cultosComRegisto) {
      const soma = new Map();
      for (const a of c.culto.atrasos) {
        const chave = blocoDe(a.momento);
        if (!chave || a.atraso === null) continue;
        soma.set(chave, (soma.get(chave) ?? 0) + a.atraso);
      }
      valores.push(...soma.values());
    }
    return media(valores);
  }, [cultosComRegisto]);

  /* ── crianças ─────────────────────────────────────────────── */

  /** Quantas crianças por sala, em média por domingo — o popup
   *  "Quantas crianças estão presentes?" de cada painel (Kinder/SHIFT/
   *  New, pedido 2026-09), que escreve direto na Contagem da Base
   *  Pessoal (`c.contagem.{baby,fun,junior,new,shift}`). Média, não o
   *  total do período: "480 crianças em quatro meses" não diz nada
   *  sobre um domingo normal, e é essa a pergunta ("quantas crianças
   *  temos?"). Já foi o check-in a sério da Kinder (`c.kinder`) — essa
   *  função continua a existir mas está desligada na Kinder por
   *  pedido da líder (`CHECKIN_ATIVO=false`), por isso ficava sempre
   *  vazia; a Contagem é hoje a única fonte com dados a sério, e é a
   *  mesma nas cinco categorias (nunca uma mistura das duas). */
  const criancasPorSala = useMemo(() => {
    if (!dados) return [];
    const cultosComContagem = dados.cultos.filter((c) => c.contagem);
    const mediaDe = (chave) => media(cultosComContagem.map((c) => c.contagem[chave]));
    // Fun e Júnior aparecem SEMPRE, mesmo sem número ainda ("falta o
    // Júnior e o Fun", reportado 2026-09)
    return [
      { chave: "baby", rotulo: "Baby", valor: mediaDe("baby") },
      { chave: "fun", rotulo: "Fun", valor: mediaDe("fun"), sempre: true },
      { chave: "junior", rotulo: "Júnior", valor: mediaDe("junior"), sempre: true },
      { chave: "new", rotulo: "New", valor: mediaDe("new") },
      { chave: "shift", rotulo: "Shift", valor: mediaDe("shift") },
    ].filter((s) => s.sempre || s.valor !== null);
  }, [dados]);

  /** Os números REAIS de cada domingo, sala a sala (pedido 2026-09:
   *  "a média não chega, preciso de ver quantas crianças teve por base
   *  em cada domingo"). Só os domingos com pelo menos uma sala contada;
   *  "—" é "ninguém marcou", nunca zero. Do mais recente para trás. */
  const criancasPorDomingo = useMemo(() => {
    if (!dados) return [];
    return dados.cultos
      .map((c) => ({ c, total: criancasDoCulto(c) }))
      .filter(({ total }) => total !== null)
      .map(({ c, total }) => ({ chave: c.eventoId, data: c.data, contagem: c.contagem, total }))
      .reverse();
  }, [dados]);

  /** "Tempo todo", ano a ano — para quando o ano fechar ficar lado a
   *  lado com os seguintes. As mesmas contas dos cartões do topo. */
  const porAno = useMemo(() => {
    if (!dados || periodo !== "tudo") return [];
    const anos = new Map();
    const doAno = (a) => {
      if (!anos.has(a)) anos.set(a, { presencas: [], visitantes: 0, criancas: [], oferta: 0 });
      return anos.get(a);
    };
    for (const p of presencaIgreja) doAno(p.data.slice(0, 4)).presencas.push(p.total);
    for (const c of dados.cultos) {
      const pr = presencaDoCulto(c);
      if (pr.visitantes) doAno(c.data.slice(0, 4)).visitantes += pr.visitantes;
      const k = criancasDoCulto(c);
      if (k !== null) doAno(c.data.slice(0, 4)).criancas.push(k);
    }
    for (const o of dados.oferta) doAno(o.data.slice(0, 4)).oferta += o.total / 100;
    return [...anos.entries()].sort((x, y) => y[0].localeCompare(x[0])).map(([ano, v]) => ({
      ano, domingos: v.presencas.length, presenca: media(v.presencas),
      visitantes: v.visitantes, criancas: media(v.criancas), oferta: v.oferta,
    }));
  }, [dados, periodo, presencaIgreja]);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Números",
      subtitulo: "O que os domingos dizem, ao longo do tempo",
      chips: dados ? [
        `${dados.cultos.length} cultos`,
        mediaPresenca ? `${mediaPresenca} de média` : "sem presenças contadas",
      ] : [],
    });
  }, [ativo, definirCabecalho, dados, mediaPresenca]);

  return (
    <>
      <div className="menu" style={{ position: "static", border: 0, padding: "14px 0 4px", background: "none", backdropFilter: "none" }}>
        {PERIODOS.map(([id, rotulo]) => (
          <button key={id} data-on={periodo === id ? "1" : "0"} onClick={() => setPeriodo(id)}>{rotulo}</button>
        ))}
      </div>

      {erro && <div className="caixa destaque" style={{ marginTop: 12 }}><p className="ds" style={{ marginTop: 0 }}>{erro}</p></div>}
      {!dados && !erro && <div className="vaz" style={{ marginTop: 12 }}>A carregar o histórico…</div>}

      {dados && (
        <>
          {/* o número que se procura primeiro, e as três partes dele
              com a mesma cor do gráfico logo abaixo */}
          <div className="nm-heroi">
            <p className="rotulo">Presença na igreja</p>
            <p className="valor">{mediaPresenca ?? "—"}</p>
            <p className="sub">
              {mediaPresenca === null
                ? "Ainda nenhum domingo contado neste período."
                : <>em média por domingo · <b>{ultimaPresenca.total}</b> no último <span style={{ whiteSpace: "nowrap" }}>({ultimaPresenca.rotulo})</span></>}
            </p>
          </div>
          <div className="nm-quatro">
            {SERIES.map((s) => (
              <div key={s.chave}>
                <p><i style={{ background: s.cor }} />{s.rotulo}</p>
                <b>{medias[s.chave] ?? "—"}</b>
                <small>média por domingo</small>
              </div>
            ))}
            <div>
              <p>Visitantes</p>
              <b>{visitantes.length ? totalVisitantes : "—"}</b>
              <small>no período</small>
            </div>
          </div>

          {periodo === "tudo" && porAno.length > 0 && (
            <>
              <p className="nm-grupo">Por ano</p>
              {porAno.map((a) => (
                <div className="nm-ano" key={a.ano}>
                  <h4>{a.ano}</h4>
                  <dl>
                    <div><dt>Domingos contados</dt><dd>{a.domingos}</dd></div>
                    <div><dt>Presença média</dt><dd>{a.presenca ?? "—"}</dd></div>
                    <div><dt>Visitantes</dt><dd>{a.visitantes || "—"}</dd></div>
                    <div><dt>Crianças (média)</dt><dd>{a.criancas ?? "—"}</dd></div>
                    <div><dt>Ofertas</dt><dd>{a.oferta ? eur(a.oferta) : "—"}</dd></div>
                  </dl>
                </div>
              ))}
            </>
          )}

          <p className="nm-grupo">Presença</p>
          <div className="sect" style={{ paddingTop: 10 }}>
            <div className="cabecalho">
              <h3>Por domingo</h3>
              {presencaIgreja.length > 0 && <span className="cap">toca numa coluna</span>}
            </div>
            <p className="ds" style={{ marginTop: 0 }}>
              Auditório e visitantes: Mapa (Base Pessoal). Voluntários: escalas das bases. Crianças: contador
              de cada sala.
            </p>
            <ColunasPresenca
              pontos={presencaIgreja}
              vazio="Ainda não há nenhum domingo com o auditório contado neste período."
            />
          </div>

          <div className="sect">
            <div className="cabecalho">
              <h3>Quão cheio esteve o auditório</h3>
              {temDadosAcomodacao && <span className="cap">toca num domingo</span>}
            </div>
            <p className="ds" style={{ marginTop: 0 }}>
              Pessoas no auditório sobre a capacidade do auditório (todos os lugares). A escala é fixa de 0 a
              100%, para os mapas de meses diferentes serem comparáveis entre si.
            </p>
            <MapaCalor
              cultos={dados.cultos}
              vazio="Nenhum mapa do auditório foi começado neste período."
            />
          </div>

          <p className="nm-grupo">Visitantes</p>
          <div className="sect" style={{ paddingTop: 10 }}>
            <div className="cabecalho"><h3>Por domingo</h3><span className="cap">no auditório</span></div>
            <LinhaTempo pontos={visitantes} vazio="Sem visitantes registados neste período." />
          </div>

          <div className="sect">
            <div className="cabecalho"><h3>Cadastrados</h3><span className="cap">foram à salinha</span></div>
            <LinhaTempo pontos={visitantesCadastrados} vazio="Ainda não há contactos registados neste período." />
          </div>

          <p className="nm-grupo">Equipa e crianças</p>
          <div className="sect" style={{ paddingTop: 10 }}>
            <div className="cabecalho"><h3>Voluntários por culto</h3><span className="cap">nas dez bases</span></div>
            <LinhaTempo pontos={voluntariosPorCulto} todosRotulados vazio="Ainda não há escalas publicadas neste período." />
          </div>

          <div className="sect">
            <div className="cabecalho"><h3>Crianças</h3><span className="cap">média por domingo</span></div>
            <Barras linhas={criancasPorSala} vazio="Ainda não há contagem de crianças neste período." />

            {criancasPorDomingo.length > 0 && (
              <div style={{ borderTop: "1px solid var(--fio)", marginTop: 18, paddingTop: 14 }}>
                <p className="cap" style={{ marginTop: 0 }}>Domingo a domingo</p>
                <div className="tabwrap" style={{ marginTop: 8 }}>
                  <table className="tab nm-criancas">
                    <thead>
                      <tr>
                        <th>Culto</th>
                        <th>Baby</th><th>Fun</th><th>Jún.</th><th>New</th><th>Shift</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(verTodasCriancas ? criancasPorDomingo : criancasPorDomingo.slice(0, 5)).map((d) => (
                        <tr key={d.chave}>
                          <td>{dataCurta(d.data)}</td>
                          {["baby", "fun", "junior", "new", "shift"].map((s) => (
                            <td key={s}>{d.contagem?.[s] ?? "—"}</td>
                          ))}
                          <td><b>{d.total}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {criancasPorDomingo.length > 5 && (
                  <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setVerTodasCriancas((v) => !v)}>
                    {verTodasCriancas ? "Ver menos" : `Ver mais (${criancasPorDomingo.length - 5})`}
                  </button>
                )}
              </div>
            )}
          </div>

          <p className="nm-grupo">Ofertas</p>
          <div className="sect" style={{ paddingTop: 10 }}>
            <div className="cabecalho"><h3>Ofertas</h3><span className="cap">{eur(totalOferta)} no período</span></div>
            <p className="ds" style={{ marginTop: 0 }}>Evolução por domingo</p>
            <LinhaTempo pontos={ofertaPorDomingo} formatar={eur} vazio="Ainda não há contagens de oferta." />
            <p className="ds" style={{ marginTop: 18 }}>Acumulado por mês</p>
            <Barras linhas={ofertaPorMes} formatar={eur} vazio="Ainda não há contagens de oferta." />
          </div>

          <p className="nm-grupo">O culto</p>
          <div className="sect" style={{ paddingTop: 10 }}>
            <div className="cabecalho">
              <h3>O culto começa a horas?</h3>
              <span className="cap">{cultosComRegisto.length} cultos registados</span>
            </div>
            {cultosComRegisto.length === 0 ? (
              <div className="vaz">
                Nenhum culto deste período foi finalizado ao vivo pela Base Técnica — é isso que grava o registo
                de o que aconteceu a que horas.
              </div>
            ) : (
              <>
                <div className="caixa" style={{ marginTop: 4 }}>
                  <p className="ds" style={{ marginTop: 0 }}>Em média, cada bloco atrasa:</p>
                  <p style={{ marginTop: 6 }}>
                    <b className={corAtraso(atrasoMedioBlocos)} style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.035em" }}>
                      {textoAtraso(atrasoMedioBlocos)}
                    </b>
                  </p>
                </div>

                {atrasoPorMomento.length > 0 && (
                  <>
                    <p className="ds" style={{ marginTop: 14 }}>
                      Onde o atraso aparece — os blocos principais, na ordem do culto: quanto cada um durou a mais
                      (ou a menos) do previsto, em média. Vários momentos do mesmo bloco no mesmo culto (dois
                      louvores, vários vídeos) somam-se. Toca num para ver os horários.
                    </p>
                    {atrasoPorMomento.map((m) => {
                      const aberto = momentoAberto === m.chave;
                      return (
                        <div key={m.chave}>
                          <div
                            className="linha cabtoque"
                            onClick={() => m.vezes && setMomentoAberto(aberto ? null : m.chave)}
                            role="button" tabIndex={0}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setMomentoAberto(aberto ? null : m.chave); }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p className="nmt" style={{ fontSize: 14 }}>{m.rotulo}</p>
                              <p className="ds">{m.vezes ? `${m.vezes} culto${m.vezes === 1 ? "" : "s"}` : "sem registo"}</p>
                            </div>
                            <Atraso minutos={m.media} />
                          </div>
                          {aberto && (
                            <div className="aberto" style={{ paddingBottom: 10 }}>
                              {m.ocorrencias.map((o) => {
                                const chaveCorrigir = `${o.eventoId}:${o.nome}`;
                                const aEditarEsta = aCorrigir && `${aCorrigir.eventoId}:${aCorrigir.nome}` === chaveCorrigir;
                                return (
                                  <div key={o.eventoId} style={{ padding: "8px 0" }}>
                                    <div className="linha" style={{ padding: 0 }}>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <p className="ds" style={{ margin: 0 }}>{dataCurta(o.data)}</p>
                                        {/* atraso nunca é null aqui (filtrado antes), por isso
                                            durações também nunca são — sempre os dois números */}
                                        <p className="cap" style={{ marginTop: 2 }}>
                                          previsto {o.duracaoPrevista} min · durou {o.duracaoReal} min
                                        </p>
                                      </div>
                                      <Atraso minutos={o.atraso} />
                                      <button
                                        className="btn sec" style={{ padding: "6px 10px", fontSize: 12, marginLeft: 8 }}
                                        onClick={() => {
                                          if (aEditarEsta) { setACorrigir(null); return; }
                                          setACorrigir({ eventoId: o.eventoId, nome: o.nome });
                                          setNovaDuracao(String(o.duracaoReal ?? ""));
                                        }}
                                      >
                                        Corrigir
                                      </button>
                                    </div>
                                    {aEditarEsta && (
                                      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                                        <p className="cap" style={{ margin: 0 }}>durou (min)</p>
                                        <input
                                          className="campo" type="number" min="0" max="600" value={novaDuracao}
                                          onChange={(e) => setNovaDuracao(e.target.value)}
                                          style={{ width: 76 }}
                                        />
                                        <button className="btn" style={{ padding: "8px 16px", fontSize: 13 }} disabled={aGuardarDuracao} onClick={guardarDuracao}>
                                          Guardar
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}

                {/* separador visual — "No fim"/"Gargalo" é outra
                    pergunta ("quando é que este domingo acabou, e qual
                    bloco comeu o tempo?"), não uma continuação de
                    "Onde o atraso aparece" logo acima (pedido 2026-09:
                    "coloca algum divisor para mostrar que isso é outra
                    seção") */}
                <div style={{ borderTop: "1px solid var(--fio)", marginTop: 18, paddingTop: 14 }}>
                  <p className="cap" style={{ marginTop: 0 }}>Culto a culto</p>
                  <div className="tabwrap" style={{ marginTop: 8 }}>
                    <table className="tab">
                      <thead>
                        <tr>
                          <th>Culto</th>
                          <th style={{ textAlign: "right" }}>No fim</th>
                          <th style={{ textAlign: "right" }}>Gargalo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(verTodaTabela ? cultosComRegisto : cultosComRegisto.slice(-5)).slice().reverse().map((c) => (
                          <tr key={c.eventoId}>
                            <td>{dataCurta(c.data)}</td>
                            <td style={{ textAlign: "right" }}>
                              <span className={corAtraso(c.culto.atrasoFinal)}>{textoAtraso(c.culto.atrasoFinal)}</span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              {c.culto.gargalo ? (
                                <>
                                  <span style={{ display: "block", fontSize: 11.5, color: "var(--cinza)" }}>{c.culto.gargalo.momento}</span>
                                  <span className={corAtraso(c.culto.gargalo.atraso)}>{textoAtraso(c.culto.gargalo.atraso)}</span>
                                </>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {cultosComRegisto.length > 5 && (
                    <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setVerTodaTabela((v) => !v)}>
                      {verTodaTabela ? "Ver menos" : `Ver mais (${cultosComRegisto.length - 5})`}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
