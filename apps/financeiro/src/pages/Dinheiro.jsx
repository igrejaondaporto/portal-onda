import { useEffect, useMemo, useState } from "react";
import { ouvirReembolsosPorEstado, ouvirReembolsosPagos } from "../lib/reembolsosFinanceiro";
import { ouvirBases } from "../lib/bases";
import { eur } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** `pagoEm` é um Timestamp do Firestore — chega como Date só depois de
 *  `.toDate()`. Um pedido ainda a caminho (escrita otimista offline)
 *  pode não ter `pagoEm` resolvido ainda; ignora-o até lá em vez de
 *  rebentar a graçar com "mês de 1970" do timestamp vazio. */
const mesAno = (ts) => {
  if (!ts?.toDate) return null;
  const d = ts.toDate();
  return `${d.getFullYear()}-${d.getMonth()}`;
};

function paraCsv(linhas) {
  const cabecalho = ["data", "base", "pessoa", "descricao", "valor", "metodo", "referencia"];
  const escapar = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const corpo = linhas.map((r) => [
    r.pagoEm?.toDate?.().toISOString().slice(0, 10) ?? "",
    r.baseId, r.pessoaNome ?? "", r.descricao ?? "", r.valor,
    r.metodoPagamento ?? "", r.referenciaPagamento ?? "",
  ].map(escapar).join(","));
  return [cabecalho.join(","), ...corpo].join("\n");
}

export default function Dinheiro({ definirCabecalho }) {
  const torrada = useTorrada();
  const [porPagar, setPorPagar] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [bases, setBases] = useState({});

  useEffect(() => ouvirBases(setBases), []);
  useEffect(() => ouvirReembolsosPorEstado("aprovado", setPorPagar), []);
  useEffect(() => ouvirReembolsosPagos(setPagos), []);

  const hoje = useMemo(() => new Date(), []);
  const chaveMesAtual = `${hoje.getFullYear()}-${hoje.getMonth()}`;
  const pagoEsteMes = useMemo(() => pagos.filter((r) => mesAno(r.pagoEm) === chaveMesAtual), [pagos, chaveMesAtual]);
  const pagoEsteAno = useMemo(() => pagos.filter((r) => r.pagoEm?.toDate?.().getFullYear() === hoje.getFullYear()), [pagos, hoje]);
  const totalPorPagar = porPagar.reduce((s, r) => s + r.valor, 0);
  const basesPorPagar = new Set(porPagar.map((r) => r.baseId)).size;

  const porBaseEsteAno = useMemo(() => {
    const mapa = new Map();
    for (const r of pagoEsteAno) mapa.set(r.baseId, (mapa.get(r.baseId) ?? 0) + r.valor);
    return [...mapa.entries()].map(([baseId, total]) => ({ baseId, total })).sort((a, b) => b.total - a.total);
  }, [pagoEsteAno]);
  const maiorPorBase = porBaseEsteAno[0]?.total ?? 1;

  useEffect(() => {
    definirCabecalho({ titulo: <em>Dinheiro</em>, subtitulo: "O que saiu, por base e por mês", chips: [] });
  }, [definirCabecalho]);

  function exportarCsv() {
    if (!pagoEsteMes.length) return torrada("Ainda não há nada pago este mês.");
    const csv = paraCsv(pagoEsteMes);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `reembolsos-${chaveMesAtual.replace("-", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="destaque">
        <div>
          <p style={{ fontSize: 12.5, opacity: 0.85 }}>Por pagar agora</p>
          <p style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.035em", marginTop: 2 }}>{eur(totalPorPagar)}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 12.5, opacity: 0.85 }}>{porPagar.length} pedido{porPagar.length !== 1 ? "s" : ""}</p>
          <p style={{ fontSize: 12.5, opacity: 0.85, marginTop: 2 }}>{basesPorPagar} base{basesPorPagar !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="linha">
        <div style={{ flex: 1 }}>
          <p className="nmt">{eur(pagoEsteMes.reduce((s, r) => s + r.valor, 0))}</p>
          <p className="ds">Pago em {MESES_PT[hoje.getMonth()]} · {pagoEsteMes.length} pedido{pagoEsteMes.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
      <div className="linha">
        <div style={{ flex: 1 }}>
          <p className="nmt">{eur(pagoEsteAno.reduce((s, r) => s + r.valor, 0))}</p>
          <p className="ds">Pago em {hoje.getFullYear()} · {pagoEsteAno.length} pedido{pagoEsteAno.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="sect">
        <div className="cabecalho"><h3>Por base</h3><span className="cap">{hoje.getFullYear()}</span></div>
        {porBaseEsteAno.length ? porBaseEsteAno.map(({ baseId, total }) => (
          <div className="fila" style={{ paddingTop: 13 }} key={baseId}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.02em", display: "flex", alignItems: "center" }}>
                <span className="quadmin" style={{ background: bases[baseId]?.cor ?? "#6a7192" }} />
                {bases[baseId]?.nome ?? baseId}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums", flex: "none" }}>{eur(total)}</span>
            </div>
            <div className="barra" style={{ marginTop: 7 }}>
              <i style={{ width: `${(total / maiorPorBase) * 100}%`, background: bases[baseId]?.cor ?? "#6a7192" }} />
            </div>
          </div>
        )) : <div className="vaz">Ainda não há nada pago este ano.</div>}
      </div>

      <button className="btn sec full" style={{ marginTop: 20, marginBottom: 20 }} onClick={exportarCsv}>
        Exportar {MESES_PT[hoje.getMonth()]} (CSV)
      </button>
    </>
  );
}
