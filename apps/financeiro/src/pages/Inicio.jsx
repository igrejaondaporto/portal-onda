import { useEffect, useMemo, useState } from "react";
import { ouvirReembolsosPorEstado, ouvirReembolsosPagos } from "../lib/reembolsosFinanceiro";
import { ouvirDespesasFixas } from "../lib/fornecedores";
import { ouvirEntradas, FUNDOS, ROTULO_FUNDO } from "../lib/entradas";
import { obterPatrimonioBases } from "../lib/relatorio";
import { CATEGORIAS_DESPESA, ROTULO_CATEGORIA_DESPESA } from "@portal/shared/lib/categoriasDespesa.js";
import { ROTULO_TIPO_PATRIMONIO } from "@portal/shared/lib/tiposPatrimonio.js";
import { eur } from "@portal/shared/lib/data.js";

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const chaveMes = (ts) => (ts?.toDate ? `${ts.toDate().getFullYear()}-${ts.toDate().getMonth()}` : null);

/** As últimas 6 chaves "AAAA-M", da mais antiga para a mais recente —
 *  é o eixo da tabela de baixo, sempre com 6 linhas mesmo em meses
 *  sem nenhum lançamento. */
function ultimosMeses(hoje, n) {
  const lista = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    lista.push({ chave: `${d.getFullYear()}-${d.getMonth()}`, rotulo: MESES_PT[d.getMonth()] });
  }
  return lista;
}

/** Barra horizontal simples (magnitude, um hue só) — mesmo padrão
 *  visual já usado em Caixa.jsx ("Por base"), reaproveitado aqui em
 *  vez de inventar um segundo tipo de gráfico para a mesma ideia. */
function Barras({ linhas }) {
  const maior = Math.max(...linhas.map((l) => l.valor), 1);
  return (
    <>
      {linhas.map((l) => (
        <div className="fila" style={{ paddingTop: 13 }} key={l.chave}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.02em" }}>{l.rotulo}</span>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums", flex: "none" }}>{eur(l.valor)}</span>
          </div>
          <div className="barra" style={{ marginTop: 7 }}>
            <i style={{ width: `${(l.valor / maior) * 100}%`, background: "var(--azul)" }} />
          </div>
        </div>
      ))}
    </>
  );
}

/** Início — a visão de conjunto que os outros ecrãs não dão (cada um
 *  só mostra a parte dele). Tudo lido do que já existe (reembolsos,
 *  despesas fixas, entradas); só o património de Técnica/Louvor vem
 *  de uma chamada própria, porque `inventario` é fechado por
 *  `minhaBase` (ver lib/relatorio.js). */
export default function Inicio({ ativo, definirCabecalho }) {
  const [porPagar, setPorPagar] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [despesasFixas, setDespesasFixas] = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [patrimonio, setPatrimonio] = useState(null);

  useEffect(() => ouvirReembolsosPorEstado("aprovado", setPorPagar), []);
  useEffect(() => ouvirReembolsosPagos(setPagos), []);
  useEffect(() => ouvirDespesasFixas(setDespesasFixas), []);
  useEffect(() => ouvirEntradas(setEntradas), []);
  useEffect(() => { obterPatrimonioBases().then((r) => setPatrimonio(r)).catch(() => setPatrimonio({ porTipo: {}, total: 0 })); }, []);

  const hoje = useMemo(() => new Date(), []);
  const chaveMesAtual = `${hoje.getFullYear()}-${hoje.getMonth()}`;

  const totalPorPagar = porPagar.reduce((s, r) => s + r.valor, 0);
  const basesPorPagar = new Set(porPagar.map((r) => r.baseId)).size;

  const pagoEsteMes = useMemo(() => pagos.filter((r) => chaveMes(r.pagoEm) === chaveMesAtual), [pagos, chaveMesAtual]);
  const despesasFixasEsteMes = useMemo(() => despesasFixas.filter((d) => chaveMes(d.criadoEm) === chaveMesAtual), [despesasFixas, chaveMesAtual]);
  const entradasEsteMes = useMemo(() => entradas.filter((e) => chaveMes(e.criadoEm) === chaveMesAtual), [entradas, chaveMesAtual]);

  const totalEntrouMes = entradasEsteMes.reduce((s, e) => s + e.valor, 0);
  const totalSaiuMes = pagoEsteMes.reduce((s, r) => s + r.valor, 0) + despesasFixasEsteMes.reduce((s, d) => s + d.valor, 0);

  const anoAtual = hoje.getFullYear();
  const porCategoria = useMemo(() => {
    const mapa = new Map();
    const doAno = (lista, chaveData) => lista.filter((x) => x[chaveData]?.toDate?.().getFullYear() === anoAtual);
    for (const r of doAno(pagos, "pagoEm")) if (r.categoria) mapa.set(r.categoria, (mapa.get(r.categoria) ?? 0) + r.valor);
    for (const d of doAno(despesasFixas, "criadoEm")) if (d.categoria) mapa.set(d.categoria, (mapa.get(d.categoria) ?? 0) + d.valor);
    return CATEGORIAS_DESPESA
      .map(([id]) => ({ chave: id, rotulo: ROTULO_CATEGORIA_DESPESA[id], valor: mapa.get(id) ?? 0 }))
      .filter((l) => l.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [pagos, despesasFixas, anoAtual]);

  const porFundo = useMemo(() => {
    const mapa = new Map();
    for (const e of entradas) {
      if (e.criadoEm?.toDate?.().getFullYear() !== anoAtual) continue;
      mapa.set(e.fundo, (mapa.get(e.fundo) ?? 0) + e.valor);
    }
    return FUNDOS
      .map(([id]) => ({ chave: id, rotulo: ROTULO_FUNDO[id], valor: mapa.get(id) ?? 0 }))
      .filter((l) => l.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [entradas, anoAtual]);

  const tabelaMeses = useMemo(() => {
    const meses = ultimosMeses(hoje, 6);
    return meses.map(({ chave, rotulo }) => ({
      chave, rotulo,
      entrou: entradas.filter((e) => chaveMes(e.criadoEm) === chave).reduce((s, e) => s + e.valor, 0),
      saiu: pagos.filter((r) => chaveMes(r.pagoEm) === chave).reduce((s, r) => s + r.valor, 0)
          + despesasFixas.filter((d) => chaveMes(d.criadoEm) === chave).reduce((s, d) => s + d.valor, 0),
    }));
  }, [hoje, entradas, pagos, despesasFixas]);

  // só recalcula o cabeçalho quando esta aba fica ativa — as quatro
  // abas ficam sempre montadas (display:none), e sem o `ativo` na
  // dependência o efeito de cada uma só disparava uma vez, à toa, no
  // arranque da app, e o título deixava de seguir a navegação.
  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Início</em>,
      subtitulo: "Visão geral do dinheiro da igreja",
      chips: [],
    });
  }, [ativo, definirCabecalho]);

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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent" }}>
          <p className="ds" style={{ marginTop: 0 }}>Entrou em {MESES_PT[hoje.getMonth()]}</p>
          <p style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.03em", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{eur(totalEntrouMes)}</p>
        </div>
        <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent" }}>
          <p className="ds" style={{ marginTop: 0 }}>Saiu em {MESES_PT[hoje.getMonth()]}</p>
          <p style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.03em", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{eur(totalSaiuMes)}</p>
        </div>
      </div>

      <div className="caixa" style={{ marginTop: 10, background: "var(--agua)", borderColor: "transparent" }}>
        <p className="ds" style={{ marginTop: 0 }}>Património (Técnica + Louvor)</p>
        <p style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.03em", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
          {patrimonio === null ? "…" : eur(patrimonio.total)}
        </p>
        {patrimonio && Object.keys(patrimonio.porTipo).length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {Object.entries(patrimonio.porTipo).sort((a, b) => b[1] - a[1]).map(([tipo, valor]) => (
              <span className="tag cinz" key={tipo}>{ROTULO_TIPO_PATRIMONIO[tipo] ?? tipo} · {eur(valor)}</span>
            ))}
          </div>
        )}
      </div>

      <div className="sect">
        <div className="cabecalho"><h3>Gasto por categoria</h3><span className="cap">{anoAtual}</span></div>
        {porCategoria.length ? <Barras linhas={porCategoria} /> : <div className="vaz">Ainda sem gastos categorizados este ano.</div>}
      </div>

      <div className="sect">
        <div className="cabecalho"><h3>Entradas por fundo</h3><span className="cap">{anoAtual}</span></div>
        {porFundo.length ? <Barras linhas={porFundo} /> : <div className="vaz">Ainda sem entradas registadas este ano.</div>}
      </div>

      <div className="sect">
        <div className="cabecalho"><h3>Últimos 6 meses</h3></div>
        <div className="tabwrap">
          <table className="tab" style={{ marginTop: 4 }}>
            <thead>
              <tr><th>Mês</th><th style={{ textAlign: "right" }}>Entrou</th><th style={{ textAlign: "right" }}>Saiu</th></tr>
            </thead>
            <tbody>
              {tabelaMeses.map((m) => (
                <tr key={m.chave}>
                  <td>{m.rotulo}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{eur(m.entrou)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{eur(m.saiu)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
