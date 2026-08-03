import { FASES } from "../../lib/modelo";
import { ordenarEscala, dataPorExtenso } from "../../lib/data";
import Avatar from "../Avatar";

const nomeFase = (k) => (FASES.find((x) => x[0] === k) || FASES[0])[1];

export default function SheetEscolher({ funcao, evento, voluntarios, atribuicoes, onFechar, onAlternar, onLimpar }) {
  if (!funcao) return null;
  const ids = atribuicoes[funcao.id] || [];
  const ordenados = ordenarEscala(evento.escala).map((id) => voluntarios.find((p) => p.id === id)).filter(Boolean);

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{funcao.nome}</h2>
        <p className="sb2">{nomeFase(funcao.fase)} · {dataPorExtenso(evento.data)}</p>
        <p className="ds" style={{ textAlign: "center", marginTop: 8 }}>
          Toca para juntar ou tirar. Podem ser várias pessoas.
        </p>
        <div style={{ marginTop: 16 }}>
          {ordenados.map((p) => {
            const sel = ids.includes(p.id);
            const nFuncoes = Object.values(atribuicoes).filter((lista) => lista.includes(p.id)).length;
            return (
              <button className="opcao" key={p.id} onClick={() => onAlternar(p.id)}>
                <Avatar pessoa={p} tamanho={38} fonte={15} />
                <span style={{ flex: 1 }}>
                  <b style={{ fontSize: 15.5, fontWeight: 700 }}>{p.nome}</b>
                  <span style={{ display: "block", fontSize: 12, color: "var(--cinza)" }}>
                    {nFuncoes} {nFuncoes === 1 ? "função" : "funções"}{evento.escala.liderEscala === p.id ? " · líder de escala" : ""}
                  </span>
                </span>
                <span className={`chk${sel ? " on" : ""}`}>✓</span>
              </button>
            );
          })}
          <button className="opcao" onClick={onLimpar}>
            <span className="av" style={{ width: 38, height: 38, fontSize: 15, background: "var(--agua)", color: "var(--cinza)" }}>—</span>
            <span style={{ flex: 1 }}>
              <b style={{ fontSize: 15.5, fontWeight: 700 }}>Deixar por atribuir</b>
              <span style={{ display: "block", fontSize: 12, color: "var(--cinza)" }}>Tira toda a gente desta função</span>
            </span>
          </button>
        </div>
        <button className="btn full" style={{ marginTop: 20 }} onClick={onFechar}>Concluir</button>
      </div>
    </>
  );
}
