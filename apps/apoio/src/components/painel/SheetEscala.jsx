import { useEffect, useState } from "react";
import { guardarEscala, obterEstatisticasEscala } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";
import { dataPorExtenso, dataCurta } from "@portal/shared/lib/data.js";

/**
 * Cada toque grava logo no Firestore — não há "guardar" no fim.
 * "Concluir" só fecha a folha.
 */
export default function SheetEscala({ evento, voluntarios, onFechar, onGuardado, onExcluir }) {
  const torrada = useTorrada();
  const [pessoas, setPessoas] = useState(evento?.escala?.pessoas ?? []);
  const [liderEscala, setLiderEscala] = useState(evento?.escala?.liderEscala ?? null);
  const [estatisticas, setEstatisticas] = useState({});
  const [ordem, setOrdem] = useState("vezes");

  useEffect(() => { obterEstatisticasEscala(90).then(setEstatisticas); }, []);

  if (!evento) return null;

  // grava otimista (o toque já muda o ecrã), mas se o servidor recusar
  // (ex.: pessoa já escalada nesse dia noutra base) desfaz e avisa —
  // nunca fica um estado no ecrã que não bateu certo com o gravado.
  async function persistir(novasPessoas, novoLider, anterior) {
    try {
      await guardarEscala(evento.id, { pessoas: novasPessoas, liderEscala: novoLider });
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setPessoas(anterior.pessoas);
      setLiderEscala(anterior.liderEscala);
    }
  }

  function alternar(id) {
    const anterior = { pessoas, liderEscala };
    let novoLider = liderEscala;
    const dentro = pessoas.includes(id);
    const novasPessoas = dentro ? pessoas.filter((x) => x !== id) : [...pessoas, id];
    if (dentro && liderEscala === id) novoLider = null;
    if (!dentro && !liderEscala) novoLider = id;
    setPessoas(novasPessoas);
    setLiderEscala(novoLider);
    persistir(novasPessoas, novoLider, anterior);
  }

  function definirLider(id) {
    const anterior = { pessoas, liderEscala };
    setLiderEscala(id);
    persistir(pessoas, id, anterior);
  }

  const voluntariosOrdenados = [...voluntarios].sort((a, b) => {
    if (ordem === "nome") return a.nome.localeCompare(b.nome, "pt");
    const va = estatisticas[a.id]?.vezes ?? 0;
    const vb = estatisticas[b.id]?.vezes ?? 0;
    return va - vb || a.nome.localeCompare(b.nome, "pt");
  });

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{evento.tipo || dataPorExtenso(evento.data)}</h2>
        <p className="sb2">{pessoas.length} pessoas · chegada {evento.horaChegada || "08:00"}</p>
        <p className="ds" style={{ textAlign: "center", marginTop: 8 }}>
          Toca no nome para juntar ou tirar da escala. A estrela define quem é o líder de escala.
        </p>
        <div className="subtabs" style={{ marginTop: 14 }}>
          <button data-on={ordem === "vezes" ? 1 : 0} onClick={() => setOrdem("vezes")}>Menos vezes primeiro</button>
          <button data-on={ordem === "nome" ? 1 : 0} onClick={() => setOrdem("nome")}>Nome</button>
        </div>
        <div style={{ marginTop: 12 }}>
          {voluntariosOrdenados.map((p) => {
            const dentro = pessoas.includes(p.id);
            const lid = liderEscala === p.id;
            const stat = estatisticas[p.id];
            const semServico = !stat?.vezes;
            const statTexto = semServico
              ? "Ainda não serviu neste trimestre"
              : `${stat.vezes} ${stat.vezes === 1 ? "vez" : "vezes"} · última a ${dataCurta(stat.ultima)}`;
            return (
              <div
                className="opcao" style={{ cursor: "default", ...(semServico ? { background: "rgba(214,32,105,.06)", borderRadius: 12 } : {}) }}
                key={p.id}
              >
                <span
                  onClick={() => alternar(p.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: "pointer" }}
                >
                  <Avatar pessoa={p} tamanho={38} fonte={15} />
                  <span style={{ flex: 1 }}>
                    <b style={{ fontSize: 15.5, fontWeight: 700 }}>{p.nome}</b>
                    <span style={{ display: "block", fontSize: 12, color: "var(--cinza)" }}>
                      {dentro ? (lid ? "líder de escala" : "na escala") : "fora deste culto"}
                    </span>
                    <span style={{ display: "block", fontSize: 12, marginTop: 2, color: semServico ? "var(--magenta)" : "var(--cinza)", fontWeight: semServico ? 600 : 400 }}>
                      {statTexto}
                      {stat?.liderVezes ? <span style={{ opacity: 0.75 }}> · {stat.liderVezes}x líder</span> : null}
                    </span>
                  </span>
                </span>
                {dentro && (
                  <button className={`estrela${lid ? " on" : ""}`} onClick={() => definirLider(p.id)} title="Líder de escala">
                    ★
                  </button>
                )}
                <span className={`chk${dentro ? " on" : ""}`} onClick={() => alternar(p.id)} style={{ cursor: "pointer" }}>
                  ✓
                </span>
              </div>
            );
          })}
        </div>
        <button className="btn full" style={{ marginTop: 20 }} onClick={() => onGuardado("Escala atualizada")}>
          Concluir
        </button>
        {evento.tipo && onExcluir && (
          <button
            className="btn sec full"
            style={{ marginTop: 9, color: "var(--magenta)" }}
            onClick={() => onExcluir(evento.id)}
          >
            Excluir este culto
          </button>
        )}
      </div>
    </>
  );
}
