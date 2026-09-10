import { useEffect, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso } from "@portal/shared/lib/data.js";
import { categoriaInicial, nomeCategoria, souLider, varsCategoria } from "../lib/modelo";
import { licoesDaSala, licoesVistas, marcarLicaoVista, desativarLicao } from "../lib/licoes";
import SeletorCategoria from "../components/SeletorCategoria";
import SheetLicao from "../components/licao/SheetLicao";
import Capacitacoes from "../components/licao/Capacitacoes";

/**
 * Lições (por sala, com a cor de cada uma) e Capacitações. As lições
 * vêm da Kiwify pela mão da líder — ver o porquê em lib/licoes.js.
 */
export default function Licao({ uid, papel, pessoa, ativo, definirCabecalho, licoes, abaInicial, onLicaoVista }) {
  const torrada = useTorrada();
  const lider = souLider(papel);
  const [aba, setAba] = useState(abaInicial ?? "licoes");
  const [sala, setSala] = useState(null);
  const [salaDefinida, setSalaDefinida] = useState(false);
  const [aberta, setAberta] = useState(null);
  const [aEditar, setAEditar] = useState(null); // { licao } — licao null = nova
  const [aRemover, setARemover] = useState(false);

  useEffect(() => { setAba(abaInicial ?? "licoes"); }, [abaInicial]);
  useEffect(() => {
    if (salaDefinida || !pessoa) return;
    setSala(categoriaInicial(papel, pessoa));
    setSalaDefinida(true);
  }, [pessoa, papel, salaDefinida]);

  const vistas = licoesVistas(uid);
  const visiveis = licoesDaSala(licoes, sala);
  const novas = visiveis.filter((l) => !vistas.has(l.id)).length;
  const licaoAberta = licoes.find((l) => l.id === aberta) ?? null;

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

      {aba === "capacitacoes" ? <Capacitacoes uid={uid} papel={papel} /> : (
        <>
          <div className="sect">
            <SeletorCategoria valor={sala} onMudar={setSala} />
            {lider && (
              <button className="btn full" style={{ marginTop: 10 }} onClick={() => setAEditar({ licao: null })}>Nova lição</button>
            )}
            {visiveis.length === 0 && (
              <div className="vaz" style={{ marginTop: 12 }}>
                {sala ? `Ainda não há lições da sala ${nomeCategoria(sala)}.` : "Ainda não há lições."}
                {lider && <><br />Quando sair um vídeo novo na Kiwify, cola aqui o link.</>}
              </div>
            )}
            {visiveis.map((l) => (
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
                  {l.materiais?.length ? ` · ${l.materiais.length} materiais` : ""}
                </p>
              </div>
            ))}
          </div>
          <p className="nota">Os vídeos estão na área de membros da Kiwify. O que é preciso para preparar a aula fica aqui.</p>
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
            {licaoAberta.kiwifyUrl && (
              <>
                <a className="btn full" style={{ marginTop: 16, display: "block", textAlign: "center" }} href={licaoAberta.kiwifyUrl} target="_blank" rel="noreferrer">
                  Ver o vídeo na Kiwify
                </a>
                <p className="ds" style={{ textAlign: "center", marginTop: 6 }}>Abre com a conta do Kinder na Kiwify.</p>
              </>
            )}
            {licaoAberta.resumo && (
              <>
                <p className="rot">Resumo</p>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-line" }}>{licaoAberta.resumo}</p>
              </>
            )}
            {licaoAberta.materiais?.length > 0 && (
              <>
                <p className="rot">Materiais a preparar</p>
                {licaoAberta.materiais.map((m, i) => <div className="linha" key={i}><p className="nmt" style={{ fontSize: 14.5 }}>• {m}</p></div>)}
              </>
            )}
            {licaoAberta.arquivoUrl && (
              <a className="btn sec full" style={{ marginTop: 12, display: "block", textAlign: "center" }} href={licaoAberta.arquivoUrl} target="_blank" rel="noreferrer">
                Abrir documento ({licaoAberta.arquivoNome})
              </a>
            )}
            {licaoAberta.resumoPais && (
              <>
                <p className="rot">Para os pais</p>
                <div className="caixa"><p style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-line" }}>{licaoAberta.resumoPais}</p></div>
                <p className="ds" style={{ marginTop: 6 }}>Aparece no link da família de quem é desta sala.</p>
              </>
            )}
            {lider && (
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
          licao={aEditar.licao} uid={uid} salaInicial={sala}
          onFechar={() => setAEditar(null)}
          onGuardado={(msg) => { setAEditar(null); torrada(msg); }}
        />
      )}
    </>
  );
}
