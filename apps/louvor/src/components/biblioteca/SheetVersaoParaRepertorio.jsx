import { useEffect, useState } from "react";
import { ouvirVersoes } from "../../lib/biblioteca";
import { adicionarMusicaAoRepertorio } from "../../lib/repertorio";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/** Atalho "+ repertório" direto de um item da Biblioteca — pergunta
 *  só a versão (a música já é conhecida) e grava no culto que o
 *  chamador já resolveu (ver proximoEventoId em Biblioteca.jsx). */
export default function SheetVersaoParaRepertorio({ uid, musica, eventoId, onFechar, onAdicionada }) {
  const torrada = useTorrada();
  const [versoes, setVersoes] = useState([]);
  const [aGuardar, setAGuardar] = useState(false);

  useEffect(() => ouvirVersoes(musica.id, setVersoes), [musica.id]);

  async function escolher(versaoId) {
    if (aGuardar) return;
    if (!eventoId) { torrada("Nenhum culto encontrado este mês."); return; }
    setAGuardar(true);
    try {
      await adicionarMusicaAoRepertorio(eventoId, musica, versaoId, uid);
      torrada(`"${musica.titulo}" adicionada ao repertório`);
      onAdicionada?.();
    } catch (e) {
      torrada(e.message || "Não foi possível adicionar ao repertório.");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{musica.titulo}</h2>
        <p className="sb2">{musica.artista}</p>
        <p className="ds" style={{ textAlign: "center", marginTop: 8 }}>Qual versão entra no repertório?</p>
        <div style={{ marginTop: 12 }}>
          {versoes.map((v) => (
            <div
              className="linha" style={{ cursor: "pointer", opacity: aGuardar ? 0.6 : 1 }}
              key={v.id} onClick={() => escolher(v.id)}
            >
              <div style={{ flex: 1 }}>
                <p className="nmt">
                  {v.nome}
                  {v.id === musica.versaoPadraoId && <span className="tag lim" style={{ marginLeft: 8 }}>padrão</span>}
                </p>
                <p className="ds">{[v.tom && `Tom ${v.tom}`, v.bpm && `${v.bpm} BPM`].filter(Boolean).join(" · ") || "Sem dados"}</p>
              </div>
              <span className="seta">›</span>
            </div>
          ))}
          {versoes.length === 0 && (
            <button className="btn full" disabled={aGuardar} onClick={() => escolher(null)}>
              {aGuardar ? "A adicionar…" : "Adicionar sem versão definida"}
            </button>
          )}
        </div>
        <button className="btn sec full" style={{ marginTop: 14 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
