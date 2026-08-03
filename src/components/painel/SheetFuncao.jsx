import { useState } from "react";
import { guardarFuncao, desativarFuncao } from "../../lib/painel";
import { useTorrada } from "../../lib/TorradaContext";
import { ICF, ICF_NOMES, svgFn } from "../../lib/iconesFuncao";
import { FASES } from "../../lib/modelo";
import { dataPorExtenso } from "../../lib/data";

export default function SheetFuncao({ funcao, eventosDisponiveis, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState(funcao?.nome ?? "");
  const [descricao, setDescricao] = useState(funcao?.descricao ?? "");
  const [fase, setFase] = useState(funcao?.fase ?? "pre");
  const [icone, setIcone] = useState(funcao?.icone ?? "brilho");
  const [escopo, setEscopo] = useState(funcao?.eventoId ?? null);
  const [aEnviar, setAEnviar] = useState(false);

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("A função precisa de um nome");
    setAEnviar(true);
    try {
      const dados = { nome: n, descricao: descricao.trim(), fase, icone, eventoId: escopo || null };
      if (funcao) {
        await guardarFuncao(funcao.id, dados);
        onGuardado(escopo ? "Função atualizada — só neste culto" : "Função atualizada");
      } else {
        await guardarFuncao(null, { ...dados, foto: null });
        onGuardado(escopo ? "Função criada só para este culto" : "Função criada no catálogo");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function desativar() {
    try {
      await desativarFuncao(funcao.id);
      onGuardado("Função desativada — o histórico mantém-se");
    } catch (e) {
      torrada(e.message || "Não foi possível desativar.");
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{funcao ? "Editar função" : "Nova função"}</h2>
        <label className="rot" style={{ marginTop: 14 }}>Nome curto</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Sala de amamentação" />
        <label className="rot">Onde aparece</label>
        <div className="subtabs">
          <button data-on={!escopo ? 1 : 0} onClick={() => setEscopo(null)}>Todos os cultos</button>
          <button
            data-on={escopo ? 1 : 0}
            disabled={!eventosDisponiveis.length}
            onClick={() => setEscopo(escopo || eventosDisponiveis[0]?.id || null)}
          >
            Só um culto
          </button>
        </div>
        {escopo && (
          <div className="subtabs">
            {eventosDisponiveis.map((e) => (
              <button key={e.id} data-on={escopo === e.id ? 1 : 0} onClick={() => setEscopo(e.id)}>
                {e.tipo ? `✦ ${dataPorExtenso(e.data)}` : dataPorExtenso(e.data)}
              </button>
            ))}
          </div>
        )}
        <label className="rot">Quando se faz</label>
        <div className="subtabs">
          {FASES.map(([k, t]) => (
            <button key={k} data-on={fase === k ? 1 : 0} onClick={() => setFase(k)}>{t}</button>
          ))}
        </div>
        <label className="rot">Símbolo</label>
        <div className="icgrid">
          {Object.keys(ICF).map((k) => (
            <button
              key={k}
              type="button"
              className="icbt"
              data-on={icone === k ? 1 : 0}
              title={ICF_NOMES[k]}
              onClick={() => setIcone(k)}
              dangerouslySetInnerHTML={{ __html: svgFn(k, 21) }}
            />
          ))}
        </div>
        <label className="rot">Como se faz</label>
        <textarea
          className="campo" rows={5} value={descricao} onChange={(e) => setDescricao(e.target.value)}
          placeholder="O passo a passo que a pessoa vê quando abre esta função"
        />
        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar} onClick={guardar}>Guardar</button>
        {funcao && <button className="btn sec full" style={{ marginTop: 9 }} onClick={desativar}>Desativar função</button>}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
