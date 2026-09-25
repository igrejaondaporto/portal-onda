import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { dataPorExtenso } from "@portal/shared/lib/data.js";

const CHAVE = "pa-aviso-sem-escala";

/** Já foi fechado hoje, para este domingo? Em try/catch: o
 *  localStorage pode não existir (janela privada, dados bloqueados) —
 *  aí o pop-up volta a cada abertura, que é o lado seguro. */
function jaVisto(domingoId, hoje) {
  try { return localStorage.getItem(CHAVE) === `${domingoId}|${hoje}`; } catch { return false; }
}
function marcarVisto(domingoId, hoje) {
  try { localStorage.setItem(CHAVE, `${domingoId}|${hoje}`); } catch { /* sem storage, volta a aparecer */ }
}

/**
 * "Domingo sem escala" — pop-up grande para o pastor, de segunda a
 * sábado, quando uma base ainda não publicou a escala do domingo desta
 * semana (pedido 2026-09: "um pop-upzão grandão; se já é segunda ou
 * terça e o domingo ainda não tem escala da base, mete o pop-up").
 *
 * Uma vez por dia: fechar esconde-o até amanhã, não para sempre — se
 * na quarta a base ainda não tem escala, o pastor volta a ser avisado.
 * Não bloqueia nada nem decide nada (o painel observa): diz quem falta
 * e deixa mandar um recado a essa base, o mesmo recado de sempre.
 */
export default function AvisoSemEscala({ domingo, bases, hoje, onRecado, onVer }) {
  const [fechado, setFechado] = useState(() => jaVisto(domingo.id, hoje));
  if (fechado) return null;

  const fechar = () => { marcarVisto(domingo.id, hoje); setFechado(true); };
  const n = bases.length;

  return (
    <>
      <div className="veu on" onClick={fechar} />
      <div className="pa-alerta" role="alertdialog" aria-modal="true" aria-labelledby="pa-alerta-titulo">
        <button className="pa-alerta-x" onClick={fechar} aria-label="Fechar"><X size={20} /></button>
        <span className="pa-alerta-icone"><AlertTriangle size={30} /></span>
        <h2 id="pa-alerta-titulo">
          {n === 1 ? "1 base ainda sem escala" : `${n} bases ainda sem escala`}
        </h2>
        <p className="pa-alerta-sub">para domingo, {dataPorExtenso(domingo.data)}</p>

        <ul className="pa-alerta-lista">
          {bases.map((b) => (
            <li key={b.baseId}>
              <span className="quadmin" style={{ background: b.cor ?? "var(--azul)" }} />
              <b>{b.nome}</b>
              <button className="btn sec" onClick={() => { fechar(); onRecado(b); }}>Recado</button>
            </li>
          ))}
        </ul>

        <button className="btn full" style={{ marginTop: 16 }} onClick={() => { fechar(); onVer(); }}>
          Ver o domingo
        </button>
        <button className="btn sec full" style={{ marginTop: 8 }} onClick={fechar}>
          Lembrar amanhã
        </button>
      </div>
    </>
  );
}
