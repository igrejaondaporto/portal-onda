import { useEffect, useMemo, useState } from "react";
import { ouvirEntradas, ouvirFontesEntrada, ROTULO_FUNDO, ROTULO_METODO_ENTRADA } from "../lib/entradas";
import { eur, dataTimestamp } from "@portal/shared/lib/data.js";
import SheetRegistarEntrada from "../components/SheetRegistarEntrada";
import SheetFonteEntrada from "../components/SheetFonteEntrada";

const ROTULO_PERIODICIDADE = { mensal: "/mês", anual: "/ano", pontual: "" };

/** Dízimos, ofertas e outras receitas — sempre lançadas pelo próprio
 *  Financeiro (nenhuma base tem esse dado). "Fontes fixas" é o
 *  catálogo de receita recorrente (aluguel, doação combinada), para
 *  não escrever fundo/valor à mão todo mês; o registo em si é sempre
 *  o mesmo formulário, com ou sem fonte. */
export default function Entradas({ uid, ativo, definirCabecalho }) {
  const [entradas, setEntradas] = useState([]);
  const [fontes, setFontes] = useState([]);
  const [sheetEntrada, setSheetEntrada] = useState(false); // false | { fonte? }
  const [sheetFonte, setSheetFonte] = useState(null); // null | {} | fonte

  useEffect(() => ouvirEntradas(setEntradas), []);
  useEffect(() => ouvirFontesEntrada(setFontes), []);

  const fontesAtivas = useMemo(() => fontes.filter((f) => f.ativo), [fontes]);

  const hoje = useMemo(() => new Date(), []);
  const chaveMesAtual = `${hoje.getFullYear()}-${hoje.getMonth()}`;
  const entradasEsteMes = useMemo(
    () => entradas.filter((e) => e.criadoEm?.toDate && `${e.criadoEm.toDate().getFullYear()}-${e.criadoEm.toDate().getMonth()}` === chaveMesAtual),
    [entradas, chaveMesAtual],
  );
  const totalMes = entradasEsteMes.reduce((s, e) => s + e.valor, 0);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Entradas</em>,
      subtitulo: "Dízimos, ofertas e outras receitas",
      chips: [eur(totalMes), `${entradasEsteMes.length} este mês`],
    });
  }, [ativo, definirCabecalho, totalMes, entradasEsteMes.length]);

  return (
    <>
      <button className="btn full" style={{ marginTop: 20 }} onClick={() => setSheetEntrada({})}>
        + Registar entrada
      </button>

      <div className="sect">
        <div className="cabecalho">
          <h3>Fontes fixas</h3>
          <button className="cap" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => setSheetFonte({ nova: true })}>
            + Nova
          </button>
        </div>

        {fontesAtivas.length ? fontesAtivas.map((f) => (
          <div className="linha" key={f.id}>
            <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setSheetFonte({ fonte: f })}>
              <p className="nmt">{f.nome}</p>
              <p className="ds">
                {ROTULO_FUNDO[f.fundo] ?? f.fundo}
                {f.valorHabitual ? ` · ${eur(f.valorHabitual)}${ROTULO_PERIODICIDADE[f.periodicidade] ?? ""}` : ""}
              </p>
            </div>
            <button className="btn sec" style={{ flex: "none", padding: "10px 14px", fontSize: 13 }} onClick={() => setSheetEntrada({ fonte: f })}>
              Registar
            </button>
          </div>
        )) : <div className="vaz">Sem fontes fixas ainda. "+ Nova" para uma receita recorrente (aluguel, doação combinada).</div>}
      </div>

      <div className="sect">
        <div className="cabecalho"><h3>Últimos lançamentos</h3></div>
        {entradas.length ? entradas.slice(0, 20).map((e) => (
          <div className="linha" key={e.id}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="nmt">{eur(e.valor)}</p>
              <p className="ds">
                {ROTULO_FUNDO[e.fundo] ?? e.fundo} · {dataTimestamp(e.criadoEm)}
                {e.fonteNome ? ` · ${e.fonteNome}` : ""}{e.referencia ? ` · ${e.referencia}` : ""}
              </p>
            </div>
            <span className="tag cinz">{ROTULO_METODO_ENTRADA[e.metodo] ?? e.metodo}</span>
          </div>
        )) : <div className="vaz">Ainda não há entradas registadas.</div>}
      </div>

      {sheetEntrada && (
        <SheetRegistarEntrada
          uid={uid} fonte={sheetEntrada.fonte}
          onFechar={() => setSheetEntrada(false)}
          onFeito={() => setSheetEntrada(false)}
        />
      )}
      {sheetFonte && (
        <SheetFonteEntrada
          fonte={sheetFonte.fonte}
          onFechar={() => setSheetFonte(null)}
          onGuardado={() => setSheetFonte(null)}
        />
      )}
    </>
  );
}
