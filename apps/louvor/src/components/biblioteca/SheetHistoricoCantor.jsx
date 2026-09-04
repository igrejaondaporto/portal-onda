import { useEffect, useState } from "react";
import { ouvirIndiceCantor } from "../../lib/biblioteca";
import Avatar from "@portal/shared/components/Avatar.jsx";

/**
 * "Todas as músicas que este cantor já cantou" — pedido do líder,
 * junto com a mudança de mover o Histórico para dentro da Biblioteca.
 * Lê bases/louvor/indiceCantores/{pessoaId} (um documento só, ver
 * lib/biblioteca.js e functions/index.js,
 * registarHistoricoCantorLouvor) — sem query nenhuma. Consultar uma
 * música específica ("o que ela tocou há 3 meses") já é o que a busca
 * normal da Biblioteca + a secção Cantores em SheetMusicaDetalhe.jsx
 * fazem; isto é só o caminho inverso.
 */
export default function SheetHistoricoCantor({ voluntarios, onFechar, onAbrirMusica }) {
  const [cantor, setCantor] = useState(null);
  const [indice, setIndice] = useState(null);

  useEffect(() => {
    if (!cantor) { setIndice(null); return; }
    return ouvirIndiceCantor(cantor.id, setIndice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cantor?.id]);

  const musicas = [...(indice?.musicas || [])].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt"));

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Histórico por cantor</h2>

        {!cantor ? (
          <>
            <p className="sb2">Escolhe quem já cantou como Lead, para ver todas as músicas e tons</p>
            {voluntarios.map((p) => (
              <div className="linha" style={{ cursor: "pointer" }} key={p.id} onClick={() => setCantor(p)}>
                <Avatar pessoa={p} tamanho={34} fonte={13} />
                <div style={{ flex: 1 }}><p className="nmt">{p.nome}</p></div>
                <span className="seta">›</span>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="linha" style={{ cursor: "pointer", border: 0, padding: "0 0 10px" }} onClick={() => setCantor(null)}>
              <Avatar pessoa={cantor} tamanho={34} fonte={13} />
              <div style={{ flex: 1 }}><p className="nmt">{cantor.nome}</p></div>
              <span className="ds">trocar</span>
            </div>

            <label className="rot">
              {musicas.length ? `${musicas.length} música${musicas.length === 1 ? "" : "s"} como Lead` : "Ainda nenhuma música"}
            </label>
            {!musicas.length && <div className="vaz">Ainda não cantou nenhuma música como Lead.</div>}
            {musicas.map((m) => (
              <div className="linha" style={{ cursor: "pointer" }} key={m.musicaId} onClick={() => onAbrirMusica(m.musicaId)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="nmt">{m.titulo}</p>
                  <p className="ds">{m.artista}</p>
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 140 }}>
                  {(m.toms || []).map((t) => (
                    <span key={t.tom} className="tag cinz">{t.tom} · {t.vezes}×</span>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        <button className="btn sec full" style={{ marginTop: 16 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
