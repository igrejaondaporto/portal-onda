import { useEffect, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { MESES, dataPorExtenso } from "@portal/shared/lib/data.js";
import CartaoCulto from "@portal/shared/components/CartaoCulto.jsx";
import { minhaSalaRestrita, nomeCategoria, souLider, souLiderGeral, souMestra, varsCategoria } from "../lib/modelo";
import { licoesDaSala, licoesVistas, marcarLicaoVista, desativarLicao } from "../lib/licoes";
import { ouvirEventosDoMes } from "../lib/painel";
import { hojeLocal } from "../lib/kinder";
import SeletorCategoria from "../components/SeletorCategoria";
import SheetLicao from "../components/licao/SheetLicao";
import Capacitacoes from "../components/licao/Capacitacoes";

/**
 * Lições (por sala, com a cor de cada uma) e Capacitações. O
 * documento (geralmente um PDF) vem da Kiwify pela mão da líder —
 * ver o porquê em lib/licoes.js.
 */
export default function Licao({ uid, papel, pessoa, mes, ano, mudarMes, ativo, definirCabecalho, licoes, abaInicial, onLicaoVista }) {
  const torrada = useTorrada();
  const lider = souLider(papel);
  const liderGeral = souLiderGeral(papel);
  const restrita = minhaSalaRestrita(papel, pessoa);
  const hoje = hojeLocal();
  const [aba, setAba] = useState(abaInicial ?? "licoes");
  const [sala, setSala] = useState(null);
  const [salaDefinida, setSalaDefinida] = useState(false);
  const [aberta, setAberta] = useState(null);
  const [aEditar, setAEditar] = useState(null); // { licao } — licao null = nova
  const [aRemover, setARemover] = useState(false);
  const [eventosMes, setEventosMes] = useState([]);
  const [abertos, setAbertos] = useState({});

  useEffect(() => { setAba(abaInicial ?? "licoes"); }, [abaInicial]);
  useEffect(() => {
    if (salaDefinida || !pessoa) return;
    setSala(restrita ?? (liderGeral ? null : pessoa?.categoria ?? null));
    setSalaDefinida(true);
  }, [pessoa, liderGeral, restrita, salaDefinida]);
  useEffect(() => { if (restrita) setSala(restrita); }, [restrita]);
  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);

  const vistas = licoesVistas(uid);
  const visiveis = licoesDaSala(licoes, sala);
  const novas = visiveis.filter((l) => !vistas.has(l.id)).length;
  const licaoAberta = licoes.find((l) => l.id === aberta) ?? null;
  // um bloco por culto do mês (estilo Escala) — dentro de cada um, as
  // lições desse dia; quem não tiver eventoId (ou for de outro mês)
  // cai na secção "sem culto marcado" abaixo, para nunca desaparecer.
  const idsEventosMes = new Set(eventosMes.map((e) => e.id));
  const semCultoMarcado = visiveis.filter((l) => !l.eventoId || !idsEventosMes.has(l.eventoId));
  // Mestra da própria sala ganha a mesma permissão da líder para
  // publicar/editar a lição do dia — mas só nesse culto específico
  // (o servidor, guardarLicaoKinder, confirma contra a Escala de
  // novo). Sem culto marcado, ou fora do mês visível, só a líder.
  const mestraNoEvento = (eventoId) => {
    const ev = eventosMes.find((e) => e.id === eventoId);
    return !!ev && souMestra(ev.escala, restrita, uid);
  };
  const podeCriarLicao = lider || (restrita && eventosMes.some((ev) => souMestra(ev.escala, restrita, uid)));
  const podeGerirLicaoAberta = lider || (restrita && mestraNoEvento(licaoAberta?.eventoId));

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho(aba === "licoes"
      ? { titulo: <em>Lição</em>, subtitulo: "As lições de cada sala, para preparar a semana", chips: [`${visiveis.length} lições`, ...(novas ? [`${novas} nova${novas === 1 ? "" : "s"}`] : [])] }
      : { titulo: <em>Capacitações</em>, subtitulo: "As formações do Kinder", chips: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, aba, visiveis.length, novas]);

  function abrir(l) {
    setAberta(l.id);
    setARemover(false);
    marcarLicaoVista(uid, l.id);
    onLicaoVista?.();
  }

  function linha(l) {
    return (
      <div key={l.id} className="kin-faixa" style={{ ...varsCategoria(l.categorias?.length === 1 ? l.categorias[0] : (sala ?? l.categorias?.[0])), cursor: "pointer" }} onClick={() => abrir(l)}>
        <div className="kin-faixa-cab">
          <h4>{l.titulo}</h4>
          {!vistas.has(l.id) && <span className="tag lim">Nova</span>}
        </div>
        <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(l.categorias || []).map((c) => <span key={c} className="kin-tagcat" style={varsCategoria(c)}>{nomeCategoria(c)}</span>)}
        </div>
        <p className="ds" style={{ marginTop: 6 }}>
          {l.eventoId ? `Para ${dataPorExtenso(l.eventoId)}` : "Sem culto marcado"}
          {l.recurso ? " · com recurso" : ""}
          {l.atividades?.length ? ` · ${l.atividades.length} ${l.atividades.length === 1 ? "atividade" : "atividades"}` : ""}
        </p>
      </div>
    );
  }

  async function remover() {
    try {
      await desativarLicao(licaoAberta.id);
      setAberta(null);
      torrada("Lição removida");
    } catch (e) {
      torrada(e.message || "Não foi possível remover.", true);
    }
  }

  return (
    <>
      <div className="subtabs">
        <button data-on={aba === "licoes" ? 1 : 0} onClick={() => setAba("licoes")}>Lições</button>
        <button data-on={aba === "capacitacoes" ? 1 : 0} onClick={() => setAba("capacitacoes")}>Capacitações</button>
      </div>

      {aba === "capacitacoes" ? <Capacitacoes uid={uid} papel={papel} pessoa={pessoa} /> : (
        <>
          <div className="sect">
            {restrita ? (
              <p className="kin-tagcat" style={varsCategoria(restrita)}>{nomeCategoria(restrita)}</p>
            ) : (
              <SeletorCategoria valor={sala} onMudar={setSala} />
            )}
            {podeCriarLicao && (
              <button className="btn full" style={{ marginTop: 10 }} onClick={() => setAEditar({ licao: null })}>Nova lição</button>
            )}
          </div>

          <div className="sect">
            <div className="cabecalho">
              <h3>{MESES[mes]} {ano}</h3>
              <span className="calnav">
                <button className="calbt" onClick={() => mudarMes(-1)}>‹</button>
                <button className="calbt" onClick={() => mudarMes(1)}>›</button>
              </span>
            </div>
            {eventosMes.length === 0 && <div className="vaz">Sem cultos criados neste mês.</div>}
            {eventosMes.map((ev) => {
              const doEvento = visiveis.filter((l) => l.eventoId === ev.id);
              const semVer = doEvento.filter((l) => !vistas.has(l.id)).length;
              return (
                <CartaoCulto
                  key={ev.id} evento={ev} hoje={hoje} sirvo={semVer > 0} aberto={!!abertos[ev.id]}
                  onAlternar={() => setAbertos((v) => ({ ...v, [ev.id]: !v[ev.id] }))}
                  resumo={doEvento.length
                    ? `${doEvento.length} ${doEvento.length === 1 ? "lição" : "lições"}${semVer ? ` · ${semVer} nova${semVer === 1 ? "" : "s"}` : ""}`
                    : "Ainda sem lição"}
                >
                  {doEvento.length === 0 ? (
                    <div className="vaz">
                      {sala ? `Ainda não há lição da sala ${nomeCategoria(sala)} para este culto.` : "Ainda não há lição para este culto."}
                    </div>
                  ) : doEvento.map(linha)}
                </CartaoCulto>
              );
            })}
          </div>

          {semCultoMarcado.length > 0 && (
            <div className="sect">
              <div className="cabecalho"><h3>Sem culto marcado</h3></div>
              {semCultoMarcado.map(linha)}
            </div>
          )}
          <p className="nota">Os documentos são o que a líder descarregou da Kiwify. O resumo é para preparar a aula.</p>
        </>
      )}

      {licaoAberta && !aEditar && (
        <>
          <div className="veu on" onClick={() => setAberta(null)} />
          <div className="pin on" role="dialog" aria-modal="true">
            <div className="pux" />
            <h2>{licaoAberta.titulo}</h2>
            <p className="sb2">{licaoAberta.eventoId ? dataPorExtenso(licaoAberta.eventoId) : "Sem culto marcado"}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
              {(licaoAberta.categorias || []).map((c) => <span key={c} className="kin-tagcat" style={varsCategoria(c)}>{nomeCategoria(c)}</span>)}
            </div>
            <div style={{ marginTop: 16 }}>
              {licaoAberta.licao && (
                <a className="btn full" style={{ display: "block", textAlign: "center", background: "var(--verde)" }} href={licaoAberta.licao.url} target="_blank" rel="noreferrer">
                  ABRIR LIÇÃO DO DIA
                </a>
              )}
              {licaoAberta.recurso && (
                <a className="btn full" style={{ marginTop: 9, display: "block", textAlign: "center", background: "var(--azul)" }} href={licaoAberta.recurso.url} target="_blank" rel="noreferrer">
                  ABRIR RECURSO
                </a>
              )}
              {(licaoAberta.atividades || []).map((a, i) => (
                <a key={i} className="btn sec full" style={{ marginTop: 9, display: "block", textAlign: "center" }} href={a.url} target="_blank" rel="noreferrer">
                  {`ABRIR ATIVIDADE ${i + 1}`}
                </a>
              ))}
            </div>
            {licaoAberta.resumo && (
              <>
                <p className="rot">Resumo</p>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-line" }}>{licaoAberta.resumo}</p>
              </>
            )}
            {licaoAberta.resumoPais && (
              <>
                <p className="rot">Para os pais</p>
                <div className="caixa"><p style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-line" }}>{licaoAberta.resumoPais}</p></div>
                <p className="ds" style={{ marginTop: 6 }}>Aparece no link da família de quem é desta sala.</p>
              </>
            )}
            {licaoAberta.louvor && (
              <>
                <p className="rot">Louvor</p>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-line" }}>{licaoAberta.louvor}</p>
              </>
            )}
            {podeGerirLicaoAberta && (
              <>
                <button className="btn sec full" style={{ marginTop: 16 }} onClick={() => setAEditar({ licao: licaoAberta })}>Editar</button>
                {aRemover ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                    <button className="btn" style={{ flex: 1, background: "var(--magenta)" }} onClick={remover}>Remover</button>
                    <button className="btn sec" style={{ flex: 1 }} onClick={() => setARemover(false)}>Cancelar</button>
                  </div>
                ) : (
                  <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={() => setARemover(true)}>Remover lição</button>
                )}
              </>
            )}
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => setAberta(null)}>Fechar</button>
          </div>
        </>
      )}

      {aEditar && (
        <SheetLicao
          licao={aEditar.licao} uid={uid} salaInicial={sala} restrita={restrita} lider={lider}
          onFechar={() => setAEditar(null)}
          onGuardado={(msg) => { setAEditar(null); torrada(msg); }}
        />
      )}
    </>
  );
}
