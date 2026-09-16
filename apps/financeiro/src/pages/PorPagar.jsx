import { useEffect, useMemo, useState } from "react";
import { ouvirReembolsosPorEstado, marcarReembolsosPagos } from "../lib/reembolsosFinanceiro";
import { ouvirBases } from "../lib/bases";
import { eur, dataTimestamp } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";
import SheetDetalheReembolso from "../components/SheetDetalheReembolso";

// Fila de pagamento é "aprovado" — o resto são vistas de acompanhamento,
// nunca ações. "Devolvido" também aparece aqui: é trabalho da líder da
// base, não do Financeiro, mas ele quer ver que ainda está pendurado.
const FILTROS = [
  ["aprovado", "Por pagar"],
  ["pago", "Pagos"],
  ["devolvido", "Devolvidos"],
];

export default function PorPagar({ definirCabecalho }) {
  const torrada = useTorrada();
  const [filtro, setFiltro] = useState("aprovado");
  const [reembolsos, setReembolsos] = useState([]);
  const [bases, setBases] = useState({});
  const [aberto, setAberto] = useState(null);
  const [modoLote, setModoLote] = useState(false);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [aPagarLote, setAPagarLote] = useState(false);

  useEffect(() => ouvirBases(setBases), []);
  useEffect(() => {
    setSelecionados(new Set());
    return ouvirReembolsosPorEstado(filtro, setReembolsos);
  }, [filtro]);

  const total = useMemo(() => reembolsos.reduce((s, r) => s + r.valor, 0), [reembolsos]);
  const nomeBase = (b) => bases[b]?.nome ?? b;
  const corBase = (b) => bases[b]?.cor ?? "#6a7192";

  useEffect(() => {
    definirCabecalho({
      titulo: <em>{FILTROS.find(([e]) => e === filtro)?.[1] ?? "Reembolsos"}</em>,
      subtitulo: filtro === "aprovado" ? "Aprovados pelos líderes, à espera de ti" : "",
      chips: filtro === "aprovado"
        ? [eur(total), `${reembolsos.length} pedido${reembolsos.length !== 1 ? "s" : ""}`]
        : [`${reembolsos.length} pedido${reembolsos.length !== 1 ? "s" : ""}`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, reembolsos.length, total]);

  function alternarSelecao(id) {
    setSelecionados((s) => {
      const novo = new Set(s);
      novo.has(id) ? novo.delete(id) : novo.add(id);
      return novo;
    });
  }

  const escolhidos = reembolsos.filter((r) => selecionados.has(r.id));
  const totalEscolhidos = escolhidos.reduce((s, r) => s + r.valor, 0);
  // agrupado por pessoa: é assim que o Financeiro paga de facto — uma
  // transferência por pessoa, com os pedidos dela todos dentro.
  const porPessoa = useMemo(() => {
    const mapa = new Map();
    for (const r of escolhidos) {
      const chave = r.pessoaId;
      if (!mapa.has(chave)) mapa.set(chave, { nome: r.pessoaNome ?? "…", pagamento: r.pagamento, itens: [] });
      mapa.get(chave).itens.push(r);
    }
    return [...mapa.values()];
  }, [escolhidos]);

  async function pagarLote() {
    // metodo/referência ficam por conta de cada pessoa ter o método
    // que já trouxe no pedido — o lote só agrupa, não força um método
    // único para todos.
    setAPagarLote(true);
    try {
      for (const grupo of porPessoa) {
        await marcarReembolsosPagos(grupo.itens, grupo.pagamento?.metodo ?? "transferencia", "");
      }
      torrada(`${escolhidos.length} pedidos marcados como pagos`);
      setModoLote(false);
      setSelecionados(new Set());
    } catch (e) {
      torrada(e.message || "Não foi possível pagar o lote.");
    } finally {
      setAPagarLote(false);
    }
  }

  return (
    <>
      <div className="menu" style={{ margin: "0 -22px", position: "sticky", top: 0 }}>
        {FILTROS.map(([id, rotulo]) => (
          <button key={id} data-on={filtro === id ? "1" : "0"} onClick={() => { setFiltro(id); setModoLote(false); }}>
            {rotulo}
          </button>
        ))}
      </div>

      <div className="sect">
        <div className="cabecalho">
          <h3>{filtro === "aprovado" ? "Fila de pagamento" : FILTROS.find(([e]) => e === filtro)?.[1]}</h3>
          {filtro === "aprovado" && reembolsos.length > 1 && (
            <button className="cap" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => setModoLote((m) => !m)}>
              {modoLote ? "Cancelar" : "Selecionar"}
            </button>
          )}
        </div>

        {reembolsos.length ? (
          reembolsos.map((r) => (
            <div
              className="linha" key={r.id} style={{ cursor: "pointer" }}
              onClick={() => (modoLote ? alternarSelecao(r.id) : setAberto(r))}
            >
              {modoLote ? (
                <span
                  style={{
                    width: 24, height: 24, borderRadius: 8, flex: "none", display: "grid", placeItems: "center",
                    border: `2px solid ${selecionados.has(r.id) ? "var(--azul)" : "#cdd3ea"}`,
                    background: selecionados.has(r.id) ? "var(--azul)" : "#fff",
                  }}
                >
                  {selecionados.has(r.id) && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
              ) : (
                <Avatar pessoa={{ nome: r.pessoaNome, cor: corBase(r.baseId) }} tamanho={42} fonte={16} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="nmt">{eur(r.valor)}</p>
                <p className="ds">
                  <span className="quadmin" style={{ background: corBase(r.baseId) }} />
                  {nomeBase(r.baseId)} · {r.pessoaNome ?? "…"} · {dataTimestamp(r.criadoEm)}
                </p>
              </div>
              {!modoLote && (
                <>
                  <span className="tag cinz">{r.pagamento ? { mbway: "MB Way", transferencia: "IBAN" }[r.pagamento.metodo] : "—"}</span>
                  <span className="seta">›</span>
                </>
              )}
            </div>
          ))
        ) : (
          <div className="vaz">Nada por aqui.</div>
        )}
      </div>

      {modoLote && selecionados.size > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#fff", borderTop: "1px solid var(--fio)", padding: "14px 22px calc(20px + var(--sb))", zIndex: 15 }}>
          <button className="btn full" disabled={aPagarLote} onClick={pagarLote}>
            Marcar {selecionados.size} como pagos · {eur(totalEscolhidos)}
          </button>
        </div>
      )}

      {aberto && (
        <SheetDetalheReembolso
          pedido={aberto} nomeBase={nomeBase(aberto.baseId)} corBase={corBase(aberto.baseId)}
          onFechar={() => setAberto(null)} onFeito={() => setAberto(null)}
        />
      )}
    </>
  );
}
