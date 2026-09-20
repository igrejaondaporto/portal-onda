import { useEffect, useState } from "react";
import { dispensarRecado, ouvirRecados } from "../lib/recados.js";

/**
 * O recado que o pastor mandou a esta base, no Início.
 *
 * Usa o mesmo cartão `.destaque` que o resto do Início já usa para
 * "isto precisa de ti" — de propósito: um estilo novo só para isto
 * ensinaria a equipa a ler mais um formato, e este já é o que toda a
 * gente associa a "olha para mim". Um recado urgente troca o gradiente
 * por `--magenta`, tal como o aviso de reembolso indeferido já faz.
 *
 * A cor nunca é a única diferença: o urgente diz "Recado urgente" em
 * cima, por extenso.
 *
 * Só o líder da base (ou auxiliar) dispensa — é o que as regras
 * deixam. Toda a equipa LÊ, porque o recado é para a base e não só
 * para quem manda nela; quem não pode dispensar simplesmente não vê o
 * botão, em vez de ver um botão que rebenta ao toque.
 *
 * Duas linhas por app: importar e pôr `<RecadoPastoral papel={papel} />`
 * no topo do Início. Nenhuma base precisa de mais nada — nem estado,
 * nem prop de dados, nem lib própria.
 */
const PAPEIS_QUE_DISPENSAM = new Set(["lider_base", "auxiliar"]);

export default function RecadoPastoral({ papel }) {
  const [recados, setRecados] = useState([]);
  const [aDispensar, setADispensar] = useState(null);

  useEffect(() => ouvirRecados(setRecados), []);

  if (!recados.length) return null;
  const podeDispensar = PAPEIS_QUE_DISPENSAM.has(papel);

  async function dispensar(id) {
    setADispensar(id);
    try {
      await dispensarRecado(id);
    } finally {
      setADispensar(null);
    }
  }

  return (
    <>
      {recados.map((r) => (
        <div
          key={r.id}
          className="destaque"
          style={{ cursor: "default", ...(r.urgente ? { background: "var(--magenta)" } : null) }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>
              {r.urgente ? "Recado urgente" : "Recado"}
              {r.autorNome ? ` — ${r.autorNome}` : ""}
            </p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em", lineHeight: 1.3 }}>
              {r.texto}
            </p>
          </div>
          {podeDispensar && (
            <button
              className="btn sec"
              style={{ flex: "none", background: "rgba(255,255,255,.18)", color: "#fff", border: 0 }}
              disabled={aDispensar === r.id}
              onClick={() => dispensar(r.id)}
            >
              Li
            </button>
          )}
        </div>
      ))}
    </>
  );
}
