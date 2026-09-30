import { useEffect, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { guardarCategoriaContagem, normalizarValorContagem, ouvirContagem } from "../../lib/contagem";

/**
 * Os dois números que o Mapa não apanha (pedido 2026-09): quantos
 * VOLUNTÁRIOS vieram mesmo — não os escalados, que às vezes faltam — e
 * quantas PESSOAS EM PÉ ficaram ao lado do auditório.
 *
 * Vivem logo abaixo do Mapa porque é quem está no auditório que os
 * conta, e substituem o ecrã de Contagem que existia em Culto (saiu,
 * a pedido: o resto já vinha do Mapa ou dos contadores das salas).
 * Gravam no MESMO documento de sempre, `eventos/{e}/contagem/geral`
 * (`categorias.voluntarios` e `categorias.emPe`) — qualquer pessoa da
 * Pessoal escreve lá (regras), sem precisar da função Mapa, e funciona
 * sem rede como a contagem antiga. O Painel Pastoral lê daqui: em pé
 * soma ao auditório; os voluntários presentes são o número principal,
 * com os escalados ao lado.
 */
const CAMPOS = [
  { id: "voluntarios", nome: "Voluntários presentes", descricao: "Quem veio mesmo servir — não os escalados" },
  { id: "emPe", nome: "Pessoas em pé", descricao: "Ao lado do auditório, fora dos lugares do Mapa" },
];

function horaDe(ts) {
  if (!ts?.toDate) return null;
  const d = ts.toDate();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ContagemJuntoAoMapa({ eventoId, uid }) {
  const torrada = useTorrada();
  const [contagem, setContagem] = useState(null);
  const [rascunhos, setRascunhos] = useState({});
  const [aGuardar, setAGuardar] = useState({});

  useEffect(() => {
    setRascunhos({});
    return ouvirContagem(eventoId, setContagem);
  }, [eventoId]);

  const guardado = (id) => contagem?.categorias?.[id]?.valor ?? null;
  const noCampo = (id) => (Object.prototype.hasOwnProperty.call(rascunhos, id)
    ? rascunhos[id]
    : guardado(id) == null ? "" : String(guardado(id)));

  async function guardar(id, valor) {
    try {
      const n = normalizarValorContagem(valor);
      if (n === guardado(id)) return;
      setAGuardar((e) => ({ ...e, [id]: true }));
      await guardarCategoriaContagem(eventoId, id, n, uid);
      setRascunhos((e) => ({ ...e, [id]: n == null ? "" : String(n) }));
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    } finally {
      setAGuardar((e) => ({ ...e, [id]: false }));
    }
  }

  function ajustar(id, delta) {
    try {
      const proximo = Math.max(0, (normalizarValorContagem(noCampo(id)) ?? 0) + delta);
      setRascunhos((e) => ({ ...e, [id]: String(proximo) }));
      guardar(id, proximo);
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    }
  }

  return (
    <section className="sect contagem-culto">
      <div className="cabecalho">
        <h3>Também contar</h3>
      </div>
      {CAMPOS.map((c) => {
        const valor = noCampo(c.id);
        const hora = guardado(c.id) != null ? horaDe(contagem?.categorias?.[c.id]?.preenchidoEm) : null;
        return (
          <div className="contagem-linha" key={c.id}>
            <div className="contagem-texto">
              <label htmlFor={`mapa-${c.id}`} className="nmt">{c.nome}</label>
              <p className="ds">{c.descricao}</p>
              {hora && <p className="contagem-autoria">Marcado às {hora}</p>}
            </div>
            <div className="contagem-controlos">
              <button
                type="button" className="btn sec contagem-ajuste" aria-label={`Diminuir ${c.nome}`}
                disabled={aGuardar[c.id] || Number(valor || 0) <= 0} onClick={() => ajustar(c.id, -1)}
              >
                −
              </button>
              <input
                id={`mapa-${c.id}`} className="campo contagem-campo" type="number" inputMode="numeric"
                min="0" step="1" value={valor} placeholder="—" aria-label={c.nome}
                onChange={(e) => setRascunhos((r) => ({ ...r, [c.id]: e.target.value }))}
                onBlur={(e) => guardar(c.id, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              />
              <button
                type="button" className="btn sec contagem-ajuste" aria-label={`Aumentar ${c.nome}`}
                disabled={aGuardar[c.id]} onClick={() => ajustar(c.id, 1)}
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
