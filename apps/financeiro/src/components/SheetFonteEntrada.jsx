import { useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import {
  FUNDOS, novaFonteEntradaId, criarFonteEntrada, editarFonteEntrada,
  desativarFonteEntrada, reativarFonteEntrada,
} from "../lib/entradas";

const PERIODICIDADES = [
  ["mensal", "Mensal"],
  ["anual", "Anual"],
  ["pontual", "Pontual"],
];

/** Criar ou editar uma fonte fixa de entrada — aluguel de espaço, uma
 *  doação mensal já combinada. `valorHabitual` só pré-preenche o
 *  registo em `entradas`; o valor real de cada lançamento pode variar. */
export default function SheetFonteEntrada({ fonte, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState(fonte?.nome ?? "");
  const [fundo, setFundo] = useState(fonte?.fundo ?? FUNDOS[0][0]);
  const [valorHabitual, setValorHabitual] = useState(fonte?.valorHabitual ? String(fonte.valorHabitual) : "");
  const [periodicidade, setPeriodicidade] = useState(fonte?.periodicidade ?? "mensal");
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    if (!nome.trim()) return torrada("Escreve o nome da fonte");
    setAEnviar(true);
    try {
      const dados = {
        nome: nome.trim(), fundo, periodicidade,
        valorHabitual: valorHabitual ? Number(valorHabitual) : null,
      };
      if (fonte) await editarFonteEntrada(fonte.id, dados);
      else await criarFonteEntrada(novaFonteEntradaId(), dados);
      torrada(fonte ? "Fonte atualizada" : "Fonte criada");
      onGuardado?.();
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    } finally {
      setAEnviar(false);
    }
  }

  async function alternarAtivo() {
    setAEnviar(true);
    try {
      if (fonte.ativo) await desativarFonteEntrada(fonte.id);
      else await reativarFonteEntrada(fonte.id);
      torrada(fonte.ativo ? "Fonte desativada" : "Fonte reativada");
      onGuardado?.();
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{fonte ? "Editar fonte" : "Nova fonte fixa"}</h2>

        <label className="rot" style={{ marginTop: 14 }}>Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Aluguel da sala, Doação da família X" />

        <label className="rot">Fundo</label>
        <select className="campo" value={fundo} onChange={(e) => setFundo(e.target.value)}>
          {FUNDOS.map(([id, rotulo]) => (
            <option key={id} value={id}>{rotulo}</option>
          ))}
        </select>

        <label className="rot">Periodicidade</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
          {PERIODICIDADES.map(([p, rotulo]) => (
            <button
              key={p} className="btn sec" style={{ padding: "12px 8px", fontSize: 13.5, ...(periodicidade === p ? { background: "var(--azul)", color: "#fff" } : null) }}
              onClick={() => setPeriodicidade(p)}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <label className="rot">Valor habitual (opcional)</label>
        <input className="campo" type="number" inputMode="decimal" value={valorHabitual} onChange={(e) => setValorHabitual(e.target.value)} placeholder="0,00" />

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button className="btn full" disabled={aEnviar} onClick={guardar}>Guardar</button>
          {fonte && (
            <button
              className="btn sec" style={{ flex: "none", padding: "13px 16px", color: fonte.ativo ? "var(--magenta)" : "var(--azul)" }}
              disabled={aEnviar} onClick={alternarAtivo}
            >
              {fonte.ativo ? "Desativar" : "Reativar"}
            </button>
          )}
        </div>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
