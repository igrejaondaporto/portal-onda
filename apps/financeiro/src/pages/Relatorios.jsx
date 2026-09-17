import { useEffect, useMemo, useState } from "react";
import { ouvirReembolsosPagos, ouvirReembolsosPorEstado } from "../lib/reembolsosFinanceiro";
import { ouvirContagens, emEuros } from "../lib/oferta";
import { ouvirBases } from "../lib/bases";
import Barras from "../components/Barras";
import { CATEGORIAS_DESPESA, ROTULO_CATEGORIA_DESPESA } from "@portal/shared/lib/categoriasDespesa.js";
import { eur, dataTimestamp, dataPorExtenso } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const PERIODOS = [
  ["mes", "Este mês"],
  ["ano", "Este ano"],
  ["tudo", "Tudo"],
];

const chaveMes = (d) => `${d.getFullYear()}-${d.getMonth()}`;
const dataDe = (ts) => (ts?.toDate ? ts.toDate() : null);
/** "2026-09-20" → Date local (nunca `new Date(iso)`, que lê como UTC
 *  e recua um dia em Portugal no inverno). */
const dataDeIso = (iso) => {
  if (!iso) return null;
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
};

function dentroDoPeriodo(d, periodo, hoje) {
  if (!d) return false;
  if (periodo === "tudo") return true;
  if (periodo === "ano") return d.getFullYear() === hoje.getFullYear();
  return chaveMes(d) === chaveMes(hoje);
}

/** As últimas N chaves de mês, da mais antiga para a mais recente —
 *  eixo fixo dos gráficos e da tabela, com 0 nos meses sem nada. */
function ultimosMeses(hoje, n) {
  const lista = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    lista.push({ chave: chaveMes(d), rotulo: MESES_PT[d.getMonth()], ano: d.getFullYear() });
  }
  return lista;
}

function paraCsv(linhas, nomeBase) {
  const cabecalho = ["data", "base", "pessoa", "descricao", "categoria", "valor", "metodo", "referencia"];
  const escapar = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const corpo = linhas.map((r) => [
    dataDe(r.pagoEm)?.toISOString().slice(0, 10) ?? "",
    nomeBase(r.baseId), r.pessoaNome ?? "", r.descricao ?? "",
    ROTULO_CATEGORIA_DESPESA[r.categoria] ?? r.categoria ?? "",
    r.valor, r.metodoPagamento ?? "", r.referenciaPagamento ?? "",
  ].map(escapar).join(","));
  return [cabecalho.join(","), ...corpo].join("\n");
}

/** Relatórios — o histórico todo, com filtros, gráficos e o detalhe
 *  linha a linha. É o ecrã de "quanto gastámos em quê, e quanto
 *  entrou", por oposição ao Início, que só responde "o que falta
 *  fazer agora". */
export default function Relatorios({ ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const [periodo, setPeriodo] = useState("ano");
  const [pagos, setPagos] = useState([]);
  const [porPagar, setPorPagar] = useState([]);
  const [contagens, setContagens] = useState([]);
  const [bases, setBases] = useState({});

  useEffect(() => ouvirBases(setBases), []);
  useEffect(() => ouvirReembolsosPagos(setPagos), []);
  useEffect(() => ouvirReembolsosPorEstado("aprovado", setPorPagar), []);
  useEffect(() => ouvirContagens(setContagens), []);

  const hoje = useMemo(() => new Date(), []);
  const nomeBase = (b) => bases[b]?.nome ?? b;
  const corBase = (b) => bases[b]?.cor ?? "#6a7192";

  const pagosNoPeriodo = useMemo(
    () => pagos.filter((r) => dentroDoPeriodo(dataDe(r.pagoEm), periodo, hoje)),
    [pagos, periodo, hoje],
  );
  const contagensNoPeriodo = useMemo(
    () => contagens.filter((c) => dentroDoPeriodo(dataDeIso(c.data), periodo, hoje)),
    [contagens, periodo, hoje],
  );

  const totalPago = pagosNoPeriodo.reduce((s, r) => s + r.valor, 0);
  const totalOferta = emEuros(contagensNoPeriodo.reduce((s, c) => s + (c.total ?? 0), 0));

  /** Dias entre o pedido chegar e ser pago — o número que diz se o
   *  Financeiro está a responder depressa ou a deixar arrastar. */
  const diasMedios = useMemo(() => {
    const dias = pagosNoPeriodo
      .map((r) => [dataDe(r.criadoEm), dataDe(r.pagoEm)])
      .filter(([a, b]) => a && b)
      .map(([a, b]) => (b - a) / 86400000);
    if (!dias.length) return null;
    return dias.reduce((s, d) => s + d, 0) / dias.length;
  }, [pagosNoPeriodo]);

  const porCategoria = useMemo(() => {
    const mapa = new Map();
    for (const r of pagosNoPeriodo) if (r.categoria) mapa.set(r.categoria, (mapa.get(r.categoria) ?? 0) + r.valor);
    return CATEGORIAS_DESPESA
      .map(([id]) => ({ chave: id, rotulo: ROTULO_CATEGORIA_DESPESA[id], valor: mapa.get(id) ?? 0 }))
      .filter((l) => l.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [pagosNoPeriodo]);

  const porBase = useMemo(() => {
    const mapa = new Map();
    for (const r of pagosNoPeriodo) mapa.set(r.baseId, (mapa.get(r.baseId) ?? 0) + r.valor);
    return [...mapa.entries()]
      .map(([baseId, valor]) => ({ chave: baseId, rotulo: nomeBase(baseId), valor, cor: corBase(baseId) }))
      .sort((a, b) => b.valor - a.valor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagosNoPeriodo, bases]);

  const ofertaPorMes = useMemo(() => {
    const meses = ultimosMeses(hoje, 6);
    const mapa = new Map();
    for (const c of contagens) {
      const d = dataDeIso(c.data);
      if (d) mapa.set(chaveMes(d), (mapa.get(chaveMes(d)) ?? 0) + (c.total ?? 0));
    }
    return meses.map((m) => ({ chave: m.chave, rotulo: m.rotulo, valor: emEuros(mapa.get(m.chave) ?? 0) }));
  }, [contagens, hoje]);

  const tabelaMeses = useMemo(() => {
    const meses = ultimosMeses(hoje, 6);
    return meses.map((m) => ({
      ...m,
      oferta: emEuros(contagens
        .filter((c) => { const d = dataDeIso(c.data); return d && chaveMes(d) === m.chave; })
        .reduce((s, c) => s + (c.total ?? 0), 0)),
      pago: pagos
        .filter((r) => { const d = dataDe(r.pagoEm); return d && chaveMes(d) === m.chave; })
        .reduce((s, r) => s + r.valor, 0),
    }));
  }, [contagens, pagos, hoje]);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Relatórios</em>,
      subtitulo: "O histórico todo, com filtros",
      chips: [PERIODOS.find(([p]) => p === periodo)?.[1] ?? ""],
    });
  }, [ativo, definirCabecalho, periodo]);

  function exportarCsv() {
    if (!pagosNoPeriodo.length) return torrada("Não há nada pago neste período para exportar.");
    const csv = paraCsv(pagosNoPeriodo, nomeBase);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `reembolsos-${periodo}-${hoje.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="menu" style={{ position: "static", border: 0, padding: "14px 0 4px", background: "none", backdropFilter: "none" }}>
        {PERIODOS.map(([id, rotulo]) => (
          <button key={id} data-on={periodo === id ? "1" : "0"} onClick={() => setPeriodo(id)}>{rotulo}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 }}>
        <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent", marginTop: 0 }}>
          <p className="ds" style={{ marginTop: 0 }}>Reembolsado</p>
          <p style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.03em", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{eur(totalPago)}</p>
          <p className="ds" style={{ marginTop: 2 }}>{pagosNoPeriodo.length} pedido{pagosNoPeriodo.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent", marginTop: 0 }}>
          <p className="ds" style={{ marginTop: 0 }}>Oferta contada</p>
          <p style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.03em", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{eur(totalOferta)}</p>
          <p className="ds" style={{ marginTop: 2 }}>{contagensNoPeriodo.length} contagem{contagensNoPeriodo.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {(diasMedios !== null || porPagar.length > 0) && (
        <div className="caixa" style={{ marginTop: 10 }}>
          {diasMedios !== null && (
            <p className="ds" style={{ marginTop: 0 }}>
              Do pedido ao pagamento: <b>{diasMedios.toFixed(1)} dias</b> em média, neste período.
            </p>
          )}
          {porPagar.length > 0 && (
            <p className="ds" style={{ marginTop: diasMedios !== null ? 6 : 0 }}>
              Por pagar agora: <b>{eur(porPagar.reduce((s, r) => s + r.valor, 0))}</b> em {porPagar.length} pedido{porPagar.length !== 1 ? "s" : ""}.
            </p>
          )}
        </div>
      )}

      <div className="sect">
        <div className="cabecalho"><h3>Por categoria</h3><span className="cap">reembolsos pagos</span></div>
        <Barras linhas={porCategoria} vazio="Nada pago com categoria neste período." />
      </div>

      <div className="sect">
        <div className="cabecalho"><h3>Por base</h3><span className="cap">reembolsos pagos</span></div>
        <Barras linhas={porBase} vazio="Nada pago neste período." />
      </div>

      <div className="sect">
        <div className="cabecalho"><h3>Oferta por mês</h3><span className="cap">últimos 6</span></div>
        <Barras linhas={ofertaPorMes.filter((m) => m.valor > 0)} vazio="Ainda não há contagens de oferta." />
      </div>

      <div className="sect">
        <div className="cabecalho"><h3>Mês a mês</h3></div>
        <div className="tabwrap">
          <table className="tab" style={{ marginTop: 4 }}>
            <thead>
              <tr><th>Mês</th><th style={{ textAlign: "right" }}>Oferta</th><th style={{ textAlign: "right" }}>Reembolsado</th></tr>
            </thead>
            <tbody>
              {tabelaMeses.map((m) => (
                <tr key={m.chave}>
                  <td>{m.rotulo}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{eur(m.oferta)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{eur(m.pago)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sect">
        <div className="cabecalho"><h3>Detalhe dos pagamentos</h3><span className="cap">{pagosNoPeriodo.length}</span></div>
        {pagosNoPeriodo.length ? pagosNoPeriodo.slice(0, 40).map((r) => (
          <div className="linha" key={`${r.baseId}-${r.id}`}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="nmt">{eur(r.valor)}</p>
              <p className="ds">
                {r.pessoaNome ?? "…"} · {dataTimestamp(r.pagoEm)}
                {r.categoria ? ` · ${ROTULO_CATEGORIA_DESPESA[r.categoria] ?? r.categoria}` : ""}
              </p>
              <span className="tag" style={{ display: "inline-block", marginTop: 6, background: corBase(r.baseId) }}>
                {nomeBase(r.baseId)}
              </span>
            </div>
          </div>
        )) : <div className="vaz">Nada pago neste período.</div>}
      </div>

      <div className="sect">
        <div className="cabecalho"><h3>Contagens de oferta</h3><span className="cap">{contagensNoPeriodo.length}</span></div>
        {contagensNoPeriodo.length ? contagensNoPeriodo.slice(0, 20).map((c) => (
          <div className="linha" key={c.id}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="nmt">{eur(emEuros(c.total))}</p>
              <p className="ds">
                {c.data ? dataPorExtenso(c.data) : "sem data"} · notas {eur(emEuros(c.totalNotas))} · moedas {eur(emEuros(c.totalMoedas))}
              </p>
            </div>
          </div>
        )) : <div className="vaz">Sem contagens neste período.</div>}
      </div>

      <button className="btn sec full" style={{ marginTop: 20, marginBottom: 20 }} onClick={exportarCsv}>
        Exportar pagamentos (CSV)
      </button>
    </>
  );
}
