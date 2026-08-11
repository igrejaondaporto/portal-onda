import { useState } from "react";
import { criarVoluntario, editarVoluntario, reporPin } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

export default function SheetPessoa({ pessoa, onFechar, onGuardado, onRemover }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState(pessoa?.nome ?? "");
  const [telefone, setTelefone] = useState(pessoa?.telefone ?? "");
  const [papel, setPapel] = useState(pessoa?.papel ?? "voluntario");
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("O voluntário precisa de um nome");
    setAEnviar(true);
    try {
      if (pessoa) {
        await editarVoluntario({ pessoaId: pessoa.id, nome: n, telefone: telefone.trim(), papel });
        onGuardado("Voluntário atualizado");
      } else {
        await criarVoluntario({ nome: n, telefone: telefone.trim(), papel });
        onGuardado("Voluntário adicionado");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function repor() {
    try {
      const r = await reporPin(pessoa.id);
      torrada(`Código reposto para ${r.pinProvisorio} — troca no próximo acesso`);
    } catch (e) {
      torrada(e.message || "Não foi possível repor o código.");
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{pessoa ? "Editar voluntário" : "Novo voluntário"}</h2>
        <label className="rot" style={{ marginTop: 14 }}>Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome como aparece na escala" />
        <label className="rot">Telemóvel</label>
        <input className="campo" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="9xx xxx xxx" />
        <label className="rot">Papel na base</label>
        <div className="subtabs">
          <button data-on={papel === "voluntario" ? 1 : 0} onClick={() => setPapel("voluntario")}>Voluntário</button>
          <button data-on={papel === "lider_base" ? 1 : 0} onClick={() => setPapel("lider_base")}>Líder da base</button>
        </div>
        <p className="ds" style={{ marginTop: 8 }}>O líder da base tem código de 6 dígitos e acesso a tudo.</p>
        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>Guardar</button>
        {pessoa && (
          <>
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={repor}>Repor código</button>
            <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={() => onRemover(pessoa.id)}>
              Remover da base
            </button>
          </>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
