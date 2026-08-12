import { useEffect, useState } from "react";
import { ouvirEquipamentos } from "../lib/equipamentos";
import { ouvirMelhorias, corMelhoria } from "../lib/melhorias";
import { ouvirVoluntarios, ouvirMinisterios } from "../lib/painel";
import { dataCurta } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import FotoRedonda from "@portal/shared/components/FotoRedonda.jsx";
import SheetEquipamento from "../components/painel/SheetEquipamento";
import SheetEquipamentoDetalhe from "../components/equipamentos/SheetEquipamentoDetalhe";
import SheetMelhoria from "../components/equipamentos/SheetMelhoria";
import SheetNovaMelhoria from "../components/equipamentos/SheetNovaMelhoria";

const ESTADO_CURTO = { aberta: "Aberta", em_curso: "Em curso", resolvida: "Resolvida" };

// "2026-08-16" (data) ou um Timestamp do Firestore (abertaEm) → "16 ago"
function curta(valor) {
  if (!valor) return "—";
  const iso = typeof valor === "string" ? valor : valor.toDate?.().toISOString().slice(0, 10);
  return iso ? dataCurta(iso) : "—";
}

// as mesmas cores do .tag (ver global.css), pra pintar a miniatura
// quando a melhoria não tem foto
const COR_FUNDO = { verd: "var(--verde)", lim: "var(--lima)", cinz: "var(--agua)", "": "var(--magenta)" };

export default function Equipamentos({ uid, papel, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const [aba, setAba] = useState("equipamentos");
  const [equipamentos, setEquipamentos] = useState([]);
  const [melhorias, setMelhorias] = useState([]);
  const [ministerios, setMinisterios] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [verTudo, setVerTudo] = useState({});

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

          {comProblema > 0 && (() => {
            const avariados = equipamentos.filter((e) => e.estado !== "ok");
            const aberto = !!verTudo.avariados;
            const visiveis = aberto ? avariados : avariados.slice(0, 3);
            return (
              <div style={{ background: "var(--magenta)", borderRadius: 12, padding: "10px 12px", marginBottom: 16 }}>
                <p className="cap" style={{ padding: "0 0 6px", color: "#fff" }}>⚠ Avariados · {comProblema}</p>
                {visiveis.map((e) => (
                  <div className="linha" style={{ cursor: "pointer" }} key={e.id} onClick={() => setSheet({ tipo: "detalheEquipamento", equipamentoId: e.id })}>
                    <div style={{ flex: 1 }}>
                      <p className="nmt" style={{ color: "#fff" }}>
                        {e.ministerioId && <span className="quadmin" style={{ background: ministerios.find((m) => m.id === e.ministerioId)?.cor }} />}
                        {e.nome}
                      </p>
                      <p className="ds" style={{ color: "rgba(255,255,255,.8)" }}>{e.ministerioId ? nomeMinisterio(e.ministerioId) : "Geral"}</p>
                    </div>
                    <span className="tag" style={{ background: "#fff", color: "var(--magenta)" }}>{e.estado === "em_reparacao" ? "Em reparação" : "Avariado"}</span>
                    <span className="seta" style={{ color: "#fff" }}>›</span>
                  </div>
                ))}
                {avariados.length > 3 && (
                  <button
                    className="btn sec full" style={{ marginTop: 8, background: "#fff", color: "var(--magenta)", border: "none" }}
                    onClick={() => setVerTudo((v) => ({ ...v, avariados: !v.avariados }))}
                  >
                    {aberto ? "Ver menos" : `Ver mais (${avariados.length - 3})`}
                  </button>
                )}
              </div>
            );
          })()}

          {(ministerios.length ? [...ministerios, { id: null, nome: "Geral" }] : [{ id: null, nome: "Geral" }]).map((m) => {
            const doM = equipamentos.filter((e) => e.ministerioId === m.id && e.estado === "ok");
            if (!doM.length) return null;
            const chave = m.id ?? "geral";
            const aberto = !!verTudo[chave];
            const visiveis = aberto ? doM : doM.slice(0, 3);
            return (
              <div key={chave}>
                <p className="cap" style={{ padding: "10px 0 4px", color: m.cor }}>{m.nome} · {doM.length}</p>
                {visiveis.map((e) => (
                  <div className="linha" style={{ cursor: "pointer" }} key={e.id} onClick={() => setSheet({ tipo: "detalheEquipamento", equipamentoId: e.id })}>
                    <div style={{ flex: 1 }}>
                      <p className="nmt">{e.nome}</p>
                      <p className="ds">{[e.modelo, e.local].filter(Boolean).join(" · ") || "Sem detalhes"}</p>
                    </div>
                    <span className="seta">›</span>
                  </div>
                ))}
                {doM.length > 3 && (
                  <button className="btn sec full" style={{ marginTop: 6 }} onClick={() => setVerTudo((v) => ({ ...v, [chave]: !v[chave] }))}>
                    {aberto ? "Ver menos" : `Ver mais (${doM.length - 3})`}
                  </button>
                )}
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
          {melhorias.length > 0 && (
            <div className="tabwrap" style={{ marginTop: 0 }}>
              <table className="tabcompacta">
                <thead>
                  <tr>
                    <th></th>
                    <th>Melhoria</th>
                    <th>Data</th>
                    <th>Status</th>
                    <th>Previsão</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {[...melhorias].sort((a, b) => (a.estado === "resolvida") - (b.estado === "resolvida")).map((m) => {
                    const { cor } = corMelhoria(m);
                    const equipamentoLigado = m.equipamentoId ? equipamentos.find((e) => e.id === m.equipamentoId) : null;
                    return (
                      <tr key={m.id} style={{ cursor: "pointer" }} onClick={() => setSheet({ tipo: "melhoria", melhoriaId: m.id })}>
                        <td onClick={(e) => m.foto && e.stopPropagation()}>
                          {m.foto
                            ? <FotoRedonda src={m.foto} alt={m.titulo} tamanho={24} />
                            : <span className="miniatura semfoto" style={{ background: COR_FUNDO[cor] }} />}
                        </td>
                        <td className="trunc">{equipamentoLigado ? equipamentoLigado.nome : m.titulo}</td>
                        <td>{curta(m.abertaEm)}</td>
                        <td><span className={`tag ${cor}`} style={{ padding: "3px 7px", fontSize: 9.5 }}>{ESTADO_CURTO[m.estado]}</span></td>
                        <td>{curta(m.previsao)}</td>
                        <td>
                          <button
                            className="btn sec" style={{ padding: "4px 7px", fontSize: 11 }}
                            onClick={(e) => { e.stopPropagation(); setSheet({ tipo: "melhoria", melhoriaId: m.id, editar: true }); }}
                          >
                            ✎
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {sheet?.tipo === "novoEquipamento" && (
        <SheetEquipamento
          equipamento={null} ministerios={ministerios}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
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
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "novaMelhoria" && (
        <SheetNovaMelhoria
          equipamento={equipamentoAtual} ministerios={ministerios}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "melhoria" && (
        <SheetMelhoria
          melhoriaId={sheet.melhoriaId} uid={uid} papel={papel} voluntarios={voluntarios} equipamentos={equipamentos}
          editarInicial={sheet.editar}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}
