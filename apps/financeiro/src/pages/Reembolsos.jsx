import { useEffect, useMemo, useState } from "react";
import { ouvirReembolsosPorEstado, marcarReembolsosPagos } from "../lib/reembolsosFinanceiro";
import { ouvirBases } from "../lib/bases";
import { CATEGORIAS_DESPESA, ROTULO_CATEGORIA_DESPESA } from "@portal/shared/lib/categoriasDespesa.js";
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

export default function Reembolsos({ ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const [filtro, setFiltro] = useState("aprovado");
  const [base, setBase] = useState("todas");
  const [categoria, setCategoria] = useState("todas");
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

  const nomeBase = (b) => bases[b]?.nome ?? b;
  const corBase = (b) => bases[b]?.cor ?? "#6a7192";

  // as bases do seletor saem do que há na fila, não da lista das 9 —
  // filtrar por uma base que nunca pediu nada só dá lista vazia.
  const basesNaLista = useMemo(
    () => [...new Set(reembolsos.map((r) => r.baseId))].sort((a, b) => nomeBase(a).localeCompare(nomeBase(b))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reembolsos, bases],
  );

  const visiveis = useMemo(() => reembolsos.filter((r) => {
    if (base !== "todas" && r.baseId !== base) return false;
    if (categoria !== "todas" && r.categoria !== categoria) return false;
    return true;
  }), [reembolsos, base, categoria]);

  const total = useMemo(() => visiveis.reduce((s, r) => s + r.valor, 0), [visiveis]);
  const haFiltro = base !== "todas" || categoria !== "todas";

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>{FILTROS.find(([e]) => e === filtro)?.[1] ?? "Reembolsos"}</em>,
      subtitulo: filtro === "aprovado" ? "Aprovados pelos líderes, à espera de ti" : "",
      chips: [eur(total), `${visiveis.length} pedido${visiveis.length !== 1 ? "s" : ""}`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, filtro, visiveis.length, total]);

  function alternarSelecao(id) {
    setSelecionados((s) => {
      const novo = new Set(s);
      novo.has(id) ? novo.delete(id) : novo.add(id);
      return novo;
    });
  }

  const escolhidos = visiveis.filter((r) => selecionados.has(r.id));
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
      {filtro === "aprovado" && (
        <div className="destaque" style={{ cursor: "default" }}>
          <div>
            <p style={{ fontSize: 12.5, opacity: 0.85 }}>Por pagar {haFiltro ? "(filtrado)" : "agora"}</p>
            <p style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.035em", marginTop: 2 }}>{eur(total)}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 12.5, opacity: 0.85 }}>{visiveis.length} pedido{visiveis.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      <div className="menu" style={{ position: "static", border: 0, padding: "14px 0 4px", background: "none", backdropFilter: "none" }}>
        {FILTROS.map(([id, rotulo]) => (
          <button key={id} data-on={filtro === id ? "1" : "0"} onClick={() => { setFiltro(id); setModoLote(false); }}>
            {rotulo}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 4 }}>
        <select className="campo" style={{ marginTop: 0 }} value={base} onChange={(e) => setBase(e.target.value)}>
          <option value="todas">Todas as bases</option>
          {basesNaLista.map((b) => <option key={b} value={b}>{nomeBase(b)}</option>)}
        </select>
        <select className="campo" style={{ marginTop: 0 }} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="todas">Todas as categorias</option>
          {CATEGORIAS_DESPESA.map(([id, rotulo]) => <option key={id} value={id}>{rotulo}</option>)}
        </select>
      </div>

      <div className="sect">
        <div className="cabecalho">
          <h3>{filtro === "aprovado" ? "Fila de pagamento" : FILTROS.find(([e]) => e === filtro)?.[1]}</h3>
          {filtro === "aprovado" && visiveis.length > 1 ? (
            <button className="cap" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => setModoLote((m) => !m)}>
              {modoLote ? "Cancelar" : "Selecionar"}
            </button>
          ) : <span className="cap">{eur(total)}</span>}
        </div>

        {visiveis.length ? (
          visiveis.map((r) => (
            <div
              className="linha" key={`${r.baseId}-${r.id}`} style={{ cursor: "pointer" }}
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
                  {r.pessoaNome ?? "…"} · {dataTimestamp(filtro === "pago" ? (r.pagoEm ?? r.criadoEm) : r.criadoEm)}
                  {r.categoria ? ` · ${ROTULO_CATEGORIA_DESPESA[r.categoria] ?? r.categoria}` : ""}
                </p>
                <span className="tag" style={{ display: "inline-block", marginTop: 6, background: corBase(r.baseId) }}>
                  {nomeBase(r.baseId)}
                </span>
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
          <div className="vaz">{haFiltro ? "Nada com estes filtros." : "Nada por aqui."}</div>
        )}
      </div>

      {/* fica ACIMA da NavBar (fixa no fundo, z-index 12) — nunca sobre
          ela, senão tapa os separadores enquanto se escolhe o lote.
          90px cobre a altura real da NavBar (padding + botão +
          safe-area) com uma margem pequena. */}
      {modoLote && selecionados.size > 0 && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(90px + env(safe-area-inset-bottom, 0px))", background: "#fff", borderTop: "1px solid var(--fio)", borderRadius: "20px 20px 0 0", boxShadow: "0 -8px 24px rgba(10,15,46,.08)", padding: "14px 22px", zIndex: 11 }}>
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
