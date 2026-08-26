import { useEffect, useMemo, useState } from "react";
import { obterEventosPorIds, obterMesEnqueteRelevante, ouvirEnquete, ouvirRespostas, excluirEnquete, marcarEscalaPublicada } from "../../lib/enquetes";
import { obterEstatisticasEscala, guardarEscala, obterIndisponibilidadesCrossBase } from "../../lib/painel";
import {
  gerarSugestaoApoio, calcularAlertas, construirIndisponibilidades,
  mesclarIndisponibilidades, validarSugestao,
} from "../../lib/sugestor";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataCurta, MESES } from "@portal/shared/lib/data.js";
import Avatar from "@portal/shared/components/Avatar.jsx";

const pad2 = (n) => String(n).padStart(2, "0");
const mesAtual = () => {
  const h = new Date();
  return `${h.getFullYear()}-${pad2(h.getMonth() + 1)}`;
};

const ALERTA_ICONE = { sobrecarga: "⚠️", sem_candidato: "🔴", inativo: "⏳" };

/** Um domingo da sugestão — mostra quem está escalado, com estrela
 *  para o líder de escala, e "Editar equipa" abre a lista toda de
 *  voluntários para trocar (mesma interação do SheetEscala manual:
 *  toca para juntar/tirar, estrela define o líder). */
function CartaoDomingo({ domingo, item, avisos, voluntarios, onAlternar, onDefinirLider }) {
  const [aEditar, setAEditar] = useState(false);
  const pessoas = item?.pessoas ?? [];
  const liderEscala = item?.liderEscala ?? null;
  const pessoaPorId = (id) => voluntarios.find((p) => p.id === id);

  return (
    <div className="caixa" style={{ marginTop: 10 }}>
      <div className="cabecalho">
        <h3 style={{ fontSize: 14.5 }}>{domingo.tipo || dataCurta(domingo.data || domingo.id)}</h3>
        <span className="ds">{pessoas.length} pessoa{pessoas.length === 1 ? "" : "s"}</span>
      </div>

      {pessoas.map((id) => {
        const p = pessoaPorId(id);
        if (!p) return null;
        const aviso = avisos?.[id];
        return (
          <div key={id} className="linha" style={{ padding: "8px 0" }}>
            <Avatar pessoa={p} tamanho={32} fonte={13} />
            <div style={{ flex: 1 }}>
              <p className="nmt">{p.nome}</p>
              {aviso && (
                <p style={{ fontSize: 11, marginTop: 1, color: aviso.nivel === "erro" ? "var(--magenta)" : "#8a7300" }}>
                  {aviso.nivel === "erro" ? "🔴" : "⚠️"} {aviso.motivo}
                </p>
              )}
            </div>
            <button className={`estrela${liderEscala === id ? " on" : ""}`} onClick={() => onDefinirLider(domingo.id, id)} title="Líder de escala">
              ★
            </button>
          </div>
        );
      })}
      {!pessoas.length && <p className="ds" style={{ padding: "6px 0" }}>Ninguém disponível para este domingo.</p>}

      <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setAEditar((v) => !v)}>
        {aEditar ? "Fechar edição" : "Editar equipa"}
      </button>

      {aEditar && (
        <div style={{ marginTop: 10 }}>
          {voluntarios.map((p) => {
            const dentro = pessoas.includes(p.id);
            return (
              <div className="opcao" style={{ cursor: "default" }} key={p.id}>
                <span onClick={() => onAlternar(domingo.id, p.id)} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: "pointer" }}>
                  <Avatar pessoa={p} tamanho={30} fonte={12} />
                  <b style={{ fontSize: 13.5, fontWeight: 600 }}>{p.nome}</b>
                </span>
                <span className={`chk${dentro ? " on" : ""}`} onClick={() => onAlternar(domingo.id, p.id)} style={{ cursor: "pointer" }}>✓</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SugestorEscala({ voluntarios }) {
  const torrada = useTorrada();
  const [mes, setMes] = useState(mesAtual());
  const [enquete, setEnquete] = useState(undefined);
  const [respostas, setRespostas] = useState([]);
  const [eventosPorId, setEventosPorId] = useState({});
  const [tamanhoEquipa, setTamanhoEquipa] = useState(6);
  const [aCarregar, setACarregar] = useState(false);
  const [sugestao, setSugestao] = useState(null); // { resultado, contagemMes }
  const [alertas, setAlertas] = useState([]);
  const [dadosGeracao, setDadosGeracao] = useState(null);
  const [aPublicar, setAPublicar] = useState(false);
  const [aConfirmarPublicar, setAConfirmarPublicar] = useState(false);
  const [publicado, setPublicado] = useState(false);
  const [aConfirmarExcluir, setAConfirmarExcluir] = useState(false);
  const [aExcluir, setAExcluir] = useState(false);

  useEffect(() => {
    obterMesEnqueteRelevante().then((relevante) => { if (relevante) setMes(relevante); });
  }, []);

  useEffect(() => ouvirEnquete(mes, setEnquete), [mes]);
  useEffect(() => {
    setSugestao(null); setAlertas([]); setPublicado(false); setAConfirmarExcluir(false); setAConfirmarPublicar(false);
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
  const mesLabel = `${MESES[Number(mes.split("-")[1]) - 1]} ${mes.split("-")[0]}`;
  const respondentes = useMemo(() => new Set(respostas.map((r) => r.id)), [respostas]);

  const avisosPorDomingo = useMemo(() => {
    if (!sugestao || !dadosGeracao) return {};
    return validarSugestao({
      resultado: sugestao.resultado, domingos,
      indisponibilidades: dadosGeracao.indisponibilidades, respondentes,
    });
  }, [sugestao, dadosGeracao, domingos, respondentes]);

  async function gerar() {
    if (!enquete?.domingos?.length) return;
    setACarregar(true);
    try {
      const [estatisticas, indisponibilidadesCrossBase] = await Promise.all([
        obterEstatisticasEscala(90),
        obterIndisponibilidadesCrossBase(domingos.map((d) => d.id)),
      ]);
      const indisponibilidades = mesclarIndisponibilidades(
        construirIndisponibilidades(respostas), indisponibilidadesCrossBase
      );
      const dados = { estatisticas, indisponibilidades };
      setDadosGeracao(dados);
      const s = gerarSugestaoApoio({ domingos, voluntarios, tamanhoEquipa: Number(tamanhoEquipa) || 1, ...dados });
      setSugestao(s);
      setAlertas(calcularAlertas({ domingos, voluntarios, resultado: s.resultado, contagemMes: s.contagemMes, estatisticas }));
      setPublicado(false);
    } catch (e) {
      torrada(e.message || "Não foi possível gerar a sugestão.");
    } finally {
      setACarregar(false);
    }
  }

  function regenerar() {
    if (!dadosGeracao) return gerar();
    const s = gerarSugestaoApoio({ domingos, voluntarios, tamanhoEquipa: Number(tamanhoEquipa) || 1, ...dadosGeracao });
    setSugestao(s);
    setAlertas(calcularAlertas({ domingos, voluntarios, resultado: s.resultado, contagemMes: s.contagemMes, estatisticas: dadosGeracao.estatisticas }));
    torrada("Sugestão regenerada");
  }

  function alternar(domingoId, pessoaId) {
    setSugestao((s) => {
      const atual = s.resultado[domingoId] || { pessoas: [], liderEscala: null };
      const dentro = atual.pessoas.includes(pessoaId);
      const pessoas = dentro ? atual.pessoas.filter((x) => x !== pessoaId) : [...atual.pessoas, pessoaId];
      let liderEscala = atual.liderEscala;
      if (dentro && liderEscala === pessoaId) liderEscala = null;
      if (!dentro && !liderEscala) liderEscala = pessoaId;
      return { ...s, resultado: { ...s.resultado, [domingoId]: { ...atual, pessoas, liderEscala, semCandidatosSuficientes: false } } };
    });
  }

  function definirLider(domingoId, pessoaId) {
    setSugestao((s) => {
      const atual = s.resultado[domingoId] || { pessoas: [], liderEscala: null };
      return { ...s, resultado: { ...s.resultado, [domingoId]: { ...atual, liderEscala: pessoaId } } };
    });
  }

  async function publicar() {
    if (!sugestao) return;
    setAConfirmarPublicar(false);
    setAPublicar(true);
    try {
      for (const d of domingos) {
        const item = sugestao.resultado[d.id] || { pessoas: [], liderEscala: null };
        await guardarEscala(d.id, { pessoas: item.pessoas, liderEscala: item.liderEscala });
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

  const contagemAvisos = useMemo(() => {
    let erros = 0, atencoes = 0;
    Object.values(avisosPorDomingo).forEach((porPessoa) => {
      Object.values(porPessoa || {}).forEach((a) => {
        if (a?.nivel === "erro") erros++;
        else if (a?.nivel === "atencao") atencoes++;
      });
    });
    return { erros, atencoes };
  }, [avisosPorDomingo]);

  return (
    <div className="sect">
      <div className="cabecalho"><h3>Escala sugerida</h3></div>
      <label className="rot">Mês</label>
      <input
        className="campo" type="month" value={mes} style={{ cursor: "pointer" }}
        onChange={(e) => setMes(e.target.value)}
        onClick={(e) => { try { e.target.showPicker?.(); } catch { /* browser sem suporte */ } }}
      />

      {enquete === undefined && <div className="vaz" style={{ marginTop: 10 }}>A carregar…</div>}
      {enquete === null && (
        <div className="vaz" style={{ marginTop: 10 }}>Ainda não há enquete de {mesLabel} — abre e fecha a enquete primeiro.</div>
      )}
      {enquete && enquete.estado !== "fechada" && (
        <div className="vaz" style={{ marginTop: 10 }}>A enquete de {mesLabel} ainda está aberta — fecha-a para gerar a escala.</div>
      )}

      {enquete && enquete.estado === "fechada" && !sugestao && (
        <>
          <label className="rot" style={{ marginTop: 14 }}>Tamanho da equipa por domingo</label>
          <input
            className="campo" type="number" min="1" max={voluntarios.length}
            value={tamanhoEquipa} onChange={(e) => setTamanhoEquipa(e.target.value)}
          />
          <button className="btn full" style={{ marginTop: 12 }} disabled={aCarregar} onClick={gerar}>
            {aCarregar ? "A gerar…" : "Gerar sugestão"}
          </button>
        </>
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
                <p key={i} style={{ fontSize: 12.5, marginTop: 8 }}>{ALERTA_ICONE[a.tipo] ?? "•"} {a.texto}</p>
              ))}
            </div>
          )}

          {domingos.map((d) => (
            <CartaoDomingo
              key={d.id} domingo={d} item={sugestao.resultado[d.id]} avisos={avisosPorDomingo[d.id]}
              voluntarios={voluntarios} onAlternar={alternar} onDefinirLider={definirLider}
            />
          ))}

          <p className="ds" style={{ marginTop: 12 }}>
            A estrela define o líder de escala. "Regenerar" volta a propor tudo do zero — publica assim que estiveres satisfeito.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn sec" style={{ flex: 1, fontSize: 13 }} disabled={aCarregar} onClick={regenerar}>
              Regenerar
            </button>
            <button className="btn" style={{ flex: 1, fontSize: 13 }} disabled={aPublicar} onClick={() => setAConfirmarPublicar(true)}>
              {aPublicar ? "A publicar…" : "Publicar escala"}
            </button>
          </div>

          {aConfirmarPublicar && (
            <>
              <div className="veu on" onClick={() => !aPublicar && setAConfirmarPublicar(false)} />
              <div className="pin on" role="dialog" aria-modal="true">
                <div className="pux" />
                <h2>Publicar a escala de {mesLabel}?</h2>
                <p className="sb2">
                  Isto grava a escala direto nos {domingos.length} cultos — não há como desfazer.
                  {(contagemAvisos.erros > 0 || contagemAvisos.atencoes > 0) && (
                    <>
                      {" "}Ainda ficam{contagemAvisos.erros > 0 && ` ${contagemAvisos.erros} 🔴`}
                      {contagemAvisos.atencoes > 0 && ` ${contagemAvisos.atencoes} ⚠️`} por resolver.
                    </>
                  )}
                </p>
                <button className="btn full" style={{ marginTop: 20 }} disabled={aPublicar} onClick={publicar}>
                  {aPublicar ? "A publicar…" : "Sim, publicar"}
                </button>
                <button className="btn sec full" style={{ marginTop: 9 }} disabled={aPublicar} onClick={() => setAConfirmarPublicar(false)}>
                  Cancelar
                </button>
              </div>
            </>
          )}

          {publicado && (
            <div className="caixa" style={{ marginTop: 14, background: "#EFFCE9", border: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--verde)" }}>Escala de {mesLabel} publicada</p>
              <p className="ds" style={{ marginTop: 4 }}>Já dá para ver em Escala, como qualquer outro culto.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
