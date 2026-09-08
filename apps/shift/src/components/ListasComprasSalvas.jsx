import { useEffect, useMemo, useState } from "react";
import { MESES, dataTimestamp } from "@portal/shared/lib/data.js";
import { ouvirListasComprasDoMes, linkListaComprasWhatsApp, enviarListaCompras } from "../lib/inventario";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const ROTULO_ESTADO = { fechada: "Lista fechada", enviada: "Lista enviada para compras" };
const COR_ESTADO = { fechada: "var(--laranja)", enviada: "var(--verde)" };

/** Os últimos 6 meses (o atual incluído) — mesmo padrão do Formulário/HistoricoContagem. */
function ultimosMeses(hoje) {
  const lista = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    lista.push({ valor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, ano: d.getFullYear(), mesIndex: d.getMonth() });
  }
  return lista;
}

/**
 * Histórico de listas de compras já fechadas/enviadas — mesmo esquema
 * de "Cultos contados"/"Visitantes": filtro por mês, cartão fechado
 * por omissão que expande ao tocar. "Enviar para compras" continua
 * visível mesmo depois de já ter sido enviada — quem fecha pode
 * querer reenviar a mesma lista a outra pessoa, sem reabrir nada.
 */
export default function ListasComprasSalvas({ podeGerir }) {
  const torrada = useTorrada();
  const meses = useMemo(() => ultimosMeses(new Date()), []);
  const [mesFiltro, setMesFiltro] = useState(meses[0].valor);
  const [listas, setListas] = useState([]);
  const [abertoId, setAbertoId] = useState(null);
  const [aProcessar, setAProcessar] = useState(false);

  useEffect(() => {
    const { ano, mesIndex } = meses.find((m) => m.valor === mesFiltro) ?? meses[0];
    return ouvirListasComprasDoMes(ano, mesIndex, setListas);
  }, [mesFiltro, meses]);

  async function enviar(lista) {
    window.open(linkListaComprasWhatsApp(lista), "_blank", "noopener");
    if (lista.estado === "enviada") return;
    setAProcessar(true);
    try {
      await enviarListaCompras(lista.id);
      torrada("Lista marcada como enviada");
    } catch (e) {
      torrada(e.message || "Não foi possível marcar como enviada.");
    } finally {
      setAProcessar(false);
    }
  }

  return (
    <div className="sect" style={{ marginTop: 16 }}>
      <div className="cabecalho">
        <h3>Listas salvas</h3>
        <span className="cap">{listas.length}</span>
      </div>

      <select
        className="campo" style={{ width: "auto", marginTop: 10 }}
        value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}
      >
        {meses.map((m) => <option key={m.valor} value={m.valor}>{MESES[m.mesIndex]} {m.ano}</option>)}
      </select>

      {listas.length ? listas.map((l) => {
        const aberto = abertoId === l.id;
        const itens = l.itens || [];
        return (
          <div className="caixa" key={l.id} style={{ marginTop: 10 }}>
            <div
              style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}
              onClick={() => setAbertoId(aberto ? null : l.id)}
            >
              <span
                aria-hidden="true"
                style={{ flex: "none", marginTop: 3, transition: "transform .18s", transform: aberto ? "rotate(90deg)" : "none", color: "var(--cinza)" }}
              >
                ›
              </span>
              <div style={{ flex: 1 }}>
                <p className="nmt">{dataTimestamp(l.criadaEm)} · {itens.length} {itens.length === 1 ? "item" : "itens"}</p>
                <p className="ds">{itens.map((it) => it.nome).join(", ") || "Sem itens"}</p>
              </div>
              <span className="tag" style={{ background: COR_ESTADO[l.estado], color: "#fff", flex: "none" }}>
                {ROTULO_ESTADO[l.estado] ?? l.estado}
              </span>
            </div>

            {aberto && (
              <div style={{ marginTop: 10, borderTop: "1px solid rgba(0,0,0,.06)", paddingTop: 10 }}>
                {itens.map((it) => (
                  <div key={it.itemId} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13.5 }}>
                    <span>{it.nome}</span>
                    {it.quantidade > 1 && <b style={{ color: "var(--tinta)" }}>{it.quantidade}x</b>}
                  </div>
                ))}
              </div>
            )}

            {podeGerir && (l.estado === "fechada" || l.estado === "enviada") && (
              <button
                className="btn sec full" style={{ marginTop: 10 }} disabled={aProcessar}
                onClick={(e) => { e.stopPropagation(); enviar(l); }}
              >
                Enviar para compras
              </button>
            )}
          </div>
        );
      }) : (
        <div className="vaz" style={{ marginTop: 10 }}>Nenhuma lista neste mês.</div>
      )}
    </div>
  );
}
