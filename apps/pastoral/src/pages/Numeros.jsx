import { useEffect, useMemo, useState } from "react";
import { corrigirDuracaoSecaoCulto, historicoPastoral } from "../lib/pastoral";
import { dataCurta, eur } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import LinhaTempo from "../components/LinhaTempo";
import Barras from "../components/Barras";
import MapaCalor from "../components/MapaCalor";
import Atraso, { corAtraso, textoAtraso } from "../components/Atraso";

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const PERIODOS = [
  ["3m", "3 meses"],
  ["12m", "12 meses"],
  ["ano", "Este ano"],
];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function janelaDe(periodo) {
  const hoje = new Date();
  const ate = iso(hoje);
  if (periodo === "ano") return [`${hoje.getFullYear()}-01-01`, ate];
  const meses = periodo === "3m" ? 3 : 12;
  return [iso(new Date(hoje.getFullYear(), hoje.getMonth() - meses, hoje.getDate())), ate];
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
  const [periodo, setPeriodo] = useState("12m");
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

  useEffect(() => {
    let vivo = true;
    setDados(null); setErro(null);
    const [desde, ate] = janelaDe(periodo);
    historicoPastoral(desde, ate)
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

  /** Só as contagens FECHADAS entram. Uma contagem a meio (metade das
   *  categorias ainda por preencher) apareceria no gráfico como um
   *  domingo fraco, e não é isso que aconteceu — é só que ninguém
   *  acabou de contar ainda. */
  const presencas = useMemo(() => {
    if (!dados) return [];
    return dados.cultos
      .filter((c) => c.contagem?.finalizada && c.contagem.auditorio !== null)
      .map((c) => ({ chave: c.eventoId, rotulo: dataCurta(c.data), valor: c.contagem.auditorio }));
  }, [dados]);

  /** "Presença na igreja", domingo a domingo — voluntários (escalados
   *  nas dez bases) + auditório (o mapa lugar a lugar, ocupados +
   *  visitantes + bloqueados/reservados) + crianças (Kinder/SHIFT/New,
   *  pelas categorias automáticas da Contagem). MESMA conta do cartão
   *  do Mapa de Calor logo abaixo (ver o comentário em
   *  `MapaCalor.jsx`) — reportado 2026-09: este gráfico ainda somava
   *  `contagem.auditorio` (visitantes+voluntários DIGITADOS à mão na
   *  Contagem da Pessoal), que é outra coisa; as duas contas podem
   *  discordar, e mostrar duas "Presença na igreja" diferentes no
   *  mesmo painel era o problema. Só entra o domingo com pelo menos um
   *  mapa começado (`c.acomodacao`) — sem mapa nenhum não há "auditório"
   *  para somar, e mostrar um zero enganava como "domingo fraco". */
  const presencaIgreja = useMemo(() => {
    if (!dados) return [];
    return dados.cultos
      .filter((c) => c.acomodacao)
      .map((c) => {
        const a = c.acomodacao;
        const marcados = a.ocupados + a.visitantes;
        const bloqueados = a.reservados + a.bloqueados;
        const criancas = (c.contagem?.baby ?? 0) + (c.contagem?.fun ?? 0) + (c.contagem?.junior ?? 0);
        return { chave: c.eventoId, rotulo: dataCurta(c.data), valor: marcados + bloqueados + c.voluntarios + criancas };
      });
  }, [dados]);

  const visitantes = useMemo(() => {
    if (!dados) return [];
    return dados.cultos
      .filter((c) => c.contagem?.finalizada && c.contagem.visitantes !== null)
      .map((c) => ({ chave: c.eventoId, rotulo: dataCurta(c.data), valor: c.contagem.visitantes }));
  }, [dados]);

  const mediaPresenca = presencas.length
    ? Math.round(presencas.reduce((t, p) => t + p.valor, 0) / presencas.length)
    : null;

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
      .filter((c) => c.visitantesCadastrados > 0)
      .map((c) => ({ chave: c.eventoId, rotulo: dataCurta(c.data), valor: c.visitantesCadastrados }));
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

  /** A média do atraso de TODOS os blocos, de todos os cultos do
   *  período — não a média do `atrasoFinal` (a hora de relógio a que
   *  o culto acabou, um número por domingo). Pedido 2026-09: "a média
   *  devia ser a média de atrasos que teve dos blocos todos". Mesmo
   *  critério de `atrasoPorMomento` logo abaixo ("Contagem" fica de
   *  fora — não é um momento do culto, é a hora das portas), só que
   *  achatado: aqui entra cada ocorrência de cada momento, em vez de
   *  agrupar por nome. */
  const atrasoMedioBlocos = useMemo(() => {
    const valores = [];
    for (const c of cultosComRegisto) {
      for (const a of c.culto.atrasos) {
        if (a.momento.trim().toLowerCase() === "contagem" || a.atraso === null) continue;
        valores.push(a.atraso);
      }
    }
    return valores.length ? Math.round(valores.reduce((t, n) => t + n, 0) / valores.length) : null;
  }, [cultosComRegisto]);

  /** Em que momento é que o culto se atrasa, em média — a pergunta que
   *  transforma "o culto acaba tarde" em algo acionável. Só entram os
   *  momentos que apareceram em pelo menos dois cultos: um atraso
   *  medido uma vez é uma anedota, não um padrão.
   *
   *  Ordenado pela ordem em que os momentos acontecem no culto (pela
   *  hora prevista média), não pelo atraso — é assim que se lê "onde
   *  começa a acumular", momento a seguir a momento, e não uma lista
   *  saltada que obriga a procurar cada nome na ordem a sério.
   *
   *  "Contagem" fica de fora: não é um momento do culto em si, é a
   *  hora das portas — já aparece à parte, no resumo "Portas …" da
   *  aba Ordem, e listá-la aqui ao lado de Louvor/Mensagem confundia
   *  as duas coisas.
   *
   *  `atraso` já vem do servidor como a diferença entre quanto o
   *  bloco DUROU a sério e quanto devia durar — não a hora a que
   *  começou (ver o comentário de `resumirCulto`, functions/pastoral.js).
   *  O último bloco de cada culto nunca tem duração real (não há hora
   *  de fim gravada), por isso vem com `atraso: null` e fica de fora
   *  daqui — não é que não atrasou, é que não se sabe. */
  const atrasoPorMomento = useMemo(() => {
    const mapa = new Map();
    for (const c of cultosComRegisto) {
      for (const a of c.culto.atrasos) {
        const chave = a.momento.trim().toLowerCase();
        if (chave === "contagem" || a.atraso === null) continue;
        if (!mapa.has(chave)) mapa.set(chave, { rotulo: a.momento.trim(), valores: [], previstos: [], ocorrencias: [] });
        const registo = mapa.get(chave);
        registo.valores.push(a.atraso);
        registo.ocorrencias.push({
          eventoId: c.eventoId, data: c.data, atraso: a.atraso, nome: a.momento,
          duracaoPrevista: a.duracaoPrevista, duracaoReal: a.duracaoReal,
        });
        const [h, m] = String(a.previsto || "").split(":").map(Number);
        if (Number.isFinite(h) && Number.isFinite(m)) registo.previstos.push(h * 60 + m);
      }
    }
    return [...mapa.entries()]
      .filter(([, v]) => v.valores.length >= 2)
      .map(([chave, v]) => ({
        chave, rotulo: v.rotulo, vezes: v.valores.length,
        media: Math.round(v.valores.reduce((t, n) => t + n, 0) / v.valores.length),
        ordem: v.previstos.length ? v.previstos.reduce((t, n) => t + n, 0) / v.previstos.length : Infinity,
        ocorrencias: v.ocorrencias.sort((a, b) => a.data.localeCompare(b.data)),
      }))
      .sort((a, b) => a.ordem - b.ordem);
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
    if (!cultosComContagem.length) return [];
    const media = (chave) => {
      const vals = cultosComContagem.map((c) => c.contagem[chave]).filter((n) => n !== null && n !== undefined);
      return vals.length ? Math.round(vals.reduce((t, n) => t + n, 0) / vals.length) : null;
    };
    return [
      { chave: "baby", rotulo: "Baby", valor: media("baby") },
      { chave: "fun", rotulo: "Fun", valor: media("fun") },
      { chave: "junior", rotulo: "Júnior", valor: media("junior") },
      { chave: "new", rotulo: "New", valor: media("new") },
      { chave: "shift", rotulo: "Shift", valor: media("shift") },
    ].filter((s) => s.valor !== null);
  }, [dados]);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Números",
      subtitulo: "O que os domingos dizem, ao longo do tempo",
      chips: dados ? [
        `${dados.cultos.length} cultos`,
        mediaPresenca ? `${mediaPresenca} de média` : "sem contagens fechadas",
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
          <div className="dupla" style={{ marginTop: 12 }}>
            <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent", marginTop: 0 }}>
              <p className="ds" style={{ marginTop: 0 }}>Presença média</p>
              <p className="pa-num">{mediaPresenca ?? "—"}</p>
              <p className="ds" style={{ marginTop: 2 }}>em {presencas.length} domingo{presencas.length === 1 ? "" : "s"} contado{presencas.length === 1 ? "" : "s"}</p>
            </div>
            <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent", marginTop: 0 }}>
              <p className="ds" style={{ marginTop: 0 }}>Visitantes</p>
              <p className="pa-num">{totalVisitantes || "—"}</p>
              <p className="ds" style={{ marginTop: 2 }}>no período</p>
            </div>
          </div>

          <div className="sect">
            <div className="cabecalho">
              <h3>Presença na igreja</h3>
              <span className="cap">voluntários + auditório + crianças</span>
            </div>
            <LinhaTempo
              pontos={presencaIgreja}
              vazio="Ainda não há nenhum mapa do auditório começado neste período."
            />
          </div>

          <div className="sect">
            <div className="cabecalho"><h3>Visitantes por domingo</h3><span className="cap">(Contados pela base pessoal)</span></div>
            <LinhaTempo pontos={visitantes} vazio="Sem visitantes registados neste período." />
          </div>

          <div className="sect">
            <div className="cabecalho"><h3>Visitantes cadastrados</h3><span className="cap">(foram na salinha)</span></div>
            <LinhaTempo pontos={visitantesCadastrados} vazio="Ainda não há contactos registados neste período." />
          </div>

          <div className="sect">
            <div className="cabecalho"><h3>Voluntários por culto</h3><span className="cap">nas dez bases</span></div>
            <LinhaTempo pontos={voluntariosPorCulto} todosRotulados vazio="Ainda não há escalas publicadas neste período." />
          </div>

          <div className="sect">
            <div className="cabecalho">
              <h3>Quão cheio esteve o auditório</h3>
              {temDadosAcomodacao && <span className="cap">toca num domingo</span>}
            </div>
            <p className="ds" style={{ marginTop: 0 }}>
              Sobre a capacidade útil — lugares totais menos os reservados e os bloqueados. A escala é fixa
              de 0 a 100%, para os mapas de meses diferentes serem comparáveis entre si.
            </p>
            <MapaCalor
              cultos={dados.cultos}
              vazio="Nenhum mapa do auditório foi começado neste período."
            />
          </div>

          <div className="sect">
            <div className="cabecalho"><h3>Crianças</h3><span className="cap">média por domingo</span></div>
            <Barras linhas={criancasPorSala} vazio="Ainda não há contagem de crianças neste período." />
          </div>

          <div className="sect">
            <div className="cabecalho"><h3>Ofertas</h3><span className="cap">{eur(totalOferta)} no período</span></div>
            <p className="ds" style={{ marginTop: 0 }}>Evolução por domingo</p>
            <LinhaTempo pontos={ofertaPorDomingo} formatar={eur} vazio="Ainda não há contagens de oferta." />
            <p className="ds" style={{ marginTop: 18 }}>Acumulado por mês</p>
            <Barras linhas={ofertaPorMes} formatar={eur} vazio="Ainda não há contagens de oferta." />
          </div>

          <div className="sect">
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
                      Onde o atraso aparece — na ordem do culto, quanto cada bloco durou a mais (ou a menos) do
                      previsto, só os que aconteceram em dois ou mais cultos. Toca num para ver os horários.
                    </p>
                    {atrasoPorMomento.map((m) => {
                      const aberto = momentoAberto === m.chave;
                      return (
                        <div key={m.chave}>
                          <div
                            className="linha cabtoque"
                            onClick={() => setMomentoAberto(aberto ? null : m.chave)}
                            role="button" tabIndex={0}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setMomentoAberto(aberto ? null : m.chave); }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p className="nmt" style={{ fontSize: 14 }}>{m.rotulo}</p>
                              <p className="ds">{m.vezes} cultos</p>
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
