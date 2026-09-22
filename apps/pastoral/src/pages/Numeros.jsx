import { useEffect, useMemo, useState } from "react";
import { historicoPastoral } from "../lib/pastoral";
import { dataCurta, eur } from "@portal/shared/lib/data.js";
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
  const [periodo, setPeriodo] = useState("12m");
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let vivo = true;
    setDados(null); setErro(null);
    const [desde, ate] = janelaDe(periodo);
    historicoPastoral(desde, ate)
      .then((d) => { if (vivo) setDados(d); })
      .catch((e) => { if (vivo) setErro(e.message || "Não foi possível carregar o histórico."); });
    return () => { vivo = false; };
  }, [periodo]);

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

  const atrasoMedio = cultosComRegisto.length
    ? Math.round(cultosComRegisto.reduce((t, c) => t + c.culto.atrasoFinal, 0) / cultosComRegisto.length)
    : null;

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
   *  as duas coisas. */
  const atrasoPorMomento = useMemo(() => {
    const mapa = new Map();
    for (const c of cultosComRegisto) {
      for (const a of c.culto.atrasos) {
        const chave = a.momento.trim().toLowerCase();
        if (chave === "contagem") continue;
        if (!mapa.has(chave)) mapa.set(chave, { rotulo: a.momento.trim(), valores: [], previstos: [] });
        const registo = mapa.get(chave);
        registo.valores.push(a.atraso);
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
      }))
      .sort((a, b) => a.ordem - b.ordem);
  }, [cultosComRegisto]);

  /* ── crianças ─────────────────────────────────────────────── */

  /** Quantas crianças por sala, em média por domingo — o check-in a
   *  sério da Kinder, cruzado por categoria. Média, não o total do
   *  período: "480 crianças em quatro meses" não diz nada sobre um
   *  domingo normal, e é essa a pergunta ("quantas crianças temos?"). */
  const criancasPorSala = useMemo(() => {
    if (!dados) return [];
    const cultosComKinder = dados.cultos.filter((c) => c.kinder);
    if (!cultosComKinder.length) return [];
    const media = (chave) =>
      Math.round(cultosComKinder.reduce((t, c) => t + (c.kinder[chave] ?? 0), 0) / cultosComKinder.length);
    return [
      { chave: "baby", rotulo: "Baby", valor: media("baby") },
      { chave: "fun", rotulo: "Fun", valor: media("fun") },
      { chave: "junior", rotulo: "Junior", valor: media("junior") },
    ];
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
              <h3>Presença no auditório</h3>
              <span className="cap">membros + visitantes + equipa</span>
            </div>
            <LinhaTempo
              pontos={presencas}
              vazio="Ainda não há contagens fechadas neste período. A Base Pessoal fecha cada contagem no fim do culto."
            />
          </div>

          <div className="sect">
            <div className="cabecalho"><h3>Visitantes por domingo</h3></div>
            <LinhaTempo pontos={visitantes} vazio="Sem visitantes registados neste período." />
          </div>

          <div className="sect">
            <div className="cabecalho">
              <h3>Quão cheio esteve o auditório</h3>
              <span className="cap">toca num domingo</span>
            </div>
            <p className="ds" style={{ marginTop: 0 }}>
              Sobre a capacidade útil — lugares totais menos os reservados e os bloqueados. A escala é fixa
              de 0 a 100%, para os mapas de meses diferentes serem comparáveis entre si.
            </p>
            <MapaCalor
              cultos={dados.cultos}
              vazio="Nenhum mapa do auditório foi fechado neste período. A Base Pessoal fecha o mapa no fim de cada culto."
            />
          </div>

          <div className="sect">
            <div className="cabecalho"><h3>Crianças</h3><span className="cap">média por domingo</span></div>
            <Barras linhas={criancasPorSala} vazio="Ainda não há check-in da Kinder neste período." />
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
                  <p className="ds" style={{ marginTop: 0 }}>Em média, no fim do culto:</p>
                  <p style={{ marginTop: 6 }}>
                    <b className={corAtraso(atrasoMedio)} style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.035em" }}>
                      {textoAtraso(atrasoMedio)}
                    </b>
                  </p>
                </div>

                {atrasoPorMomento.length > 0 && (
                  <>
                    <p className="ds" style={{ marginTop: 14 }}>
                      Onde o atraso aparece — na ordem do culto, média por momento, só os que aconteceram em
                      dois ou mais cultos.
                    </p>
                    {atrasoPorMomento.map((m) => (
                      <div className="linha" key={m.chave}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p className="nmt" style={{ fontSize: 14 }}>{m.rotulo}</p>
                          <p className="ds">{m.vezes} cultos</p>
                        </div>
                        <Atraso minutos={m.media} />
                      </div>
                    ))}
                  </>
                )}

                <div className="tabwrap" style={{ marginTop: 14 }}>
                  <table className="tab">
                    <thead>
                      <tr>
                        <th>Culto</th>
                        <th style={{ textAlign: "right" }}>No fim</th>
                        <th style={{ textAlign: "right" }}>Pior</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cultosComRegisto.slice(-12).reverse().map((c) => (
                        <tr key={c.eventoId}>
                          <td>{dataCurta(c.data)}</td>
                          <td style={{ textAlign: "right" }}>
                            <span className={corAtraso(c.culto.atrasoFinal)}>{textoAtraso(c.culto.atrasoFinal)}</span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <span className={corAtraso(c.culto.atrasoMaximo)}>{textoAtraso(c.culto.atrasoMaximo)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
