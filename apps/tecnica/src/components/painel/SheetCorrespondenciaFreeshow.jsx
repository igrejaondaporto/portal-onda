import { useState } from "react";
import { definirCorrespondenciaFreeshow } from "../../lib/cultoAoVivo";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

let contador = 0;
const chave = () => `l${Date.now()}_${contador++}`;
const linhaVazia = () => ({ _k: chave(), freeshow: "", painel: "" });

/** A tabela de correspondência entre o nome de uma secção no FreeShow
 *  e o nome do momento no painel (ex.: "Contagem" → "CONTAGEM") — os
 *  nomes não batem certo porque são escritos por pessoas diferentes,
 *  em sítios diferentes, e mudam com o tempo. Ver ordemAoVivo.js e
 *  functions/index.js (sondarFreeshow) para onde isto é usado. */
export default function SheetCorrespondenciaFreeshow({ mapaAtual, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [linhas, setLinhas] = useState(() => {
    const pares = Object.entries(mapaAtual || {}).map(([freeshow, painel]) => ({ _k: chave(), freeshow, painel }));
    return pares.length ? pares : [linhaVazia()];
  });
  const [aEnviar, setAEnviar] = useState(false);

  function atualizar(i, campo, valor) {
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  }
  const apagar = (i) => setLinhas((ls) => ls.filter((_, j) => j !== i));
  const nova = () => setLinhas((ls) => [...ls, linhaVazia()]);

  async function guardar() {
    const mapa = {};
    for (const l of linhas) {
      const f = l.freeshow.trim(), p = l.painel.trim();
      if (f && p) mapa[f] = p;
    }
    setAEnviar(true);
    try {
      await definirCorrespondenciaFreeshow(mapa);
      onGuardado("Correspondência atualizada");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Correspondência com o FreeShow</h2>
        <p className="sb2">
          O nome de uma secção no FreeShow, e o nome do mesmo momento no painel — nem sempre são iguais.
        </p>
        {linhas.map((l, i) => (
          <div key={l._k} className="dupla" style={{ marginTop: 12, alignItems: "center" }}>
            <input
              className="campo" style={{ flex: 1 }} value={l.freeshow} placeholder="Nome no FreeShow"
              onChange={(e) => atualizar(i, "freeshow", e.target.value)}
            />
            <input
              className="campo" style={{ flex: 1 }} value={l.painel} placeholder="Nome no painel"
              onChange={(e) => atualizar(i, "painel", e.target.value)}
            />
            <button className="btn sec" style={{ padding: "12px 14px" }} onClick={() => apagar(i)}>✕</button>
          </div>
        ))}
        <button className="btn sec full" style={{ marginTop: 12 }} onClick={nova}>+ Adicionar linha</button>
        <p className="ds" style={{ marginTop: 10 }}>
          Uma secção do FreeShow sem linha aqui ainda aparece na ordem do culto ao vivo, mas à parte, com o nome original.
        </p>
        <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar} onClick={guardar}>Guardar</button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
