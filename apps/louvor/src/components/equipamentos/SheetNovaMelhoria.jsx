import { useRef, useState } from "react";
import { abrirMelhoria, enviarFotoMelhoria, novaMelhoriaId, GRAVIDADES } from "../../lib/melhorias";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import FotoRedonda from "@portal/shared/components/FotoRedonda.jsx";

const TAMANHO_MAX = 6 * 1024 * 1024;

/** Reportar uma avaria ou sugerir uma melhoria — qualquer voluntário.
 *
 *  `tipo` separa as duas coisas que se abrem sobre o mesmo equipamento:
 *  uma AVARIA põe-no fora de serviço ("o COB esquerdo está a piscar");
 *  uma MELHORIA fica ligada a ele sem o pôr em baixo ("comprar cabos
 *  XLR para testar"). É o `marcaAvaria` que a Cloud Function usa. */
export default function SheetNovaMelhoria({ equipamento, ministerios, tipo = "avaria", onFechar, onGuardado }) {
  const eAvaria = tipo !== "melhoria";
  const torrada = useTorrada();
  const idRef = useRef(novaMelhoriaId());
  const inputFotoRef = useRef(null);
  const varias = (equipamento?.quantidade ?? 1) > 1;
  const [titulo, setTitulo] = useState(
    equipamento ? `${eAvaria ? "Avaria" : "Melhoria"} — ${equipamento.nome} ` : "");
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
        marcaAvaria: eAvaria,
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
        <h2>{eAvaria ? "Reportar avaria" : "Reportar melhoria"}</h2>
        <p className="ds" style={{ marginTop: 10 }}>
          {eAvaria
            ? "O equipamento passa a aparecer como avariado até isto ficar resolvido."
            : "Fica registado como trabalho a fazer. O equipamento continua em serviço."}
        </p>
        {/* O registo é um só para as N unidades, por isso é aqui que se
          * diz qual delas — "COB esquerdo". Sem esta nota, quem reporta
          * escreve só "COB" e quem for arranjar não sabe a qual ir. */}
        {varias && eAvaria && (
          <p className="ds" style={{ marginTop: 6, color: "var(--magenta)", fontWeight: 700 }}>
            Há {equipamento.quantidade} unidades deste equipamento — diz no título qual delas.
          </p>
        )}
        <label className="rot" style={{ marginTop: 14 }}>Título</label>
        <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={eAvaria ? "Ex.: Canal 3 da mesa sem som" : "Ex.: Comprar cabos XLR suplentes"} />
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
