import { useRef, useState } from "react";
import { abrirMelhoria, enviarFotoMelhoria, novaMelhoriaId, GRAVIDADES } from "../../lib/melhorias";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const TAMANHO_MAX = 6 * 1024 * 1024;

/** Reportar uma avaria ou sugerir uma melhoria — qualquer voluntário.
 *  Quando aberta a partir de um equipamento (equipamentoId), esse
 *  equipamento passa a "avariado" automaticamente ao guardar. */
export default function SheetNovaMelhoria({ equipamento, ministerios, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const idRef = useRef(novaMelhoriaId());
  const inputFotoRef = useRef(null);
  const [titulo, setTitulo] = useState(equipamento ? `Avaria — ${equipamento.nome}` : "");
  const [descricao, setDescricao] = useState("");
  const [gravidade, setGravidade] = useState("atrapalha");
  const [ministerioId, setMinisterioId] = useState(equipamento?.ministerioId ?? null);
  const [foto, setFoto] = useState(null);
  const [aEnviarFoto, setAEnviarFoto] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  async function escolherFoto(e) {
    const ficheiro = e.target.files[0];
    e.target.value = "";
    if (!ficheiro) return;
    if (!ficheiro.type.startsWith("image/")) return torrada("Tem de ser uma imagem.");
    if (ficheiro.size >= TAMANHO_MAX) return torrada("A imagem tem de ter menos de 6 MB.");
    setAEnviarFoto(true);
    try {
      const url = await enviarFotoMelhoria(idRef.current, ficheiro);
      setFoto(url);
    } catch (e2) {
      torrada(e2.message || "Não foi possível enviar a foto.");
    } finally {
      setAEnviarFoto(false);
    }
  }

  async function guardar() {
    const t = titulo.trim();
    if (!t) return torrada("Dá um título curto ao problema");
    setAEnviar(true);
    try {
      await abrirMelhoria({
        melhoriaId: idRef.current, titulo: t, descricao: descricao.trim(), foto,
        equipamentoId: equipamento?.id ?? null, ministerioId, gravidade,
      });
      onGuardado("Melhoria aberta");
    } catch (e) {
      torrada(e.message || "Não foi possível abrir.");
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{equipamento ? "Reportar avaria" : "Nova melhoria"}</h2>
        <label className="rot" style={{ marginTop: 14 }}>Título</label>
        <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Canal 3 da mesa sem som" />
        <label className="rot">O que se passa</label>
        <textarea className="campo" rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreve o que reparaste" />
        <label className="rot">Gravidade</label>
        <div className="subtabs">
          {GRAVIDADES.map(([k, t]) => (
            <button key={k} data-on={gravidade === k ? 1 : 0} onClick={() => setGravidade(k)}>{t}</button>
          ))}
        </div>
        {ministerios?.length > 0 && (
          <>
            <label className="rot">Ministério (opcional)</label>
            <div className="subtabs">
              {ministerios.map((m) => (
                <button key={m.id} data-on={ministerioId === m.id ? 1 : 0} onClick={() => setMinisterioId(ministerioId === m.id ? null : m.id)}>{m.nome}</button>
              ))}
            </div>
          </>
        )}
        <label className="rot">Foto (opcional)</label>
        {foto && <img src={foto} className="fotofn" alt="" />}
        <input ref={inputFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={escolherFoto} />
        <button className="btn sec full" style={{ marginTop: 8 }} disabled={aEnviarFoto} onClick={() => inputFotoRef.current.click()}>
          {aEnviarFoto ? "A enviar…" : foto ? "Trocar foto" : "Juntar foto"}
        </button>
        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar || aEnviarFoto} onClick={guardar}>Abrir</button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
