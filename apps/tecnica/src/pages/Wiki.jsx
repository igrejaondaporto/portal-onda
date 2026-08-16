import { useEffect, useMemo, useState } from "react";
import { ouvirIndiceWiki } from "../lib/wiki";
import { agruparWikiPorMinisterio } from "../lib/wikiGrupos";
import { ouvirMinisterios, ouvirVoluntarios } from "../lib/painel";
import SheetArtigoWiki from "../components/wiki/SheetArtigoWiki";
import SheetDuvidaWiki from "../components/wiki/SheetDuvidaWiki";
import SheetEditorArtigo from "../components/wiki/SheetEditorArtigo";
import SheetNovaDuvida from "../components/wiki/SheetNovaDuvida";

export default function Wiki({ uid, papel, ativo, definirCabecalho, wikiIdFoco, focoSeq }) {
  const [itens, setItens] = useState([]);
  const [ministerios, setMinisterios] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState({});
  const [sheet, setSheet] = useState(null);

  useEffect(() => ouvirIndiceWiki(setItens), []);
  useEffect(() => ouvirMinisterios(setMinisterios), []);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);

  useEffect(() => {
    if (!wikiIdFoco) return;
    const item = itens.find((i) => i.id === wikiIdFoco);
    if (item) setSheet({ tipo: item.tipo, wikiId: item.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wikiIdFoco, focoSeq, itens.length]);

  const grupos = useMemo(
    () => agruparWikiPorMinisterio(itens, ministerios, busca),
    [itens, ministerios, busca]
  );

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Wiki",
      subtitulo: "Artigos e dúvidas da equipa",
      chips: [`${itens.length} publicados`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, itens.length]);

  const nomeMinisterio = (id) => ministerios.find((m) => m.id === id)?.nome;
  const corMinisterio = (id) => ministerios.find((m) => m.id === id)?.cor;

  function abrirItem(item) {
    setSheet({ tipo: item.tipo, wikiId: item.id });
  }

  return (
    <>
      <div className="sect">
        <input
          className="campo" value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Procurar por título, etiqueta ou texto"
        />
        <button className="btn sec full" style={{ marginTop: 10, padding: "10px 8px", fontSize: 13 }} onClick={() => setSheet({ tipo: "novoArtigo" })}>
          Novo artigo
        </button>
      </div>

      <div className="sect">
        {grupos.length === 0 && <div className="vaz">{busca ? "Nada encontrado." : "Ainda não há nada na Wiki — cria a primeira dúvida ou artigo."}</div>}
        {grupos.map((g) => {
          // A procurar, os grupos abrem sozinhos — quem escreveu uma
          // palavra quer ver o resultado, não abrir três cartões.
          const aberto = !!busca || !!abertos[g.chave];
          const cor = g.cor || "var(--cinza)";
          const emAberto = g.itens.filter((i) => i.tipo === "duvida" && !i.resolvida).length;
          return (
            <div className="mincartao" key={g.chave}>
              <div className="mincartao-barra" style={{ background: cor }} />
              <button
                className="mincartao-cab tec-grupo-cab tec-min"
                data-aberto={aberto ? 1 : 0}
                aria-expanded={aberto}
                onClick={() => setAbertos((v) => ({ ...v, [g.chave]: !v[g.chave] }))}
              >
                <span className="ponto" style={{ background: cor }} />
                <span className="nome">{g.nome}</span>
                <span className="conta">
                  {g.itens.length} {g.itens.length === 1 ? "item" : "itens"}
                  {emAberto > 0 && ` · ${emAberto} em aberto`}
                </span>
                <span className="tec-grupo-seta" aria-hidden="true">›</span>
              </button>
              {aberto && g.itens.map((item) => (
                <div className="linha" style={{ cursor: "pointer" }} key={`${g.chave}-${item.id}`} onClick={() => abrirItem(item)}>
                  <div style={{ flex: 1 }}>
                    <p className="nmt">{item.titulo}</p>
                    <p className="ds">
                      {item.ministerios?.map((id) => (
                        <span key={id} style={{ marginRight: 8 }}>
                          <span className="quadmin" style={{ background: corMinisterio(id) }} />{nomeMinisterio(id)}
                        </span>
                      ))}
                      {!item.ministerios?.length && "Geral"}
                    </p>
                  </div>
                  {item.tipo === "duvida" ? (
                    <span className={`tag ${item.resolvida ? "verd" : "cinz"}`}>{item.resolvida ? "resolvida" : "em aberto"}</span>
                  ) : item.esqueleto ? (
                    <span className="tag cinz">por escrever</span>
                  ) : null}
                  <span className="seta">›</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* No fim, e não no topo, de propósito: a pergunta só faz sentido
        * depois de teres aberto os grupos e procurado sem encontrar. É
        * esse o momento em que aparece. */}
      <div className="sect">
        <div className="tec-perguntar">
          <p className="nmt">Não encontraste o que procuravas?</p>
          <p className="ds">
            Pergunta à equipa. Quem souber responde, e a resposta fica aqui
            para a próxima pessoa que tiver a mesma dúvida.
          </p>
          <button className="btn sec full" style={{ marginTop: 12 }} onClick={() => setSheet({ tipo: "novaDuvida" })}>
            Coloca aqui a tua dúvida
          </button>
        </div>
      </div>

      {sheet?.tipo === "artigo" && (
        <SheetArtigoWiki
          wikiId={sheet.wikiId} ministerios={ministerios}
          onFechar={() => setSheet(null)}
          onEditar={(artigo) => setSheet({ tipo: "editorArtigo", artigo })}
        />
      )}
      {sheet?.tipo === "duvida" && (
        <SheetDuvidaWiki
          wikiId={sheet.wikiId} uid={uid} papel={papel} voluntarios={voluntarios}
          onFechar={() => setSheet(null)}
          onGuardado={() => setSheet(null)}
        />
      )}
      {sheet?.tipo === "editorArtigo" && (
        <SheetEditorArtigo
          artigo={sheet.artigo} ministerios={ministerios} uid={uid} papel={papel}
          onFechar={() => setSheet(null)}
          onGuardado={() => setSheet(null)}
        />
      )}
      {sheet?.tipo === "novoArtigo" && (
        <SheetEditorArtigo
          artigo={null} ministerios={ministerios} uid={uid} papel={papel}
          onFechar={() => setSheet(null)}
          onGuardado={() => setSheet(null)}
        />
      )}
      {sheet?.tipo === "novaDuvida" && (
        <SheetNovaDuvida
          ministerios={ministerios}
          onFechar={() => setSheet(null)}
          onGuardado={() => setSheet(null)}
        />
      )}
    </>
  );
}
