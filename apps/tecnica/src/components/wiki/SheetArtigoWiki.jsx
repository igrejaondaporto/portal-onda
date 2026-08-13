import { useEffect, useState } from "react";
import { ouvirArtigo } from "../../lib/wiki";

/** Leitura de um artigo — qualquer voluntário pode "Editar" (a Wiki é
 *  colaborativa, não tem dono): é assim que um esqueleto do líder vira
 *  conteúdo de verdade. */
export default function SheetArtigoWiki({ wikiId, ministerios, onFechar, onEditar }) {
  const [artigo, setArtigo] = useState(null);

  useEffect(() => ouvirArtigo(wikiId, setArtigo), [wikiId]);

  const nomeMinisterio = (id) => ministerios.find((m) => m.id === id)?.nome;
  const corMinisterio = (id) => ministerios.find((m) => m.id === id)?.cor;

  if (!artigo) return null;

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{artigo.titulo}</h2>
        {artigo.ministerios?.length > 0 && (
          <p className="ds" style={{ marginTop: 6 }}>
            {artigo.ministerios.map((id) => (
              <span key={id} style={{ marginRight: 10 }}>
                <span className="quadmin" style={{ background: corMinisterio(id) }} />{nomeMinisterio(id)}
              </span>
            ))}
          </p>
        )}
        {artigo.esqueleto ? (
          <div className="caixa" style={{ background: "var(--agua)", border: 0, marginTop: 14 }}>
            <p className="ds">Ainda por escrever — toca em "Escrever" para reclamar este artigo.</p>
          </div>
        ) : (
          <>
            {artigo.introducao && <p style={{ marginTop: 14, lineHeight: 1.6 }}>{artigo.introducao}</p>}
            {artigo.passos?.map((p, i) => (
              <div key={i} className="caixa" style={{ marginTop: 12 }}>
                <p className="cap">Passo {i + 1}</p>
                <p style={{ marginTop: 6, lineHeight: 1.6 }}>{p.texto}</p>
                {p.imagem && <img src={p.imagem} className="fotofn" alt="" style={{ marginTop: 8 }} />}
              </div>
            ))}
            {artigo.conclusao && <p style={{ marginTop: 14, lineHeight: 1.6 }}>{artigo.conclusao}</p>}
          </>
        )}
        <button className="btn full" style={{ marginTop: 18 }} onClick={() => onEditar(artigo)}>
          {artigo.esqueleto ? "Escrever" : "Editar"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
