import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { obterEventosPorIds, obterMesEnqueteRelevante, ouvirEnquete, ouvirRespostas, excluirEnquete, marcarEscalaPublicada } from "../../lib/enquetes";
import { obterEstatisticasEscala, obterHistoricoLugares, guardarEscalaTecnica } from "../../lib/painel";
import {
  gerarSugestao, calcularAlertas, calcularVezesAprendiz, construirIndisponibilidades,
  validarSugestao, chaveSlot,
} from "../../lib/sugestor";
import { desenharEscalaCanvas, compartilharOuBaixarCanvas } from "../../lib/exportarEscala";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataCurta, MESES } from "@portal/shared/lib/data.js";

const pad2 = (n) => String(n).padStart(2, "0");
const mesAtual = () => {
  const h = new Date();
  return `${h.getFullYear()}-${pad2(h.getMonth() + 1)}`;
};

const ALERTA_ICONE = {
  sobrecarga: "⚠️", sem_candidato: "🔴", inativo: "⏳", sem_resposta: "❔", cobertura: "🧩", promocao: "🌟",
};

export default function SugestorEscala({ ministerios, voluntarios }) {
  const torrada = useTorrada();
  const [mes, setMes] = useState(mesAtual());
  const [enquete, setEnquete] = useState(undefined);
  const [respostas, setRespostas] = useState([]);
  const [eventosPorId, setEventosPorId] = useState({});
  const [aCarregar, setACarregar] = useState(false);
  const [sugestao, setSugestao] = useState(null); // { resultado, contagemMes }
  const [alertas, setAlertas] = useState([]);
  const [dadosGeracao, setDadosGeracao] = useState(null); // estatisticas + vezesAprendiz, cache p/ regenerar
  const [aPublicar, setAPublicar] = useState(false);
  const [publicado, setPublicado] = useState(false);
  const [aConfirmarExcluir, setAConfirmarExcluir] = useState(false);
  const [aExcluir, setAExcluir] = useState(false);
  const [aExportar, setAExportar] = useState(false);
  const canvasRef = useRef(null);

  // por defeito, o mês da enquete em curso (ou a próxima) — só uma
  // vez, ao montar; depois disso o líder escolhe o mês à vontade
  useEffect(() => {
    obterMesEnqueteRelevante().then((relevante) => { if (relevante) setMes(relevante); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => ouvirEnquete(mes, setEnquete), [mes]);
  // só reseta ao trocar de mês — nunca por causa de um write nosso na
  // própria enquete (ex.: marcarEscalaPublicada), senão a sugestão e o
  // "publicado" somem sozinhos logo depois de publicar
  useEffect(() => {
    setSugestao(null); setAlertas([]); setPublicado(false); setAConfirmarExcluir(false);
  }, [mes]);
  useEffect(() => {
    if (!enquete) { setRespostas([]); return; }
    return ouvirRespostas(mes, setRespostas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, !!enquete]);
  useEffect(() => {
    if (!enquete?.domingos?.length) { setEventosPorId({}); return; }
    obterEventosPorIds(enquete.domingos).then(setEventosPorId);
  }, [enquete]);

  const domingos = useMemo(
    () => (enquete?.domingos || []).map((id) => eventosPorId[id] || { id, data: id }),
    [enquete, eventosPorId]
  );
  const ministerioResponsavel = ministerios.find((m) => m.ordem === 0) ?? null;
  const mesLabel = `${MESES[Number(mes.split("-")[1]) - 1]} ${mes.split("-")[0]}`;
  const respondentes = useMemo(() => new Set(respostas.map((r) => r.id)), [respostas]);

  // reavalia a tabela como está agora (não a geração) — vermelho é um
  // problema real, amarelo é só um ponto de atenção (ver validarSugestao)
  const avisos = useMemo(() => {
    if (!sugestao || !dadosGeracao) return {};
    return validarSugestao({
      resultado: sugestao.resultado, domingos, ministerios, voluntarios,
      indisponibilidades: dadosGeracao.indisponibilidades, respondentes,
    });
  }, [sugestao, dadosGeracao, domingos, ministerios, voluntarios, respondentes]);

  async function gerar() {
    if (!enquete?.domingos?.length) return;
    setACarregar(true);
    try {
      const [estatisticas, historicoLugares] = await Promise.all([
        obterEstatisticasEscala(90),
        obterHistoricoLugares(180),
      ]);
      const vezesAprendizPorMinisterio = calcularVezesAprendiz(historicoLugares);
      const indisponibilidades = construirIndisponibilidades(respostas);
      const dados = { estatisticas, vezesAprendizPorMinisterio, indisponibilidades };
      setDadosGeracao(dados);
      const s = gerarSugestao({ domingos, ministerios, voluntarios, ...dados });
      setSugestao(s);
      setAlertas(calcularAlertas({
        domingos, ministerios, voluntarios, resultado: s.resultado, contagemMes: s.contagemMes,
        estatisticas, respondentes, vezesAprendizPorMinisterio,
      }));
      setPublicado(false);
    } catch (e) {
      torrada(e.message || "Não foi possível gerar a sugestão.");
    } finally {
      setACarregar(false);
    }
  }

  function regenerar() {
    if (!dadosGeracao) return gerar();
    const s = gerarSugestao({ domingos, ministerios, voluntarios, ...dadosGeracao });
    setSugestao(s);
    setAlertas(calcularAlertas({
      domingos, ministerios, voluntarios, resultado: s.resultado, contagemMes: s.contagemMes,
      estatisticas: dadosGeracao.estatisticas, respondentes,
      vezesAprendizPorMinisterio: dadosGeracao.vezesAprendizPorMinisterio,
    }));
    torrada("Sugestão regenerada");
  }

  // editar uma célula é uma escolha ativa do líder — deixa de ser "só
  // havia essa opção", por isso tira o 🔒 automático dela
  function definirCelula(domingoId, ministerioId, campo, valor) {
    setSugestao((s) => {
      const chave = chaveSlot(domingoId, ministerioId);
      const atual = s.resultado[chave] || { titularId: null, aprendizId: null, travado: false, motivoTravado: null, semCandidato: false };
      const novo = { ...atual, [campo]: valor || null, travado: false, motivoTravado: null, semCandidato: false };
      if (campo === "titularId" && !valor) novo.aprendizId = null;
      return { ...s, resultado: { ...s.resultado, [chave]: novo } };
    });
  }

  const candidatosPara = (ministerioId, nivel) => voluntarios.filter((p) => p.ministerios?.[ministerioId] === nivel);

  async function publicar() {
    if (!sugestao) return;
    setAPublicar(true);
    try {
      for (const d of domingos) {
        const lugares = ministerios.map((m) => {
          const r = sugestao.resultado[chaveSlot(d.id, m.id)];
          return { ministerioId: m.id, titularId: r?.titularId ?? null, aprendizId: r?.aprendizId ?? null };
        });
        const liderEscala = sugestao.resultado[chaveSlot(d.id, ministerioResponsavel?.id)]?.titularId ?? null;
        await guardarEscalaTecnica(d.id, { liderEscala, lugares });
      }
      await marcarEscalaPublicada(enquete.id);
      setPublicado(true);
      torrada("Escala publicada");
    } catch (e) {
      torrada(e.message || "Não foi possível publicar a escala.");
    } finally {
      setAPublicar(false);
    }
  }

  // desenha a imagem só depois de publicado, direto num canvas
  // escondido no DOM — o "Exportar" só converte o que já está ali
  useEffect(() => {
    if (!publicado || !canvasRef.current || !sugestao) return;
    const canvas = desenharEscalaCanvas({ mesLabel, domingos, ministerios, resultado: sugestao.resultado, voluntarios });
    canvasRef.current.innerHTML = "";
    canvas.style.width = "100%";
    canvas.style.borderRadius = "12px";
    canvasRef.current.appendChild(canvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicado]);

  async function exportarImagem() {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    setAExportar(true);
    try {
      await compartilharOuBaixarCanvas(canvas, `escala-${mes}.png`);
    } catch {
      torrada("Não foi possível exportar a imagem.");
    } finally {
      setAExportar(false);
    }
  }

  async function excluir() {
    if (!enquete) return;
    setAExcluir(true);
    try {
      await excluirEnquete(enquete.id);
      torrada("Enquete excluída");
      setAConfirmarExcluir(false);
    } catch (e) {
      torrada(e.message || "Não foi possível excluir a enquete.");
    } finally {
      setAExcluir(false);
    }
  }

  return (
    <div className="sect">
      <div className="cabecalho">
        <h3>Escala sugerida</h3>
      </div>
      <label className="rot">Mês</label>
      <input className="campo" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />

      {enquete === undefined && <div className="vaz" style={{ marginTop: 10 }}>A carregar…</div>}
      {enquete === null && (
        <div className="vaz" style={{ marginTop: 10 }}>Ainda não há enquete de {mesLabel} — abre e fecha a enquete primeiro.</div>
      )}
      {enquete && enquete.estado !== "fechada" && (
        <div className="vaz" style={{ marginTop: 10 }}>A enquete de {mesLabel} ainda está aberta — fecha-a para gerar a escala.</div>
      )}
      {enquete && enquete.estado === "fechada" && !sugestao && (
        <button className="btn full" style={{ marginTop: 12 }} disabled={aCarregar} onClick={gerar}>
          {aCarregar ? "A gerar…" : "Gerar sugestão"}
        </button>
      )}

      {enquete && !aConfirmarExcluir && (
        <button className="btn sec full" style={{ marginTop: 8, color: "var(--magenta)" }} onClick={() => setAConfirmarExcluir(true)}>
          Excluir a enquete de {mesLabel}
        </button>
      )}
      {enquete && aConfirmarExcluir && (
        <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 600 }}>Excluir a enquete de {mesLabel}?</p>
          <p className="ds" style={{ marginTop: 4 }}>Deixa de contar em qualquer lado, como se não tivesse dados.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn perigo" style={{ flex: 1, fontSize: 12.5 }} disabled={aExcluir} onClick={excluir}>
              {aExcluir ? "A excluir…" : "Excluir"}
            </button>
            <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aExcluir} onClick={() => setAConfirmarExcluir(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {sugestao && (
        <>
          {alertas.length > 0 && (
            <div className="caixa" style={{ marginTop: 14, background: "#FFF7E8", border: 0 }}>
              <p className="cap">Vale olhar antes de publicar</p>
              {alertas.map((a, i) => (
                <p key={i} style={{ fontSize: 12.5, marginTop: i ? 6 : 8 }}>{ALERTA_ICONE[a.tipo] ?? "•"} {a.texto}</p>
              ))}
            </div>
          )}

          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table className="tab" style={{ minWidth: domingos.length * 190 }}>
              <thead>
                <tr>
                  <th></th>
                  {domingos.map((d) => (
                    <th key={d.id} style={{ textAlign: "left" }}>{d.tipo || dataCurta(d.data)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ministerios.map((m) => {
                  const operacional = m.id !== ministerioResponsavel?.id;
                  return (
                    <Fragment key={m.id}>
                      <tr>
                        <td style={{ fontWeight: 700, color: m.cor, whiteSpace: "nowrap", verticalAlign: "top" }}>{m.nome}</td>
                        {domingos.map((d) => {
                          const chave = chaveSlot(d.id, m.id);
                          const r = sugestao.resultado[chave] || {};
                          const aviso = avisos[chave]?.titular;
                          return (
                            <td key={d.id} style={{ minWidth: 180, verticalAlign: "top" }}>
                              <select
                                className="campo"
                                style={{
                                  fontSize: 12, padding: "6px 8px",
                                  ...(aviso?.nivel === "erro"
                                    ? { background: "#FFE3EC", borderColor: "var(--magenta)", color: "var(--magenta)" }
                                    : aviso?.nivel === "atencao"
                                      ? { background: "#FFF7E0", borderColor: "#d9a400" }
                                      : {}),
                                }}
                                value={r.titularId ?? ""}
                                onChange={(e) => definirCelula(d.id, m.id, "titularId", e.target.value)}
                              >
                                <option value="">{r.semCandidato ? "sem candidato" : "por definir"}</option>
                                {candidatosPara(m.id, "titular").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                              </select>
                              {aviso ? (
                                <p style={{ fontSize: 9.5, color: aviso.nivel === "erro" ? "var(--magenta)" : "#8a7300", marginTop: 3 }}>
                                  {aviso.nivel === "erro" ? "🔴" : "⚠️"} {aviso.motivo}
                                </p>
                              ) : r.travado && (
                                <p style={{ fontSize: 9.5, color: "var(--cinza)", marginTop: 3 }}>🔒 {r.motivoTravado}</p>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      {operacional && (
                        <tr>
                          <td style={{ fontSize: 11, color: "var(--cinza)", whiteSpace: "nowrap", borderTop: "none", paddingTop: 0 }}>
                            Em treino
                          </td>
                          {domingos.map((d) => {
                            const chave = chaveSlot(d.id, m.id);
                            const r = sugestao.resultado[chave] || {};
                            const aviso = avisos[chave]?.aprendiz;
                            return (
                              <td key={d.id} style={{ minWidth: 180, borderTop: "none", paddingTop: 0 }}>
                                <select
                                  className="campo"
                                  style={{
                                    fontSize: 11.5, padding: "5px 8px",
                                    ...(aviso?.nivel === "erro"
                                      ? { background: "#FFE3EC", borderColor: "var(--magenta)", color: "var(--magenta)" }
                                      : aviso?.nivel === "atencao"
                                        ? { background: "#FFF7E0", borderColor: "#d9a400" }
                                        : {}),
                                  }}
                                  value={r.aprendizId ?? ""} disabled={!r.titularId}
                                  onChange={(e) => definirCelula(d.id, m.id, "aprendizId", e.target.value)}
                                >
                                  <option value="">sem aprendiz</option>
                                  {candidatosPara(m.id, "aprendiz").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                </select>
                                {aviso && (
                                  <p style={{ fontSize: 9.5, color: aviso.nivel === "erro" ? "var(--magenta)" : "#8a7300", marginTop: 3 }}>
                                    {aviso.nivel === "erro" ? "🔴" : "⚠️"} {aviso.motivo}
                                  </p>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="ds" style={{ marginTop: 10 }}>
            🔒 = não havia outra opção disponível esse dia. Editar uma célula é uma escolha tua, e "Regenerar" volta a
            propor tudo do zero — publica assim que estiveres satisfeito.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn sec" style={{ flex: 1, fontSize: 13 }} disabled={aCarregar} onClick={regenerar}>
              Regenerar
            </button>
            <button className="btn" style={{ flex: 1, fontSize: 13 }} disabled={aPublicar} onClick={publicar}>
              {aPublicar ? "A publicar…" : "Publicar escala"}
            </button>
          </div>

          {publicado && (
            <div className="caixa" style={{ marginTop: 14 }}>
              <p className="cap">Escala publicada</p>
              <div ref={canvasRef} style={{ marginTop: 8 }} />
              <button className="btn full" style={{ marginTop: 10 }} disabled={aExportar} onClick={exportarImagem}>
                {aExportar ? "A preparar…" : "Partilhar imagem no WhatsApp"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
