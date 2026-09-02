import { useEffect, useState } from "react";
import { ouvirRepertorioLouvor } from "../../lib/repertorioLouvor";
import { nomeEvento, haAtras, hojeISO } from "@portal/shared/lib/data.js";

const LINKS = [["letra", "Letra"], ["cifra", "Cifra"], ["audio", "Áudio"], ["video", "Vídeo"]];

/** Um culto no separador Culto → Repertório — mesma casca do
 *  OrdemCultoCard (oc-cartao/oc-cab/oc-corpo), só de leitura: quem
 *  monta é a Base Louvor, a Técnica só acompanha para a projeção. Só
 *  mostra o que a decisão 8 do CLAUDE.md da Louvor deixa passar —
 *  nome, artista, capa, links e o aviso de medley; nunca tom, BPM
 *  nem outra observação (o item já vem sem esses campos, ver
 *  apps/louvor/src/pages/Repertorio.jsx). */
export default function RepertorioCard({ evento, aberto, onAbrir }) {
  const [repertorio, setRepertorio] = useState(null);
  const [medleyExpandidoId, setMedleyExpandidoId] = useState(null);

  // só ouve enquanto o cartão está aberto — mesma ideia do
  // OrdemCultoCard, um mês inteiro não precisa de um listener cada.
  useEffect(() => {
    if (!aberto) return;
    return ouvirRepertorioLouvor(evento.id, setRepertorio);
  }, [aberto, evento.id]);

  const itens = repertorio?.itens ?? [];
  const nMusicas = itens.filter((i) => i.tipo === "musica").length;

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
                  <div style={{ flex: 1 }}><p className="nmt">{item.nome}</p><p className="ds">Momento</p></div>
                </div>
              );
            }
            // reordenar na Louvor pode separar um medley de quem
            // estava antes — só desenha "colado" se ainda há mesmo
            // uma música logo antes na lista (ver Repertorio.jsx).
            const proximoEhMedley = itens[i + 1]?.tipo === "musica" && itens[i + 1]?.medley === true;
            const esteEhMedley = item.medley === true && itens[i - 1]?.tipo === "musica";
            const podeExpandir = esteEhMedley && !!item.observacaoMedley;
            return (
              <div key={item.id}>
                <div
                  className={`tec-rep-item${proximoEhMedley ? " medley-topo" : ""}${esteEhMedley ? " medley-cauda" : ""}`}
                  onClick={podeExpandir ? () => setMedleyExpandidoId((v) => (v === item.id ? null : item.id)) : undefined}
                >
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
                  {item.links && (
                    <div className="tec-rep-links">
                      {LINKS.filter(([k]) => item.links[k]).map(([k, nome]) => (
                        <a
                          key={k} href={item.links[k]} target="_blank" rel="noreferrer"
                          className="tag cinz" onClick={(e) => e.stopPropagation()}
                        >
                          {nome}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {podeExpandir && medleyExpandidoId === item.id && (
                  <div className="tec-rep-medley-obs">{item.observacaoMedley}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
