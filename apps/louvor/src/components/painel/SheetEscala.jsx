import { useEffect, useState } from "react";
import { guardarEscala, obterEstatisticasEscala, dispensarBaseDeEvento, reincluirBaseEmEvento } from "../../lib/painel";
import { PAPEIS, nomePapel } from "../../lib/modelo";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { BASE_ID } from "@portal/shared/lib/firebase.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import { nomeEvento, dataCurta } from "@portal/shared/lib/data.js";

/**
 * Cada toque grava logo no Firestore — não há "guardar" no fim.
 * Ao juntar alguém, escolhe-se logo o papel (Vocal, Teclado…): não há
 * titular/aprendiz aqui, mas cada pessoa entra com um papel — nunca
 * "só na escala" sem se saber o que vai tocar/cantar.
 */
export default function SheetEscala({ evento, voluntarios, onFechar, onGuardado, onExcluir }) {
  const torrada = useTorrada();
  const [escalados, setEscalados] = useState(evento?.escala?.escalados ?? []);
  const [liderEscala, setLiderEscala] = useState(evento?.escala?.liderEscala ?? null);
  const [estatisticas, setEstatisticas] = useState({});
  const [ordem, setOrdem] = useState("vezes");
  const [aEscolherPapel, setAEscolherPapel] = useState(null); // pessoaId, a meio de juntar
  const [aDispensar, setADispensar] = useState(false);
  const [dispensada, setDispensada] = useState((evento?.dispensadaPor || []).includes(BASE_ID));

  useEffect(() => { obterEstatisticasEscala(90).then(setEstatisticas); }, []);

  if (!evento) return null;

  // grava otimista (o toque já muda o ecrã), mas se o servidor recusar
  // desfaz e avisa — nunca fica um estado no ecrã que não bateu certo
  // com o gravado.
  async function persistir(novosEscalados, novoLider, anterior) {
    try {
      await guardarEscala(evento.id, { escalados: novosEscalados, liderEscala: novoLider });
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setEscalados(anterior.escalados);
      setLiderEscala(anterior.liderEscala);
    }
  }

  function tirar(id) {
    const anterior = { escalados, liderEscala };
    const novosEscalados = escalados.filter((e) => e.pessoaId !== id);
    const novoLider = liderEscala === id ? null : liderEscala;
    setEscalados(novosEscalados);
    setLiderEscala(novoLider);
    persistir(novosEscalados, novoLider, anterior);
  }

  function juntarComPapel(id, papel) {
    const anterior = { escalados, liderEscala };
    const novosEscalados = [...escalados, { pessoaId: id, papel }];
    const novoLider = liderEscala ?? id;
    setEscalados(novosEscalados);
    setLiderEscala(novoLider);
    setAEscolherPapel(null);
    persistir(novosEscalados, novoLider, anterior);
  }

  function trocarPapel(id, papel) {
    const anterior = { escalados, liderEscala };
    const novosEscalados = escalados.map((e) => (e.pessoaId === id ? { ...e, papel } : e));
    setEscalados(novosEscalados);
    setAEscolherPapel(null);
    persistir(novosEscalados, liderEscala, anterior);
  }

  function definirLider(id) {
    const anterior = { escalados, liderEscala };
    setLiderEscala(id);
    persistir(escalados, id, anterior);
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
        <p className="sb2">{escalados.length} pessoas · chegada {evento.horaChegada || "07:00"}</p>
        <p className="ds" style={{ textAlign: "center", marginTop: 8 }}>
          Toca no nome para escolher o papel. A estrela define quem é o líder de escala.
        </p>
        <div className="subtabs" style={{ marginTop: 14 }}>
          <button data-on={ordem === "vezes" ? 1 : 0} onClick={() => setOrdem("vezes")}>Menos vezes primeiro</button>
          <button data-on={ordem === "nome" ? 1 : 0} onClick={() => setOrdem("nome")}>Nome</button>
        </div>
        <div style={{ marginTop: 12 }}>
          {voluntariosOrdenados.map((p) => {
            const entrada = escalados.find((e) => e.pessoaId === p.id);
            const lid = liderEscala === p.id;
            const stat = estatisticas[p.id];
            const semServico = !stat?.vezes;
            const statTexto = semServico
              ? "Ainda não serviu neste trimestre"
              : `${stat.vezes} ${stat.vezes === 1 ? "vez" : "vezes"} · última a ${dataCurta(stat.ultima)}`;
            const aEscolher = aEscolherPapel === p.id;
            return (
              <div key={p.id}>
                <div
                  className="opcao" style={{ cursor: "default", ...(semServico ? { background: "rgba(214,32,105,.06)", borderRadius: 12 } : {}) }}
                >
                  <span
                    onClick={() => (entrada ? setAEscolherPapel(aEscolher ? null : p.id) : setAEscolherPapel(p.id))}
                    style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: "pointer" }}
                  >
                    <Avatar pessoa={p} tamanho={38} fonte={15} />
                    <span style={{ flex: 1 }}>
                      <b style={{ fontSize: 15.5, fontWeight: 700 }}>{p.nome}</b>
                      <span style={{ display: "block", fontSize: 12, color: "var(--cinza)" }}>
                        {entrada ? `${nomePapel(entrada.papel)}${lid ? " · líder de escala" : ""}` : "fora deste culto"}
                      </span>
                      <span style={{ display: "block", fontSize: 12, marginTop: 2, color: semServico ? "var(--magenta)" : "var(--cinza)", fontWeight: semServico ? 600 : 400 }}>
                        {statTexto}
                        {stat?.liderVezes ? <span style={{ opacity: 0.75 }}> · {stat.liderVezes}x líder</span> : null}
                      </span>
                    </span>
                  </span>
                  {entrada && (
                    <button className={`estrela${lid ? " on" : ""}`} onClick={() => definirLider(p.id)} title="Líder de escala">
                      ★
                    </button>
                  )}
                  {entrada && (
                    <span className="chk on" onClick={() => tirar(p.id)} style={{ cursor: "pointer" }}>✓</span>
                  )}
                </div>
                {aEscolher && (
                  <div className="subtabs" style={{ margin: "0 0 12px" }}>
                    {PAPEIS.map((papel) => (
                      <button
                        key={papel.id}
                        data-on={entrada?.papel === papel.id ? 1 : 0}
                        onClick={() => (entrada ? trocarPapel(p.id, papel.id) : juntarComPapel(p.id, papel.id))}
                      >
                        {papel.nome}
                      </button>
                    ))}
                  </div>
                )}
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
