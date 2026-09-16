import { useState } from "react";
import { CATEGORIAS_DESPESA } from "@portal/shared/lib/categoriasDespesa.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { novoFornecedorId, criarFornecedor, editarFornecedor, desativarFornecedor, reativarFornecedor } from "../lib/fornecedores";

const PERIODICIDADES = [
  ["mensal", "Mensal"],
  ["anual", "Anual"],
  ["pontual", "Pontual"],
];

/** Criar ou editar um fornecedor de despesa fixa — renda, subscrição,
 *  contrato de limpeza. `valorHabitual` é só uma referência para
 *  pré-preencher o registo de pagamento; o valor real de cada
 *  pagamento vai sempre em `despesasFixas`, pode variar do habitual. */
export default function SheetFornecedor({ fornecedor, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState(fornecedor?.nome ?? "");
  const [categoria, setCategoria] = useState(fornecedor?.categoria ?? CATEGORIAS_DESPESA[0][0]);
  const [valorHabitual, setValorHabitual] = useState(fornecedor?.valorHabitual ? String(fornecedor.valorHabitual) : "");
  const [periodicidade, setPeriodicidade] = useState(fornecedor?.periodicidade ?? "mensal");
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    if (!nome.trim()) return torrada("Escreve o nome do fornecedor");
    setAEnviar(true);
    try {
      const dados = {
        nome: nome.trim(), categoria, periodicidade,
        valorHabitual: valorHabitual ? Number(valorHabitual) : null,
      };
      if (fornecedor) await editarFornecedor(fornecedor.id, dados);
      else await criarFornecedor(novoFornecedorId(), dados);
      torrada(fornecedor ? "Fornecedor atualizado" : "Fornecedor criado");
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
      if (fornecedor.ativo) await desativarFornecedor(fornecedor.id);
      else await reativarFornecedor(fornecedor.id);
      torrada(fornecedor.ativo ? "Fornecedor desativado" : "Fornecedor reativado");
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
        <h2>{fornecedor ? "Editar fornecedor" : "Novo fornecedor"}</h2>

        <label className="rot" style={{ marginTop: 14 }}>Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Senhorio, EDP, Vodafone" />

        <label className="rot">Categoria</label>
        <select className="campo" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {CATEGORIAS_DESPESA.map(([id, rotulo]) => (
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
          {fornecedor && (
            <button
              className="btn sec" style={{ flex: "none", padding: "13px 16px", color: fornecedor.ativo ? "var(--magenta)" : "var(--azul)" }}
              disabled={aEnviar} onClick={alternarAtivo}
            >
              {fornecedor.ativo ? "Desativar" : "Reativar"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
