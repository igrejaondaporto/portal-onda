import { FASES } from "../../lib/modelo";
import { ordenarEscala, dataPorExtenso } from "@portal/shared/lib/data.js";
import Avatar from "@portal/shared/components/Avatar.jsx";

const nomeFase = (k) => (FASES.find((x) => x[0] === k) || FASES[0])[1];

export default function SheetEscolher({ funcao, evento, voluntarios, atribuicoes, onFechar, onAlternar, onLimpar, onNaoEscalado }) {
  if (!funcao) return null;
  const ids = atribuicoes[funcao.id] || [];
  // A Cloud Function atribuirFuncao só aceita quem está na escala
  // deste culto (validação no servidor, não só aqui) — um voluntário
  // acabado de criar não entra em nenhuma escala sozinho. Mostra-se
  // à mesma (para não desaparecer da lista sem explicação nenhuma,
  // que era o que acontecia antes), mas visivelmente por atribuir e
  // sem poder ser escolhido, com o motivo explicado — em vez de
  // deixar tentar e receber um erro só depois de tocar.
  const idsEscala = new Set(ordenarEscala(evento.escala));
  const daEscala = ordenarEscala(evento.escala).map((id) => voluntarios.find((p) => p.id === id)).filter(Boolean);
  const resto = voluntarios.filter((p) => !idsEscala.has(p.id)).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  const ordenados = [...daEscala.map((p) => ({ p, naEscala: true })), ...resto.map((p) => ({ p, naEscala: false }))];

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
          {ordenados.map(({ p, naEscala }) => {
            const sel = ids.includes(p.id);
            const nFuncoes = Object.values(atribuicoes).filter((lista) => lista.includes(p.id)).length;
            return (
              <button
                className="opcao" key={p.id}
                style={!naEscala ? { opacity: 0.55 } : undefined}
                onClick={() => (naEscala ? onAlternar(p.id) : onNaoEscalado?.(p))}
              >
                <Avatar pessoa={p} tamanho={38} fonte={15} />
                <span style={{ flex: 1 }}>
                  <b style={{ fontSize: 15.5, fontWeight: 700 }}>{p.nome}</b>
                  <span style={{ display: "block", fontSize: 12, color: naEscala ? "var(--cinza)" : "var(--magenta)" }}>
                    {naEscala
                      ? `${nFuncoes} ${nFuncoes === 1 ? "função" : "funções"}${evento.escala.liderEscala === p.id ? " · líder de escala" : ""}`
                      : "Ainda não está na escala deste culto"}
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
