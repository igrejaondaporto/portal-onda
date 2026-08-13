import { useRef, useState } from "react";
import { guardarArtigoWiki, desativarWiki, enviarFotoWikiPasso, novoWikiId } from "../../lib/wiki";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import SeletorMinisterios from "./SeletorMinisterios";

const TAMANHO_MAX = 6 * 1024 * 1024;

export default function SheetEditorArtigo({ artigo, ministerios, uid, papel, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const idRef = useRef(artigo?.id ?? novoWikiId());
  const inputFotoRef = useRef(null);
  const passoAlvo = useRef(null);
  const [titulo, setTitulo] = useState(artigo?.titulo ?? "");
  const [introducao, setIntroducao] = useState(artigo?.introducao ?? "");
  const [conclusao, setConclusao] = useState(artigo?.conclusao ?? "");
  const [passos, setPassos] = useState(artigo?.passos?.length ? artigo.passos : [{ texto: "", imagem: null }]);
  const [ministeriosSel, setMinisteriosSel] = useState(artigo?.ministerios ?? []);
  const [etiquetas, setEtiquetas] = useState((artigo?.etiquetas ?? []).join(", "));
  const [aEnviarFoto, setAEnviarFoto] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  function alternarMinisterio(id) {
    setMinisteriosSel((atual) => (atual.includes(id) ? atual.filter((m) => m !== id) : [...atual, id]));
  }

  function definirPasso(i, campo, valor) {
    setPassos((atual) => atual.map((p, idx) => (idx === i ? { ...p, [campo]: valor } : p)));
  }

  function adicionarPasso() {
    setPassos((atual) => [...atual, { texto: "", imagem: null }]);
  }

  function removerPasso(i) {
    setPassos((atual) => atual.filter((_, idx) => idx !== i));
  }

  function moverPasso(i, delta) {
    setPassos((atual) => {
      const j = i + delta;
      if (j < 0 || j >= atual.length) return atual;
      const novo = [...atual];
      [novo[i], novo[j]] = [novo[j], novo[i]];
      return novo;
    });
  }

  function escolherFotoPasso(i) {
    passoAlvo.current = i;
    inputFotoRef.current.click();
  }

  async function aoEscolherFicheiro(e) {
    const ficheiro = e.target.files[0];
    e.target.value = "";
    if (!ficheiro) return;
    if (!ficheiro.type.startsWith("image/")) return torrada("Tem de ser uma imagem.");
    if (ficheiro.size >= TAMANHO_MAX) return torrada("A imagem tem de ter menos de 6 MB.");
    const i = passoAlvo.current;
    setAEnviarFoto(true);
    try {
      const url = await enviarFotoWikiPasso(idRef.current, i, ficheiro);
      definirPasso(i, "imagem", url);
    } catch (e2) {
      torrada(e2.message || "Não foi possível enviar a foto.");
    } finally {
      setAEnviarFoto(false);
    }
  }

  async function guardar() {
    const t = titulo.trim();
    if (!t) return torrada("O artigo precisa de um título");
    setAEnviar(true);
    try {
      await guardarArtigoWiki({
        wikiId: idRef.current, titulo: t, introducao: introducao.trim(), conclusao: conclusao.trim(),
        passos, ministerios: ministeriosSel,
        etiquetas: etiquetas.split(",").map((e) => e.trim()).filter(Boolean),
      });
      onGuardado(artigo ? "Artigo atualizado" : "Artigo publicado");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function excluir() {
    try {
      await desativarWiki(artigo.id);
      onGuardado("Artigo excluído");
    } catch (e) {
      torrada(e.message || "Não foi possível excluir.");
    }
  }

  const podeExcluir = artigo && (papel === "lider_base" || artigo.autorId === uid);

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{artigo ? "Editar artigo" : "Novo artigo"}</h2>
        <label className="rot" style={{ marginTop: 14 }}>Título</label>
        <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Ligar a mesa de som" />
        {ministerios?.length > 0 && (
          <>
            <label className="rot">Ministério (opcional)</label>
            <SeletorMinisterios ministerios={ministerios} selecionados={ministeriosSel} onToggle={alternarMinisterio} />
          </>
        )}
        <label className="rot">Introdução</label>
        <textarea className="campo" rows={3} value={introducao} onChange={(e) => setIntroducao(e.target.value)} placeholder="Uma frase de contexto antes dos passos" />

        <label className="rot">Passos</label>
        <input ref={inputFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={aoEscolherFicheiro} />
        {passos.map((p, i) => (
          <div key={i} className="caixa" style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p className="cap">Passo {i + 1}</p>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn sec" style={{ padding: "5px 9px", fontSize: 12 }} disabled={i === 0} onClick={() => moverPasso(i, -1)}>↑</button>
                <button className="btn sec" style={{ padding: "5px 9px", fontSize: 12 }} disabled={i === passos.length - 1} onClick={() => moverPasso(i, 1)}>↓</button>
                {passos.length > 1 && (
                  <button className="btn sec" style={{ padding: "5px 9px", fontSize: 12, color: "var(--magenta)" }} onClick={() => removerPasso(i)}>✕</button>
                )}
              </div>
            </div>
            <textarea
              className="campo" rows={3} style={{ marginTop: 8 }} value={p.texto}
              onChange={(e) => definirPasso(i, "texto", e.target.value)} placeholder="O que fazer neste passo"
            />
            {p.imagem && <img src={p.imagem} className="fotofn" alt="" style={{ marginTop: 8 }} />}
            <button
              className="btn sec full" style={{ marginTop: 8 }} disabled={aEnviarFoto}
              onClick={() => escolherFotoPasso(i)}
            >
              {aEnviarFoto ? "A enviar…" : p.imagem ? "Trocar foto" : "Juntar foto"}
            </button>
          </div>
        ))}
        <button className="btn sec full" style={{ marginTop: 10 }} onClick={adicionarPasso}>+ Passo</button>

        <label className="rot" style={{ marginTop: 14 }}>Conclusão</label>
        <textarea className="campo" rows={2} value={conclusao} onChange={(e) => setConclusao(e.target.value)} placeholder="Como confirmar que ficou bem feito" />
        <label className="rot">Etiquetas (opcional, separadas por vírgula)</label>
        <input className="campo" value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} placeholder="som, propresenter" />

        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar || aEnviarFoto} onClick={guardar}>Guardar</button>
        {podeExcluir && (
          <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={excluir}>Excluir artigo</button>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
