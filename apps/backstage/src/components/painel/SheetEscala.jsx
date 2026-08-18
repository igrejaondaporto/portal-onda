import { useEffect, useState } from "react";
import { guardarEscala, obterEstatisticasEscala, dispensarBaseDeEvento, reincluirBaseEmEvento } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { BASE_ID } from "@portal/shared/lib/firebase.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import { nomeEvento, dataCurta, concordar } from "@portal/shared/lib/data.js";

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
  const [aDispensar, setADispensar] = useState(false);
  const [dispensada, setDispensada] = useState((evento?.dispensadaPor || []).includes(BASE_ID));

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

  // a Backstage escala só uma pessoa por culto (não uma equipa, ver
  // CLAUDE.md desta app) — tocar noutra pessoa substitui quem lá
  // estava, nunca acumula. Tocar na mesma pessoa outra vez limpa.
  function escolher(id) {
    const anterior = { pessoas, liderEscala };
    const jaEEssa = pessoas.length === 1 && pessoas[0] === id;
    const novasPessoas = jaEEssa ? [] : [id];
    const novoLider = jaEEssa ? null : id;
    setPessoas(novasPessoas);
    setLiderEscala(novoLider);
    persistir(novasPessoas, novoLider, anterior);
  }

  async function alternarDispensa() {
    setADispensar(true);
    try {
      if (dispensada) {
        await reincluirBaseEmEvento(evento.id);
        setDispensada(false);
        torrada("De volta à escala deste evento");
      } else {
        await dispensarBaseDeEvento(evento.id);
        setDispensada(true);
        torrada("A base não serve neste evento");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    } finally {
      setADispensar(false);
    }
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
        <h2>{nomeEvento(evento)}</h2>
        <p className="sb2">
          {pessoas.length ? concordar(voluntarios.find((v) => v.id === pessoas[0]), "Escalado", "Escalada") : "Por escalar"}
          {" · chegada "}{evento.horaChegada || "08:00"}
        </p>
        <p className="ds" style={{ textAlign: "center", marginTop: 8 }}>
          Um só nome por culto — tocar noutro substitui quem estava.
        </p>
        <div className="subtabs" style={{ marginTop: 14 }}>
          <button data-on={ordem === "vezes" ? 1 : 0} onClick={() => setOrdem("vezes")}>Menos vezes primeiro</button>
          <button data-on={ordem === "nome" ? 1 : 0} onClick={() => setOrdem("nome")}>Nome</button>
        </div>
        <div style={{ marginTop: 12 }}>
          {voluntariosOrdenados.map((p) => {
            const dentro = pessoas.includes(p.id);
            const stat = estatisticas[p.id];
            const semServico = !stat?.vezes;
            const statTexto = semServico
              ? "Ainda não serviu neste trimestre"
              : `${stat.vezes} ${stat.vezes === 1 ? "vez" : "vezes"} · última a ${dataCurta(stat.ultima)}`;
            return (
              <div
                className="opcao" style={{ cursor: "pointer", ...(semServico ? { background: "rgba(214,32,105,.06)", borderRadius: 12 } : {}) }}
                key={p.id} onClick={() => escolher(p.id)}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                  <Avatar pessoa={p} tamanho={38} fonte={15} />
                  <span style={{ flex: 1 }}>
                    <b style={{ fontSize: 15.5, fontWeight: 700 }}>{p.nome}</b>
                    <span style={{ display: "block", fontSize: 12, color: "var(--cinza)" }}>
                      {dentro ? concordar(p, "escalado", "escalada") : "fora deste culto"}
                    </span>
                    <span style={{ display: "block", fontSize: 12, marginTop: 2, color: semServico ? "var(--magenta)" : "var(--cinza)", fontWeight: semServico ? 600 : 400 }}>
                      {statTexto}
                      {stat?.liderVezes ? <span style={{ opacity: 0.75 }}> · {stat.liderVezes}x líder</span> : null}
                    </span>
                  </span>
                </span>
                <span className={`chk${dentro ? " on" : ""}`}>✓</span>
              </div>
            );
          })}
        </div>
        <button className="btn full" style={{ marginTop: 20 }} onClick={() => onGuardado("Escala atualizada")}>
          Concluir
        </button>
        {evento.escopo === "global" && (
          <button className="btn sec full" style={{ marginTop: 9 }} disabled={aDispensar} onClick={alternarDispensa}>
            {aDispensar ? "A atualizar…" : dispensada ? "Voltar a servir neste evento" : "Esta base não serve neste evento"}
          </button>
        )}
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
