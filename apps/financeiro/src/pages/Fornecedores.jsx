import { useEffect, useMemo, useState } from "react";
import { ouvirFornecedores, ouvirDespesasFixas } from "../lib/fornecedores";
import { ROTULO_CATEGORIA_DESPESA } from "@portal/shared/lib/categoriasDespesa.js";
import { eur, dataTimestamp } from "@portal/shared/lib/data.js";
import { ROTULO_METODO } from "../lib/reembolsosFinanceiro";
import SheetFornecedor from "../components/SheetFornecedor";
import SheetRegistarDespesa from "../components/SheetRegistarDespesa";

const ROTULO_PERIODICIDADE = { mensal: "/mês", anual: "/ano", pontual: "" };

export default function Fornecedores({ uid, ativo, definirCabecalho }) {
  const [fornecedores, setFornecedores] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [sheetFornecedor, setSheetFornecedor] = useState(null); // { fornecedor } | { novo: true } | null
  const [aPagar, setAPagar] = useState(null); // fornecedor

  useEffect(() => ouvirFornecedores(setFornecedores), []);
  useEffect(() => ouvirDespesasFixas(setDespesas), []);

  const ativos = useMemo(() => fornecedores.filter((f) => f.ativo), [fornecedores]);
  const inativos = useMemo(() => fornecedores.filter((f) => !f.ativo), [fornecedores]);

  const hoje = useMemo(() => new Date(), []);
  const chaveMesAtual = `${hoje.getFullYear()}-${hoje.getMonth()}`;
  const pagoEsteMes = useMemo(
    () => despesas.filter((d) => d.criadoEm?.toDate && `${d.criadoEm.toDate().getFullYear()}-${d.criadoEm.toDate().getMonth()}` === chaveMesAtual),
    [despesas, chaveMesAtual],
  );
  const totalEsteMes = pagoEsteMes.reduce((s, d) => s + d.valor, 0);

  // só recalcula o cabeçalho quando esta aba fica ativa — ver o mesmo
  // comentário em Inicio.jsx.
  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Fornecedores</em>,
      subtitulo: "Gastos fixos e recorrentes",
      chips: [eur(totalEsteMes), `${pagoEsteMes.length} pago${pagoEsteMes.length !== 1 ? "s" : ""} este mês`],
    });
  }, [ativo, definirCabecalho, totalEsteMes, pagoEsteMes.length]);

  return (
    <>
      <button className="btn full" style={{ marginTop: 20 }} onClick={() => setSheetFornecedor({ novo: true })}>
        + Novo fornecedor
      </button>

      <div className="sect">
        <div className="cabecalho">
          <h3>Fornecedores</h3>
        </div>

        {ativos.length ? ativos.map((f) => (
          <div className="linha" key={f.id}>
            <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setSheetFornecedor({ fornecedor: f })}>
              <p className="nmt">{f.nome}</p>
              <p className="ds">
                {ROTULO_CATEGORIA_DESPESA[f.categoria] ?? f.categoria}
                {f.valorHabitual ? ` · ${eur(f.valorHabitual)}${ROTULO_PERIODICIDADE[f.periodicidade] ?? ""}` : ""}
              </p>
            </div>
            <button className="btn sec" style={{ flex: "none", padding: "10px 14px", fontSize: 13 }} onClick={() => setAPagar(f)}>
              Registar
            </button>
          </div>
        )) : <div className="vaz">Ainda não há fornecedores. Toca em "+ Novo" para começar.</div>}

        {inativos.length > 0 && (
          <>
            <div className="cabecalho" style={{ marginTop: 8 }}><h3 style={{ opacity: 0.6 }}>Inativos</h3></div>
            {inativos.map((f) => (
              <div className="linha" key={f.id} style={{ cursor: "pointer", opacity: 0.55 }} onClick={() => setSheetFornecedor({ fornecedor: f })}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="nmt">{f.nome}</p>
                  <p className="ds">{ROTULO_CATEGORIA_DESPESA[f.categoria] ?? f.categoria}</p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="sect">
        <div className="cabecalho"><h3>Últimos pagamentos</h3></div>
        {despesas.length ? despesas.slice(0, 20).map((d) => (
          <div className="linha" key={d.id}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="nmt">{eur(d.valor)}</p>
              <p className="ds">{d.fornecedorNome} · {dataTimestamp(d.criadoEm)}</p>
            </div>
            <span className="tag cinz">{ROTULO_METODO[d.metodo] ?? d.metodo ?? "—"}</span>
          </div>
        )) : <div className="vaz">Ainda não há pagamentos registados.</div>}
      </div>

      {sheetFornecedor && (
        <SheetFornecedor
          fornecedor={sheetFornecedor.fornecedor}
          onFechar={() => setSheetFornecedor(null)}
          onGuardado={() => setSheetFornecedor(null)}
        />
      )}
      {aPagar && (
        <SheetRegistarDespesa
          fornecedor={aPagar} uid={uid}
          onFechar={() => setAPagar(null)}
          onFeito={() => setAPagar(null)}
        />
      )}
    </>
  );
}
