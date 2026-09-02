import { useEffect, useState } from "react";
import { ouvirRepertorioLouvor } from "../../lib/repertorioLouvor";
import { nomeEvento, haAtras, hojeISO } from "@portal/shared/lib/data.js";

// Cifra sai de propósito aqui — é para quem toca, a projeção só cuida
// de letra/áudio/vídeo. Continua a existir na Biblioteca da Louvor.
const LINKS = [["letra", "Letra"], ["audio", "Áudio"], ["video", "Vídeo"]];

/** null em vez de rebentar com um link mal formado. */
function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

/** Favicon do próprio site do link (serviço público do Google, sem
 *  chave) — funciona como "logo do serviço" sem precisarmos de saber
 *  à mão se é Spotify, YouTube ou outro qualquer que o líder tenha
 *  colado. Cópia do mesmo componente em
 *  apps/louvor/src/components/biblioteca/SheetMusicaDetalhe.jsx —
 *  apps diferentes, sem import cruzado entre bundles. */
function FaviconLink({ url }) {
  const host = hostname(url);
  const [falhou, setFalhou] = useState(false);
  if (!host || falhou) return <span className="link-favicon-vazio" aria-hidden="true" />;
  return (
    <img
      className="link-favicon" alt="" width={16} height={16}
      src={`https://www.google.com/s2/favicons?sz=64&domain=${host}`}
      onError={() => setFalhou(true)}
    />
  );
}

function IconeLinkExterno() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

/** Um culto no separador Culto → Repertório — mesma casca do
 *  OrdemCultoCard (oc-cartao/oc-cab/oc-corpo), só de leitura: quem
 *  monta é a Base Louvor, a Técnica só acompanha para a projeção. Só
 *  mostra o que a decisão 8 do CLAUDE.md da Louvor deixa passar —
 *  nome, artista, capa, links, a numeração de ordem e o aviso de
 *  medley; nunca tom, BPM nem outra observação (o item já vem sem
 *  esses campos, ver apps/louvor/src/pages/Repertorio.jsx). */
export default function RepertorioCard({ evento, aberto, onAbrir }) {
  const [repertorio, setRepertorio] = useState(null);
  // Observação do medley visível por omissão — só entra aqui quem foi
  // explicitamente fechado (o oposto do que "expandido" seria).
  const [medleysFechados, setMedleysFechados] = useState(() => new Set());

  function alternarMedleyFechado(id) {
    setMedleysFechados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  // só ouve enquanto o cartão está aberto — mesma ideia do
  // OrdemCultoCard, um mês inteiro não precisa de um listener cada.
  useEffect(() => {
    if (!aberto) return;
    return ouvirRepertorioLouvor(evento.id, setRepertorio);
  }, [aberto, evento.id]);

  const itens = repertorio?.itens ?? [];
  const nMusicas = itens.filter((i) => i.tipo === "musica").length;

  // Numeração 1ª/2ª/3ª… só conta músicas; um medley conta como a
  // MESMA música da que veio antes (mesmo bloco), por isso repete o
  // número em vez de avançar — ver a mesma lógica em Repertorio.jsx.
  const numerosOrdinais = {};
  let n = 0;
  itens.forEach((item, i) => {
    if (item.tipo !== "musica") return;
    const continuaMedley = item.medley === true && itens[i - 1]?.tipo === "musica";
    if (!continuaMedley) n += 1;
    numerosOrdinais[item.id] = n;
  });

  return (
    <div className="oc-cartao">
      <button className="oc-cab" data-aberto={aberto ? 1 : 0} onClick={onAbrir}>
        <div>
          <p className="nm">
            {nomeEvento(evento)}
            {evento.data === hojeISO() && <span className="tag lim" style={{ verticalAlign: "middle", marginLeft: 8 }}>hoje</span>}
          </p>
          <p className="ds">
            {repertorio
              ? `${nMusicas} música${nMusicas === 1 ? "" : "s"} · atualizado ${haAtras(repertorio.atualizadoEm)}`
              : "Ainda sem repertório montado"}
          </p>
        </div>
        <span className="seta">›</span>
      </button>

      {aberto && (
        <div className="oc-corpo">
          {itens.length === 0 && <div className="vaz">A Louvor ainda não montou o repertório deste culto.</div>}
          {itens.map((item, i) => {
            if (item.tipo === "momento") {
              return (
                <div className="tec-rep-item momento" key={item.id}>
                  <div className="tec-rep-linha">
                    <div style={{ flex: 1 }}><p className="nmt">{item.nome}</p><p className="ds">Momento</p></div>
                  </div>
                </div>
              );
            }
            // reordenar na Louvor pode separar um medley de quem
            // estava antes — só desenha "colado" se ainda há mesmo
            // uma música logo antes na lista (ver Repertorio.jsx).
            const proximoEhMedley = itens[i + 1]?.tipo === "musica" && itens[i + 1]?.medley === true;
            const esteEhMedley = item.medley === true && itens[i - 1]?.tipo === "musica";
            const podeExpandir = esteEhMedley && !!item.observacaoMedley;
            const linksDaMusica = LINKS.filter(([k]) => item.links?.[k]);
            return (
              <div key={item.id}>
                <div
                  className={`tec-rep-item${proximoEhMedley ? " medley-topo" : ""}${esteEhMedley ? " medley-cauda" : ""}`}
                  onClick={podeExpandir ? () => alternarMedleyFechado(item.id) : undefined}
                >
                  <div className="tec-rep-linha">
                    <span className="tec-rep-num">{numerosOrdinais[item.id]}ª</span>
                    <div className="tec-rep-capa" style={item.capaUrl ? { backgroundImage: `url(${item.capaUrl})` } : {}}>
                      {!item.capaUrl && (item.titulo?.[0]?.toUpperCase() ?? "?")}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="nmt">
                        {item.titulo ?? "Música removida"}
                        {esteEhMedley && <span className="tag lim" style={{ marginLeft: 8 }}>medley</span>}
                      </p>
                      <p className="ds">{item.artista ?? ""}</p>
                    </div>
                  </div>
                  {linksDaMusica.length > 0 && (
                    <div className="tec-rep-links">
                      {linksDaMusica.map(([k, nome]) => (
                        <a
                          key={k} href={item.links[k]} target="_blank" rel="noreferrer"
                          className="tec-rep-link-botao" onClick={(e) => e.stopPropagation()}
                        >
                          <FaviconLink url={item.links[k]} />
                          <span>{nome}</span>
                          <IconeLinkExterno />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {podeExpandir && !medleysFechados.has(item.id) && (
                  <div className="tec-rep-medley-obs">"{item.observacaoMedley}"</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
