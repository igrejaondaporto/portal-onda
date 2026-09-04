import { useState } from "react";
import { definirVersaoPadrao, guardarMusica, CLASSIFICACOES } from "../../lib/biblioteca";
import { dataCurta } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import SheetVersao from "./SheetVersao";

const LINKS = [
  ["letra", "Letra"],
  ["cifra", "Cifra"],
  ["audio", "Áudio"],
  ["video", "Vídeo"],
];

/** null em vez de rebentar com um link mal formado — já aconteceu
 *  vir vazio ou só espaços de um cadastro manual. */
function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

/** Favicon do próprio site do link — carregado por domínio (serviço
 *  público do Google, sem chave), nunca por nós escolhido à mão: a
 *  Louvor não controla se um link é Cifra Club, Letras, Vagalume,
 *  Spotify ou outro qualquer que o líder tenha colado. Esconde-se
 *  sozinho se o favicon não existir (onError). */
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

export default function SheetMusicaDetalhe({ uid, souLider, musica, versoes, onFechar, onAdicionarRepertorio }) {
  const torrada = useTorrada();
  const [sheetVersao, setSheetVersao] = useState(null); // { versaoId } | { novo: true } | null
  const [aDefinir, setADefinir] = useState(null);
  const [aEditarLinks, setAEditarLinks] = useState(false);
  const [linksForm, setLinksForm] = useState({ letra: "", cifra: "", audio: "", video: "" });
  const [aGuardarLinks, setAGuardarLinks] = useState(false);

  function abrirEdicaoLinks() {
    setLinksForm({
      letra: musica.links?.letra || "",
      cifra: musica.links?.cifra || "",
      audio: musica.links?.audio || "",
      video: musica.links?.video || "",
    });
    setAEditarLinks(true);
  }

  async function guardarLinks() {
    setAGuardarLinks(true);
    try {
      await guardarMusica(musica.id, { links: linksForm });
      torrada("Links atualizados");
      setAEditarLinks(false);
    } catch (e) {
      torrada(e.message || "Não foi possível guardar os links.");
    } finally {
      setAGuardarLinks(false);
    }
  }

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
                {v.historico?.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                    {v.historico.map((h) => (
                      <span key={h.tom} className="tag cinz">{h.tom} · {(h.datas || []).length}×</span>
                    ))}
                  </div>
                )}
              </div>
              {souLider && v.id !== musica.versaoPadraoId && (
                <button className="btn sec" style={{ padding: "8px 12px", fontSize: 12 }} disabled={aDefinir === v.id} onClick={() => marcarPadrao(v.id)}>
                  Marcar padrão
                </button>
              )}
              {v.linkReferencia && (
                <a
                  className="lapis" href={v.linkReferencia} target="_blank" rel="noreferrer"
                  onClick={(e) => e.stopPropagation()} aria-label="Abrir referência deste tom" title="Referência deste tom"
                >
                  🔗
                </a>
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

        <div className="sect">
          <div className="cabecalho">
            <h3>Links</h3>
            {!aEditarLinks && (
              <button className="lapis" onClick={abrirEdicaoLinks} aria-label="Editar links">✎</button>
            )}
          </div>
          {aEditarLinks ? (
            <>
              {LINKS.map(([k, t]) => (
                <div key={k}>
                  <label className="rot">{t}</label>
                  <input
                    className="campo" value={linksForm[k]}
                    onChange={(e) => setLinksForm((f) => ({ ...f, [k]: e.target.value }))}
                    placeholder="https://…"
                  />
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn full" style={{ flex: 1 }} disabled={aGuardarLinks} onClick={guardarLinks}>
                  {aGuardarLinks ? "A guardar…" : "Guardar"}
                </button>
                <button className="btn sec full" style={{ flex: 1 }} onClick={() => setAEditarLinks(false)}>Cancelar</button>
              </div>
            </>
          ) : (
            <>
              {LINKS.map(([k, t]) => musica.links?.[k] && (
                <a className="linha" key={k} href={musica.links[k]} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                  <FaviconLink url={musica.links[k]} />
                  <div style={{ flex: 1 }}>
                    <p className="nmt">{t}</p>
                    {hostname(musica.links[k]) && <p className="ds">{hostname(musica.links[k])}</p>}
                  </div>
                  <span className="seta" style={{ color: "var(--cinza)" }}><IconeLinkExterno /></span>
                </a>
              ))}
              {!LINKS.some(([k]) => musica.links?.[k]) && !musica.autoral && <div className="vaz">Sem links ainda.</div>}
              {musica.autoral && <p className="ds" style={{ marginTop: 8 }}>Música autoral, sem plataforma.</p>}
            </>
          )}
        </div>

        {onAdicionarRepertorio && (
          <button className="btn full" style={{ marginTop: 16 }} onClick={onAdicionarRepertorio}>
            Adicionar ao repertório
          </button>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
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
