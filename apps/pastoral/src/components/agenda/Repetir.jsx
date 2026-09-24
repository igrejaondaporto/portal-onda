import { useEffect, useMemo, useState } from "react";
import { dataPorExtenso } from "@portal/shared/lib/data.js";
import { conflitosDeHora, datasRepetidas } from "../../lib/agenda";

/** "Repetir por N semanas" (1 = só este dia). Texto e não número no
 *  estado, para dar para apagar o campo e escrever outro valor. */
export function useRepetir() {
  const [texto, setTexto] = useState("1");
  const semanas = Math.min(52, Math.max(1, parseInt(texto, 10) || 1));
  return { texto, setTexto, semanas };
}

export function CampoRepetir({ repetir, data }) {
  const ultima = datasRepetidas(data, repetir.semanas).at(-1);
  return (
    <>
      <label className="rot" style={{ marginTop: 12 }}>Repetir</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          className="campo" style={{ width: 80, marginTop: 0 }} type="number" min="1" max="52" inputMode="numeric"
          value={repetir.texto} onChange={(e) => repetir.setTexto(e.target.value)} aria-label="Semanas"
        />
        <span className="ds" style={{ marginTop: 0 }}>
          {repetir.semanas === 1 ? "semana — só este dia" : `semanas seguidas, até ${dataPorExtenso(ultima)}`}
        </span>
      </div>
    </>
  );
}

/** Outro evento à mesma hora em algum destes dias — bloqueia SEMPRE
 *  (pedido 2026-09). Verificado enquanto se escreve, com uma pausa
 *  curta para não fazer uma query a cada tecla. */
export function useConflitos({ data, semanas, hora, privados, ignorar }) {
  const datas = useMemo(() => (data ? datasRepetidas(data, semanas) : []), [data, semanas]);
  const [conflitos, setConflitos] = useState([]);
  const [aVerificar, setAVerificar] = useState(false);
  useEffect(() => {
    if (!hora || !datas.length) { setConflitos([]); return undefined; }
    let vivo = true;
    setAVerificar(true);
    const t = setTimeout(() => {
      conflitosDeHora({ datas, hora, privados, ignorar })
        .then((c) => { if (vivo) setConflitos(c); })
        .catch(() => { if (vivo) setConflitos([]); })
        .finally(() => { if (vivo) setAVerificar(false); });
    }, 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [datas, hora, privados, ignorar]);
  return { conflitos, aVerificar };
}

export function AvisoConflitos({ conflitos, hora }) {
  if (!conflitos.length) return null;
  return (
    <div className="caixa destaque" style={{ marginTop: 12 }}>
      <p className="ds" style={{ marginTop: 0, color: "var(--magenta)" }}>
        <b>Já há um evento às {hora}</b> —{" "}
        {conflitos.map((c) => `${dataPorExtenso(c.data)}: ${c.nome}`).join("; ")}. Escolhe outra hora para poder guardar.
      </p>
    </div>
  );
}
