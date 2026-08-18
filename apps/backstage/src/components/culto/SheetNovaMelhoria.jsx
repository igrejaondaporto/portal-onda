import { useRef, useState } from "react";
import { abrirMelhoria, enviarFotoMelhoria, novaMelhoriaId, GRAVIDADES } from "../../lib/melhorias";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import FotoRedonda from "@portal/shared/components/FotoRedonda.jsx";

const TAMANHO_MAX = 6 * 1024 * 1024;

/** Reportar algo a melhorar — qualquer voluntário. Sem equipamento nem
 *  ministério ligados (a Backstage não tem nenhum dos dois, ver
 *  CLAUDE.md desta app) — é sempre uma melhoria solta. */
export default function SheetNovaMelhoria({ onFechar, onGuardado }) {
  const torrada = useTorrada();
  const idRef = useRef(novaMelhoriaId());
  const inputFotoRef = useRef(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [gravidade, setGravidade] = useState("atrapalha");
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
        equipamentoId: null, ministerioId: null, gravidade, marcaAvaria: false,
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
        <h2>Reportar melhoria</h2>
        <p className="ds" style={{ marginTop: 10 }}>Fica registado para o líder e a equipa acompanharem até resolver.</p>
        <label className="rot" style={{ marginTop: 14 }}>Título</label>
        <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Falta ficha tripla na sala de som" />
        <label className="rot">O que se passa</label>
        <textarea className="campo" rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreve o que reparaste" />
        <label className="rot">Gravidade</label>
        <div className="subtabs">
          {GRAVIDADES.map(([k, t]) => (
            <button key={k} data-on={gravidade === k ? 1 : 0} onClick={() => setGravidade(k)}>{t}</button>
          ))}
        </div>
        <label className="rot" style={{ marginTop: 10 }}>Foto (opcional)</label>
        {foto && <div style={{ marginTop: 6 }}><FotoRedonda src={foto} alt={titulo} tamanho={72} /></div>}
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
