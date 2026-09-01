import { useState } from "react";
import { definirVersaoPadrao, CLASSIFICACOES } from "../../lib/biblioteca";
import { dataCurta } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import SheetVersao from "./SheetVersao";

const LINKS = [
  ["letra", "Letra"],
  ["cifra", "Cifra"],
  ["audio", "Áudio"],
  ["video", "Vídeo"],
];

export default function SheetMusicaDetalhe({ uid, souLider, musica, versoes, onFechar }) {
  const torrada = useTorrada();
  const [sheetVersao, setSheetVersao] = useState(null); // { versaoId } | { novo: true } | null
  const [aDefinir, setADefinir] = useState(null);

  async function marcarPadrao(versaoId) {
    setADefinir(versaoId);
    try {
      await definirVersaoPadrao(musica.id, versaoId);
      torrada("Versão padrão da Onda atualizada");
    } catch (e) {
      torrada(e.message || "Não foi possível definir a versão padrão.");
    } finally {
      setADefinir(null);
    }
  }

  const nomesClassif = (musica.classificacoes || []).map((id) => CLASSIFICACOES.find((c) => c.id === id)?.nome).filter(Boolean);
  const versoesOrdenadas = [...versoes].sort((a, b) => (a.id === musica.versaoPadraoId ? -1 : b.id === musica.versaoPadraoId ? 1 : 0));

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <div
          className="bib-capa-grande"
          style={musica.capaUrl ? { backgroundImage: `url(${musica.capaUrl})` } : {}}
        >
          {!musica.capaUrl && musica.titulo[0]?.toUpperCase()}
        </div>
        <h2 style={{ textAlign: "center", marginTop: 12 }}>{musica.titulo}</h2>
        <p className="sb2">{musica.artista}</p>
        {nomesClassif.length > 0 && (
          <p className="ds" style={{ textAlign: "center", marginTop: 4 }}>{nomesClassif.join(" · ")}</p>
        )}

        <div className="sect">
          <div className="cabecalho"><h3>Versões</h3></div>
          {versoesOrdenadas.map((v) => (
            <div className="linha" key={v.id}>
              <div style={{ flex: 1 }}>
                <p className="nmt">
                  {v.nome}
                  {v.id === musica.versaoPadraoId && <span className="tag lim" style={{ marginLeft: 8 }}>padrão da Onda</span>}
                </p>
                <p className="ds">
                  {[v.tom && `Tom ${v.tom}`, v.bpm && `${v.bpm} BPM`, v.duracao && `${Math.round(v.duracao / 60)} min`].filter(Boolean).join(" · ") || "Sem dados"}
                  {v.observacao ? ` · ${v.observacao}` : ""}
                </p>
              </div>
              {souLider && v.id !== musica.versaoPadraoId && (
                <button className="btn sec" style={{ padding: "8px 12px", fontSize: 12 }} disabled={aDefinir === v.id} onClick={() => marcarPadrao(v.id)}>
                  Marcar padrão
                </button>
              )}
              <button className="lapis" onClick={() => setSheetVersao({ versaoId: v.id })}>✎</button>
            </div>
          ))}
          {versoes.length === 0 && <div className="vaz">Sem versões ainda.</div>}
          <button className="btn sec full" style={{ marginTop: 12 }} onClick={() => setSheetVersao({ novo: true })}>
            Nova versão
          </button>
        </div>

        <div className="sect">
          <div className="cabecalho"><h3>Histórico</h3></div>
          <div className="linha">
            <div style={{ flex: 1 }}>
              <p className="nmt">Última vez tocada</p>
              <p className="ds">{musica.ultimaVezTocada ? dataCurta(musica.ultimaVezTocada.toDate?.().toISOString().slice(0, 10)) : "Nunca"}</p>
            </div>
            <span className="tag cinz">{musica.vezes90d ?? 0}× em 90 dias</span>
          </div>
        </div>

        {(LINKS.some(([k]) => musica.links?.[k]) || musica.autoral) && (
          <div className="sect">
            <div className="cabecalho"><h3>Links</h3></div>
            {LINKS.map(([k, t]) => musica.links?.[k] && (
              <a className="linha" key={k} href={musica.links[k]} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ flex: 1 }}><p className="nmt">{t}</p></div>
                <span className="seta">›</span>
              </a>
            ))}
            {musica.autoral && <p className="ds" style={{ marginTop: 8 }}>Música autoral, sem plataforma.</p>}
          </div>
        )}

        <button className="btn sec full" style={{ marginTop: 4 }} onClick={onFechar}>Fechar</button>
      </div>

      {sheetVersao && (
        <SheetVersao
          uid={uid} musicaId={musica.id}
          versao={sheetVersao.versaoId ? versoes.find((v) => v.id === sheetVersao.versaoId) : null}
          onFechar={() => setSheetVersao(null)}
          onGuardado={(msg) => { setSheetVersao(null); torrada(msg); }}
        />
      )}
    </>
  );
}
