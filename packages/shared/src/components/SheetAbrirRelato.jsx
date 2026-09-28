import { useState } from "react";
import { abrirRelato, ROTULO_TIPO_RELATO } from "../lib/relatos.js";
import { useTorrada } from "../lib/TorradaContext.jsx";

/** Reportar um bug/erro/melhoria — igual em qualquer base (ver
 *  CLAUDE.md raiz). Qualquer pessoa autenticada abre isto, não só o
 *  líder (pedido explícito do líder da Técnica, 2026-09: "reportados
 *  pelos líderes ou utilizadores dos painéis").
 *
 *  `paginaAtual` é opcional — cada app passa o que já tem no seu
 *  próprio state de navegação, só para dar contexto a quem vai triar
 *  (nunca bloqueia o envio se faltar). */
export default function SheetAbrirRelato({ paginaAtual = null, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [tipo, setTipo] = useState("bug");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [aEnviar, setAEnviar] = useState(false);

  async function enviar() {
    if (!titulo.trim()) return torrada("Falta um título curto.");
    if (!descricao.trim()) return torrada("Falta descrever o que aconteceu.");
    setAEnviar(true);
    try {
      await abrirRelato({ tipo, titulo: titulo.trim(), descricao: descricao.trim(), paginaOrigem: paginaAtual });
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

        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={enviar}>
          {aEnviar ? "A enviar…" : "Enviar relato"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
