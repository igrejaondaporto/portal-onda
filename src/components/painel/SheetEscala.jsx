import { useState } from "react";
import { guardarEscala } from "../../lib/painel";
import { useTorrada } from "../../lib/TorradaContext";
import Avatar from "../Avatar";
import { dataPorExtenso } from "../../lib/data";

/**
 * Cada toque grava logo no Firestore — não há "guardar" no fim.
 * "Concluir" só fecha a folha.
 */
export default function SheetEscala({ evento, voluntarios, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [pessoas, setPessoas] = useState(evento?.escala?.pessoas ?? []);
  const [liderEscala, setLiderEscala] = useState(evento?.escala?.liderEscala ?? null);
  if (!evento) return null;

  async function persistir(novasPessoas, novoLider) {
    try {
      await guardarEscala(evento.id, { pessoas: novasPessoas, liderEscala: novoLider });
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    }
  }

  function alternar(id) {
    let novoLider = liderEscala;
    const dentro = pessoas.includes(id);
    const novasPessoas = dentro ? pessoas.filter((x) => x !== id) : [...pessoas, id];
    if (dentro && liderEscala === id) novoLider = null;
    if (!dentro && !liderEscala) novoLider = id;
    setPessoas(novasPessoas);
    setLiderEscala(novoLider);
    persistir(novasPessoas, novoLider);
  }

  function definirLider(id) {
    setLiderEscala(id);
    persistir(pessoas, id);
  }

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
        <div style={{ marginTop: 16 }}>
          {voluntarios.map((p) => {
            const dentro = pessoas.includes(p.id);
            const lid = liderEscala === p.id;
            return (
              <div className="opcao" style={{ cursor: "default" }} key={p.id}>
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
      </div>
    </>
  );
}
