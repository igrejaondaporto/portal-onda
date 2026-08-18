import { useState } from "react";
import { guardarEscala, dispensarBaseDeEvento, reincluirBaseEmEvento } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { BASE_ID } from "@portal/shared/lib/firebase.js";
import { nomeEvento } from "@portal/shared/lib/data.js";

/** Um titular + um aprendiz opcional por ministério. Guarda tudo de
 *  uma vez (ao contrário da Apoio, que grava a cada toque) porque há
 *  uma regra a confirmar antes de gravar: ninguém em dois lugares.
 *
 *  Ao contrário da Técnica, não há "Responsável"/líder de culto
 *  rotativo aqui — a Comunicação só tem o líder da base fixo (ver
 *  organograma). `liderEscala` fica sempre por definir. */
export default function SheetEscalaMinisterios({ evento, ministerios, voluntarios, onFechar, onGuardado, onExcluir }) {
  const torrada = useTorrada();
  const [aDispensar, setADispensar] = useState(false);
  const [dispensada, setDispensada] = useState((evento?.dispensadaPor || []).includes(BASE_ID));

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

  const [lugares, setLugares] = useState(() =>
    ministerios.map((m) => {
      const existente = evento?.escala?.lugares?.find((l) => l.ministerioId === m.id);
      return { ministerioId: m.id, titularId: existente?.titularId ?? null, aprendizId: existente?.aprendizId ?? null };
    })
  );
  const [aGuardar, setAGuardar] = useState(false);

  if (!evento) return null;

  const pessoasNoNivel = (ministerioId, nivel) =>
    voluntarios.filter((p) => p.ministerios?.[ministerioId] === nivel);

  function definirLugar(ministerioId, campo, valor) {
    setLugares((atual) => atual.map((l) => {
      if (l.ministerioId !== ministerioId) return l;
      const novo = { ...l, [campo]: valor || null };
      if (campo === "titularId" && !valor) novo.aprendizId = null; // aprendiz nunca sozinho
      return novo;
    }));
  }

  async function guardar() {
    const usados = new Set();
    for (const l of lugares) {
      for (const id of [l.titularId, l.aprendizId]) {
        if (!id) continue;
        if (usados.has(id)) return torrada("Alguém está em dois lugares ao mesmo tempo — corrige antes de guardar.");
        usados.add(id);
      }
    }
    setAGuardar(true);
    try {
      await guardarEscala(evento.id, { liderEscala: null, lugares });
      onGuardado("Escala atualizada");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAGuardar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{nomeEvento(evento)}</h2>
        <p className="sb2">Titular e aprendiz por ministério · chegada {evento.horaChegada || "08:30"}</p>

        {ministerios.map((m) => {
          const lugar = lugares.find((l) => l.ministerioId === m.id);
          const titulares = pessoasNoNivel(m.id, "titular");
          const aprendizes = pessoasNoNivel(m.id, "aprendiz");
          return (
            <div key={m.id} className="caixa" style={{ marginTop: 14 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: m.cor }}>{m.nome}</p>
              <label className="rot" style={{ marginTop: 8 }}>Titular</label>
              <select
                className="campo" value={lugar.titularId ?? ""}
                onChange={(e) => definirLugar(m.id, "titularId", e.target.value)}
              >
                <option value="">Por definir</option>
                {titulares.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <label className="rot">Aprendiz (opcional)</label>
              <select
                className="campo" value={lugar.aprendizId ?? ""} disabled={!lugar.titularId}
                onChange={(e) => definirLugar(m.id, "aprendizId", e.target.value)}
              >
                <option value="">Nenhum</option>
                {aprendizes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              {!lugar.titularId && aprendizes.length > 0 && (
                <p className="ds" style={{ marginTop: 4 }}>Escolhe o titular primeiro — o aprendiz nunca fica sozinho.</p>
              )}
            </div>
          );
        })}

        <button className="btn full" style={{ marginTop: 18 }} disabled={aGuardar} onClick={guardar}>
          {aGuardar ? "A guardar…" : "Guardar escala"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
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
