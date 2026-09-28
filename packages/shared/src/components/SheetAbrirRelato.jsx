import { useRef, useState } from "react";
import { abrirRelato, novoIdRelato, enviarAnexoRelato, ROTULO_TIPO_RELATO } from "../lib/relatos.js";
import { useTorrada } from "../lib/TorradaContext.jsx";

const TAMANHO_MAX_VIDEO = 20 * 1024 * 1024; // mesmo teto do storage.rules

/** Reportar um problema/bug ou melhoria, com anexo opcional (foto ou
 *  vídeo) — igual em qualquer base (ver CLAUDE.md raiz). Qualquer
 *  pessoa autenticada abre isto, não só o líder (pedido explícito do
 *  líder da Técnica, 2026-09: "reportados pelos líderes ou
 *  utilizadores dos painéis").
 *
 *  `paginaAtual` é opcional — cada app passa o que já tem no seu
 *  próprio state de navegação, só para dar contexto a quem vai triar
 *  (nunca bloqueia o envio se faltar). */
export default function SheetAbrirRelato({ paginaAtual = null, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const inputAnexoRef = useRef(null);
  const [tipo, setTipo] = useState("bug");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [anexo, setAnexo] = useState(null); // File | null
  const [aEnviar, setAEnviar] = useState(false);

  function escolherAnexo(e) {
    const ficheiro = e.target.files[0];
    e.target.value = "";
    if (!ficheiro) return;
    const imagem = ficheiro.type.startsWith("image/");
    const video = ficheiro.type.startsWith("video/");
    if (!imagem && !video) return torrada("Só imagens ou vídeos.");
    if (video && ficheiro.size >= TAMANHO_MAX_VIDEO) return torrada("O vídeo tem de ter menos de 20 MB.");
    setAnexo(ficheiro);
  }

  async function enviar() {
    if (!titulo.trim()) return torrada("Falta um título curto.");
    if (!descricao.trim()) return torrada("Falta descrever o que aconteceu.");
    setAEnviar(true);
    try {
      const id = novoIdRelato();
      // sobe primeiro (se houver) — abrirRelato só grava o URL já
      // pronto, nunca lida com o ficheiro em si
      const comAnexo = anexo ? await enviarAnexoRelato(id, anexo) : {};
      await abrirRelato({ id, tipo, titulo: titulo.trim(), descricao: descricao.trim(), paginaOrigem: paginaAtual, ...comAnexo });
      onGuardado("Relato enviado ao Onda Tech Hub");
    } catch (e) {
      torrada(e.message || "Não foi possível enviar.");
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Reportar um problema</h2>
        <p className="sb2">O Onda Tech Hub vê isto e trata.</p>

        <label className="rot" style={{ marginTop: 14 }}>O que é</label>
        <select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {Object.entries(ROTULO_TIPO_RELATO).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>

        <label className="rot">Título</label>
        <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Um resumo curto" />

        <label className="rot">O que aconteceu</label>
        <textarea className="campo" rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreve o que viste — quanto mais detalhe, mais fácil de corrigir" />

        <label className="rot">Foto ou vídeo (opcional)</label>
        <input ref={inputAnexoRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={escolherAnexo} />
        <button className="btn sec" style={{ marginTop: 4 }} disabled={aEnviar} onClick={() => inputAnexoRef.current.click()}>
          {anexo ? "Trocar ficheiro" : "Anexar"}
        </button>
        {anexo && (
          <p className="ds" style={{ marginTop: 8 }}>
            {anexo.name} · <a onClick={() => setAnexo(null)} style={{ cursor: "pointer", color: "var(--magenta)" }}>remover</a>
          </p>
        )}
        <p className="ds" style={{ marginTop: 8 }}>
          Apagado assim que o Onda Tech Hub marcar como concluído.
        </p>

        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={enviar}>
          {aEnviar ? (anexo ? "A enviar anexo…" : "A enviar…") : "Enviar relato"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
