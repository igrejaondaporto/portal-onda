import { useEffect, useMemo } from "react";

/**
 * Fotos escolhidas, por ordem, com setas para trocar de lugar (2026-10,
 * pedido: "precisa ter a opção de reordenar as fotos escolhidas"). A
 * primeira é a capa — a que aparece no feed. Setas em vez de arrastar:
 * no telemóvel, arrastar dentro de uma página que também desliza é
 * frágil; um toque numa seta nunca falha.
 *
 * `lista` mistura URLs (fotos já publicadas, no editar) e `File` (fotos
 * novas, ainda por subir); a pré-visualização de um File é um object URL,
 * libertado quando a lista muda.
 */
export default function OrdenarFotos({ lista, setLista, max = 4, onJuntar }) {
  const srcs = useMemo(
    () => lista.map((f) => (typeof f === "string" ? f : URL.createObjectURL(f))),
    [lista],
  );
  useEffect(() => () => {
    srcs.forEach((s, i) => { if (typeof lista[i] !== "string") URL.revokeObjectURL(s); });
  }, [srcs, lista]);

  function mover(i, para) {
    setLista((l) => {
      const n = [...l];
      [n[i], n[para]] = [n[para], n[i]];
      return n;
    });
  }

  return (
    <div className="edFotos">
      {lista.map((f, i) => (
        <span key={typeof f === "string" ? f : `${f.name}-${f.lastModified}-${i}`} className="edFoto" style={{ backgroundImage: `url("${srcs[i]}")` }}>
          {i === 0 && lista.length > 1 && <small className="capa">capa</small>}
          <button type="button" className="tirar" aria-label={`Tirar a foto ${i + 1}`} onClick={() => setLista((l) => l.filter((_, j) => j !== i))}>×</button>
          {lista.length > 1 && (
            <span className="setas">
              <button type="button" aria-label={`Passar a foto ${i + 1} para trás`} disabled={i === 0} onClick={() => mover(i, i - 1)}>‹</button>
              <button type="button" aria-label={`Passar a foto ${i + 1} para a frente`} disabled={i === lista.length - 1} onClick={() => mover(i, i + 1)}>›</button>
            </span>
          )}
        </span>
      ))}
      {lista.length < max && onJuntar && (
        <button type="button" className="edFoto juntar" onClick={onJuntar}>+ foto</button>
      )}
    </div>
  );
}
