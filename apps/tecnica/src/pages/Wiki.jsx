import { useEffect, useMemo, useState } from "react";
import { ouvirIndiceWiki } from "../lib/wiki";
import { ouvirMinisterios, ouvirVoluntarios } from "../lib/painel";
import SheetArtigoWiki from "../components/wiki/SheetArtigoWiki";
import SheetDuvidaWiki from "../components/wiki/SheetDuvidaWiki";
import SheetEditorArtigo from "../components/wiki/SheetEditorArtigo";
import SheetNovaDuvida from "../components/wiki/SheetNovaDuvida";

// sem acentos, minúsculas — para a busca não depender de o utilizador
// escrever "iluminação" com o acento certo
const normalizar = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Wiki({ uid, papel, pessoa, ativo, definirCabecalho, wikiIdFoco, focoSeq }) {
  const [itens, setItens] = useState([]);
  const [ministerios, setMinisterios] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [busca, setBusca] = useState("");
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

  const meusMinisterios = useMemo(
    () => ministerios.filter((m) => pessoa?.ministerios?.[m.id]).map((m) => m.id),
    [ministerios, pessoa]
  );

  const lista = useMemo(() => {
    const b = normalizar(busca);
    const filtrados = !b ? itens : itens.filter((i) =>
      normalizar(i.titulo).includes(b)
      || (i.etiquetas || []).some((e) => normalizar(e).includes(b))
      || normalizar(i.texto).includes(b)
    );
    return [...filtrados].sort((a, c) => {
      const duvidaAberta = (i) => i.tipo === "duvida" && !i.resolvida;
      if (duvidaAberta(a) !== duvidaAberta(c)) return duvidaAberta(a) ? -1 : 1;
      const meuA = a.ministerios?.some((m) => meusMinisterios.includes(m));
      const meuC = c.ministerios?.some((m) => meusMinisterios.includes(m));
      if (meuA !== meuC) return meuA ? -1 : 1;
      const ta = a.atualizadoEm?.toMillis?.() ?? 0, tc = c.atualizadoEm?.toMillis?.() ?? 0;
      return tc - ta;
    });
  }, [itens, busca, meusMinisterios]);

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
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="btn sec" style={{ flex: 1, padding: "10px 8px", fontSize: 13 }} onClick={() => setSheet({ tipo: "novaDuvida" })}>
            Nova dúvida
          </button>
          <button className="btn sec" style={{ flex: 1, padding: "10px 8px", fontSize: 13 }} onClick={() => setSheet({ tipo: "novoArtigo" })}>
            Novo artigo
          </button>
        </div>
      </div>

      <div className="sect">
        {lista.length === 0 && <div className="vaz">{busca ? "Nada encontrado." : "Ainda não há nada na Wiki — cria a primeira dúvida ou artigo."}</div>}
        {lista.map((item) => (
          <div className="linha" style={{ cursor: "pointer" }} key={item.id} onClick={() => abrirItem(item)}>
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
