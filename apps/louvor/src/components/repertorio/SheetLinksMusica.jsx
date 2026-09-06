import { useEffect, useState } from "react";
import { ouvirVersoes } from "../../lib/biblioteca";
import IconeYoutube from "../biblioteca/IconeYoutube";

/** Mesma lista de SheetMusicaDetalhe.jsx (Biblioteca) — duplicada de
 *  propósito, não importada de lá: aquele ficheiro é da Biblioteca,
 *  este é do Repertório, cada um com o seu ciclo de vida. */
const LINKS_MUSICA = [
  ["letra", "Letra"],
  ["cifra", "Cifra"],
  ["audio", "Áudio"],
  ["video", "Vídeo"],
];

/** null em vez de rebentar com um link mal formado. */
function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

function FaviconLink({ url }) {
  const host = hostname(url);
  const [falhou, setFalhou] = useState(false);
  if (!host || falhou) return <span className="link-favicon-vazio" aria-hidden="true" />;
  return (
    <img
      className="link-favicon" alt="" width={20} height={20}
      src={`https://www.google.com/s2/favicons?sz=64&domain=${host}`}
      onError={() => setFalhou(true)}
    />
  );
}

function IconeLinkExterno() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

/**
 * Todos os links de uma música, num só sítio — toca no nome da música
 * dentro do Repertório (ver Repertorio.jsx). Junta os links da própria
 * música (letra/cifra/áudio/vídeo, os mesmos de SheetMusicaDetalhe) e
 * o link de referência de cada versão que tiver um (linkReferencia,
 * ver SheetVersao.jsx) — "TODOS os links que a música tem", pedido do
 * líder, 2026-09. Só mostra, não edita — os links de versão editam-se
 * pelo botão ao lado do Tom (SheetEditarLink.jsx, outra coisa) e os da
 * música pela Biblioteca; isto é uma vista de leitura mesmo.
 */
export default function SheetLinksMusica({ musica, onFechar }) {
  const [versoes, setVersoes] = useState([]);

  useEffect(() => ouvirVersoes(musica.id, setVersoes), [musica.id]);

  const linksMusica = LINKS_MUSICA.filter(([k]) => musica.links?.[k]);
  const linksVersao = versoes.filter((v) => v.linkReferencia);
  const semLinks = !linksMusica.length && !linksVersao.length;

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Links · {musica.titulo}</h2>
        <p className="sb2">{musica.artista}</p>

        {linksMusica.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {linksMusica.map(([k, t]) => (
              <a className="linha" key={k} href={musica.links[k]} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                <FaviconLink url={musica.links[k]} />
                <div style={{ flex: 1 }}>
                  <p className="nmt">{t}</p>
                  {hostname(musica.links[k]) && <p className="ds">{hostname(musica.links[k])}</p>}
                </div>
                <span className="seta" style={{ color: "var(--cinza)" }}><IconeLinkExterno /></span>
              </a>
            ))}
          </div>
        )}

        {linksVersao.length > 0 && (
          <div style={{ marginTop: linksMusica.length ? 4 : 12 }}>
            {linksMusica.length > 0 && <label className="rot" style={{ marginTop: 10 }}>Por versão</label>}
            {linksVersao.map((v) => (
              <a className="linha" key={v.id} href={v.linkReferencia} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                <IconeYoutube />
                <div style={{ flex: 1 }}>
                  <p className="nmt">Versão "{v.nome}"</p>
                  {hostname(v.linkReferencia) && <p className="ds">{hostname(v.linkReferencia)}</p>}
                </div>
                <span className="seta" style={{ color: "var(--cinza)" }}><IconeLinkExterno /></span>
              </a>
            ))}
          </div>
        )}

        {semLinks && <div className="vaz">Sem links ainda.</div>}

        <button className="btn sec full" style={{ marginTop: 16 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
