import { useState } from "react";
import { criarItemAcervo, guardarItemAcervo, novoItemAcervoId, desativarItemAcervo } from "../../lib/acervo";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const ORIGENS = ["Google Drive", "Canva", "Dropbox", "Outro"];

/** Categoria é obrigatória — pedido do líder: sem isso um item novo
 *  cai num "Sem categoria" que confunde quem acabou de criar uma
 *  categoria vazia ("bugou?"). Sem nenhuma categoria ainda, nem
 *  mostra o formulário — manda criar uma primeiro. */
export default function SheetItemAcervo({ item, categorias, onFechar, onGuardado, onDesativado }) {
  const torrada = useTorrada();
  const [titulo, setTitulo] = useState(item?.titulo ?? "");
  const [descricao, setDescricao] = useState(item?.descricao ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [linkInstagram, setLinkInstagram] = useState(item?.linkInstagram ?? "");
  const [thumbUrl, setThumbUrl] = useState(item?.thumbUrl ?? "");
  const [origem, setOrigem] = useState(item?.origem ?? "Google Drive");
  const [categoriaId, setCategoriaId] = useState(item?.categoriaId ?? categorias[0]?.id ?? "");
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    const t = titulo.trim();
    if (!t) return torrada("Falta o título.");
    if (!url.trim()) return torrada("Falta o link.");
    if (!categoriaId) return torrada("Falta escolher a categoria.");
    setAEnviar(true);
    try {
      const dados = {
        titulo: t, descricao: descricao.trim(), url: url.trim(),
        linkInstagram: linkInstagram.trim() || null,
        thumbUrl: thumbUrl.trim() || null, origem, categoriaId,
      };
      if (item) {
        await guardarItemAcervo(item.id, dados);
        onGuardado("Item atualizado");
      } else {
        await criarItemAcervo(novoItemAcervoId(), dados);
        onGuardado("Item adicionado ao acervo");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function desativar() {
    try {
      await desativarItemAcervo(item.id);
      onDesativado?.("Item removido do acervo");
    } catch (e) {
      torrada(e.message || "Não foi possível remover.");
    }
  }

  if (categorias.length === 0) {
    return (
      <>
        <div className="veu on" onClick={onFechar} />
        <div className="pin on" role="dialog" aria-modal="true">
          <div className="pux" />
          <h2>Falta uma categoria</h2>
          <p className="ds" style={{ marginTop: 10 }}>
            Todo item do acervo precisa de uma categoria. Cria a primeira ("Nova categoria") antes de adicionar itens.
          </p>
          <button className="btn sec full" style={{ marginTop: 18 }} onClick={onFechar}>Fechar</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{item ? "Editar item" : "Novo item do acervo"}</h2>

        <label className="rot" style={{ marginTop: 14 }}>Título</label>
        <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Fotos do Culto de Jovens — julho" />

        <label className="rot">Descrição (opcional)</label>
        <input className="campo" value={descricao} onChange={(e) => setDescricao(e.target.value)} />

        <label className="rot">Link</label>
        <input className="campo" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Drive, Canva, Dropbox…" />

        <label className="rot">Link do Instagram (opcional)</label>
        <input className="campo" value={linkInstagram} onChange={(e) => setLinkInstagram(e.target.value)} placeholder="Onde foi publicado" />

        <label className="rot">Miniatura (opcional)</label>
        <input className="campo" value={thumbUrl} onChange={(e) => setThumbUrl(e.target.value)} placeholder="Link de uma imagem" />

        <label className="rot">Origem</label>
        <div className="subtabs" style={{ marginTop: 0 }}>
          {ORIGENS.map((o) => (
            <button key={o} data-on={origem === o ? 1 : 0} onClick={() => setOrigem(o)}>{o}</button>
          ))}
        </div>

        <label className="rot">Categoria</label>
        <select className="campo" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>

        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>Guardar</button>
        {item && (
          <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={desativar}>
            Remover do acervo
          </button>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
