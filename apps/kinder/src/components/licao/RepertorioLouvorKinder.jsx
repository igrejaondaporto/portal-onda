import { useEffect, useState } from "react";
import { ouvirRepertorioLouvorKinder, obterEscalaLouvorKinder, nomePapelLouvorKinder } from "../../lib/repertorioLouvorKinder";

const LINKS = [["video", "Vídeo"], ["letra", "Letra"], ["audio", "Áudio"]];

/** O repertório que o líder do Louvor Kinder escolheu para o culto, e
 *  quem toca (nome + instrumento) — no bloco da Lição do Início e no
 *  topo do box de cada culto em Lições, o mesmo para as três salas.
 *  Só leitura: montar e mudar é no painel do Louvor Kinder. Numeração
 *  só de músicas; um medley repete o número da música de antes (mesma
 *  regra do Repertório da Louvor e do cartão da Técnica). */
export default function RepertorioLouvorKinder({ eventoId }) {
  const [repertorio, setRepertorio] = useState(null);
  const [escala, setEscala] = useState([]);
  useEffect(() => ouvirRepertorioLouvorKinder(eventoId, setRepertorio), [eventoId]);
  useEffect(() => {
    let vivo = true;
    setEscala([]);
    obterEscalaLouvorKinder(eventoId).then((e) => vivo && setEscala(e));
    return () => { vivo = false; };
  }, [eventoId]);

  const itens = repertorio?.itens ?? [];
  const numero = {};
  let n = 0;
  itens.forEach((item, i) => {
    if (item.tipo !== "musica") return;
    if (!(item.medley === true && itens[i - 1]?.tipo === "musica")) n += 1;
    numero[item.id] = n;
  });

  return (
    <div className="kin-rep">
      <p className="kin-rep-tit">🎵 Louvor</p>
      {escala.length > 0 && (
        <div className="kin-rep-escala">
          {escala.map((p, i) => (
            <p key={i} className="kin-rep-quem">
              <b>{p.nome}</b>
              <span>{p.papeis.map(nomePapelLouvorKinder).join(" · ")}</span>
            </p>
          ))}
        </div>
      )}
      {itens.length === 0 ? (
        <p className="ds">O Louvor Kinder ainda não montou o repertório deste culto.</p>
      ) : itens.map((item, i) => {
        if (item.tipo === "momento") {
          return <div className="kin-rep-item momento" key={item.id}><p className="nmt">{item.nome}</p></div>;
        }
        const links = LINKS.filter(([k]) => item.links?.[k]);
        const medley = item.medley === true && itens[i - 1]?.tipo === "musica";
        return (
          <div className="kin-rep-item" key={item.id}>
            <div className="kin-rep-linha">
              <span className="kin-rep-num">{numero[item.id]}</span>
              <div className="kin-rep-capa" style={item.capaUrl ? { backgroundImage: `url(${item.capaUrl})` } : {}}>
                {!item.capaUrl && (item.titulo?.[0]?.toUpperCase() ?? "?")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="nmt">
                  {item.titulo ?? "Música removida"}
                  {medley && <span className="tag lim" style={{ marginLeft: 8 }}>medley</span>}
                </p>
                {item.artista && <p className="ds">{item.artista}</p>}
              </div>
            </div>
            {links.length > 0 && (
              <div className="kin-rep-links">
                {links.map(([k, nome]) => (
                  <a key={k} href={item.links[k]} target="_blank" rel="noreferrer" className="kin-rep-link">{nome}</a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
