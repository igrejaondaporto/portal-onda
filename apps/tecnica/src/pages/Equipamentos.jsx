import { useEffect, useState } from "react";
import { ouvirEquipamentos } from "../lib/equipamentos";
import { ouvirMelhorias, corMelhoria } from "../lib/melhorias";
import { ouvirVoluntarios, ouvirMinisterios } from "../lib/painel";
import SheetEquipamento from "../components/painel/SheetEquipamento";
import SheetEquipamentoDetalhe from "../components/equipamentos/SheetEquipamentoDetalhe";
import SheetMelhoria from "../components/equipamentos/SheetMelhoria";
import SheetNovaMelhoria from "../components/equipamentos/SheetNovaMelhoria";

export default function Equipamentos({ uid, papel, ativo, definirCabecalho }) {
  const souLiderBase = papel === "lider_base";
  const [aba, setAba] = useState("equipamentos");
  const [equipamentos, setEquipamentos] = useState([]);
  const [melhorias, setMelhorias] = useState([]);
  const [ministerios, setMinisterios] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [sheet, setSheet] = useState(null);

  useEffect(() => ouvirEquipamentos(setEquipamentos), []);
  useEffect(() => ouvirMelhorias(setMelhorias), []);
  useEffect(() => ouvirMinisterios(setMinisterios), []);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);

  const comProblema = equipamentos.filter((e) => e.estado !== "ok").length;
  const abertas = melhorias.filter((m) => m.estado !== "resolvida").length;

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Equipamentos",
      subtitulo: aba === "equipamentos" ? "Som, luz e projeção" : "Avarias e sugestões",
      chips: aba === "equipamentos" ? [`${equipamentos.length} itens`, comProblema ? `${comProblema} com problema` : "Tudo ok"] : [`${abertas} em aberto`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, aba, equipamentos.length, comProblema, abertas]);

  const nomeMinisterio = (id) => ministerios.find((m) => m.id === id)?.nome;
  const equipamentoAtual = sheet?.equipamentoId ? equipamentos.find((e) => e.id === sheet.equipamentoId) : null;

  return (
    <>
      <div className="subtabs">
        <button data-on={aba === "equipamentos" ? 1 : 0} onClick={() => setAba("equipamentos")}>Equipamentos</button>
        <button data-on={aba === "melhorias" ? 1 : 0} onClick={() => setAba("melhorias")}>Melhorias</button>
      </div>

      {aba === "equipamentos" ? (
        <div className="sect">
          {souLiderBase && (
            <button className="btn sec full" style={{ marginBottom: 12 }} onClick={() => setSheet({ tipo: "novoEquipamento" })}>
              Novo equipamento
            </button>
          )}
          {equipamentos.length === 0 && <div className="vaz">Ainda não há equipamentos no catálogo.</div>}
          {(ministerios.length ? [...ministerios, { id: null, nome: "Geral" }] : [{ id: null, nome: "Geral" }]).map((m) => {
            const doM = equipamentos.filter((e) => e.ministerioId === m.id);
            if (!doM.length) return null;
            return (
              <div key={m.id ?? "geral"}>
                <p className="cap" style={{ padding: "10px 0 4px", color: m.cor }}>{m.nome} · {doM.length}</p>
                {doM.map((e) => (
                  <div className="linha" style={{ cursor: "pointer" }} key={e.id} onClick={() => setSheet({ tipo: "detalheEquipamento", equipamentoId: e.id })}>
                    <div style={{ flex: 1 }}>
                      <p className="nmt">{e.nome}</p>
                      <p className="ds">{[e.modelo, e.local].filter(Boolean).join(" · ") || "Sem detalhes"}</p>
                    </div>
                    {e.estado === "avariado" && <span className="tag">Avariado</span>}
                    {e.estado === "em_reparacao" && <span className="tag lim">Em reparação</span>}
                    <span className="seta">›</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="sect">
          <button className="btn sec full" style={{ marginBottom: 12 }} onClick={() => setSheet({ tipo: "novaMelhoria" })}>
            Nova melhoria
          </button>
          {melhorias.length === 0 && <div className="vaz">Nada reportado ainda.</div>}
          {[...melhorias].sort((a, b) => (a.estado === "resolvida") - (b.estado === "resolvida")).map((m) => {
            const { cor, texto } = corMelhoria(m);
            return (
              <div className="linha" style={{ cursor: "pointer" }} key={m.id} onClick={() => setSheet({ tipo: "melhoria", melhoriaId: m.id })}>
                <div style={{ flex: 1 }}>
                  <p className="nmt">{m.titulo}</p>
                  <p className="ds">{m.ministerioId ? nomeMinisterio(m.ministerioId) : "Geral"}</p>
                </div>
                <span className={`tag ${cor}`}>{m.estado === "resolvida" ? "Resolvida" : texto}</span>
                <span className="seta">›</span>
              </div>
            );
          })}
        </div>
      )}

      {sheet?.tipo === "novoEquipamento" && (
        <SheetEquipamento
          equipamento={null} ministerios={ministerios}
          onFechar={() => setSheet(null)}
          onGuardado={() => setSheet(null)}
        />
      )}
      {sheet?.tipo === "detalheEquipamento" && (
        <SheetEquipamentoDetalhe
          equipamento={equipamentoAtual} melhorias={melhorias} ministerios={ministerios} souLiderBase={souLiderBase}
          onFechar={() => setSheet(null)}
          onEditar={() => setSheet({ tipo: "editarEquipamento", equipamentoId: sheet.equipamentoId })}
          onReportarAvaria={() => setSheet({ tipo: "novaMelhoria", equipamentoId: sheet.equipamentoId })}
          onAbrirMelhoria={(melhoriaId) => setSheet({ tipo: "melhoria", melhoriaId })}
        />
      )}
      {sheet?.tipo === "editarEquipamento" && (
        <SheetEquipamento
          equipamento={equipamentoAtual} ministerios={ministerios}
          onFechar={() => setSheet(null)}
          onGuardado={() => setSheet(null)}
        />
      )}
      {sheet?.tipo === "novaMelhoria" && (
        <SheetNovaMelhoria
          equipamento={equipamentoAtual} ministerios={ministerios}
          onFechar={() => setSheet(null)}
          onGuardado={() => setSheet(null)}
        />
      )}
      {sheet?.tipo === "melhoria" && (
        <SheetMelhoria
          melhoriaId={sheet.melhoriaId} uid={uid} papel={papel} voluntarios={voluntarios} equipamentos={equipamentos}
          onFechar={() => setSheet(null)}
          onGuardado={() => {}}
        />
      )}
    </>
  );
}
