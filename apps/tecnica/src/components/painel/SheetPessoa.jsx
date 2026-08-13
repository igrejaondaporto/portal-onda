import { useState } from "react";
import { criarVoluntario, editarVoluntario, reporPin } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";

const NIVEIS = [
  [null, "Não serve"],
  ["aprendiz", "Em treino"],
  ["titular", "Titular"],
];

export default function SheetPessoa({
  pessoa, ministerios = [], onFechar, onGuardado, onRemover,
  pessoaExistente, onDesligarPessoa,
}) {
  const torrada = useTorrada();
  const [nome, setNome] = useState(pessoa?.nome ?? pessoaExistente?.nome ?? "");
  const [telefone, setTelefone] = useState(pessoa?.telefone ?? pessoaExistente?.telefone ?? "");
  const [papel, setPapel] = useState(pessoa?.papel ?? "voluntario");
  const [ministeriosPessoa, setMinisteriosPessoa] = useState(pessoa?.ministerios ?? {});
  const [aEnviar, setAEnviar] = useState(false);

  function definirNivel(ministerioId, nivel) {
    setMinisteriosPessoa((atual) => {
      const novo = { ...atual };
      if (nivel) novo[ministerioId] = nivel;
      else delete novo[ministerioId];
      return novo;
    });
  }

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("O voluntário precisa de um nome");
    setAEnviar(true);
    try {
      const dados = { nome: n, telefone: telefone.trim(), papel, ministerios: ministeriosPessoa };
      if (pessoa) {
        await editarVoluntario({ pessoaId: pessoa.id, ...dados });
        onGuardado("Voluntário atualizado");
      } else {
        if (pessoaExistente) dados.pessoaExistenteId = pessoaExistente.pessoaExistenteId;
        await criarVoluntario(dados);
        onGuardado(pessoaExistente ? `${n} ligado — já é multi-base` : "Voluntário adicionado");
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

        {!pessoa && pessoaExistente && (
          <div className="caixa" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar pessoa={pessoaExistente} tamanho={36} />
            <div style={{ flex: 1 }}>
              <p className="nmt" style={{ fontSize: 14 }}>Ligado ao perfil de {pessoaExistente.nome}</p>
              <p className="ds">Ao guardar, o perfil passa a multi-base.</p>
            </div>
            <button className="btn sec" style={{ padding: "6px 12px", fontSize: 12.5 }} onClick={onDesligarPessoa}>
              Trocar
            </button>
          </div>
        )}
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

        {ministerios.length > 0 && (
          <>
            <label className="rot" style={{ marginTop: 14 }}>Ministérios</label>
            {ministerios.map((m) => (
              <div key={m.id} style={{ marginTop: 8 }}>
                <p className="ds" style={{ marginBottom: 4 }}>{m.nome}</p>
                <div className="subtabs">
                  {NIVEIS.map(([valor, rotulo]) => (
                    <button
                      key={rotulo}
                      data-on={(ministeriosPessoa[m.id] ?? null) === valor ? 1 : 0}
                      onClick={() => definirNivel(m.id, valor)}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

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
