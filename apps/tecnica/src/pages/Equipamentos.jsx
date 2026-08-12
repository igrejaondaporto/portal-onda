import { useEffect, useState } from "react";
import { ouvirEquipamentos } from "../lib/equipamentos";
import { ouvirMelhorias, corPrevisao, GRAVIDADE_INFO, ESTADO_INFO } from "../lib/melhorias";
import { ouvirVoluntarios, ouvirMinisterios } from "../lib/painel";
import { dataCurta } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import FotoRedonda from "@portal/shared/components/FotoRedonda.jsx";
import SheetEquipamento from "../components/painel/SheetEquipamento";
import SheetEquipamentoDetalhe from "../components/equipamentos/SheetEquipamentoDetalhe";
import SheetMelhoria from "../components/equipamentos/SheetMelhoria";
import SheetNovaMelhoria from "../components/equipamentos/SheetNovaMelhoria";

// mesma cor da .risca/.selo do cartão, pra pintar a miniatura quando
// a melhoria não tem foto — ver global.css
const COR_MINIATURA = { alta: "var(--magenta)", media: "var(--laranja)", baixa: "var(--ciano)" };
const RANK_GRAVIDADE = { impede_culto: 0, atrapalha: 1, melhoria: 2 };
const RANK_ESTADO = { aberta: 0, em_curso: 1, resolvida: 2 };
const OPCOES_ORDEM = [["gravidade", "Gravidade"], ["data", "Data"], ["previsao", "Previsão"], ["status", "Status"]];

// "2026-08-16" (data) ou um Timestamp do Firestore (abertaEm) → "16 ago"
function curta(valor) {
  if (!valor) return "—";
  const iso = typeof valor === "string" ? valor : valor.toDate?.().toISOString().slice(0, 10);
  return iso ? dataCurta(iso) : "—";
}

function ordenarMelhorias(lista, ordem) {
  return [...lista].sort((a, b) => {
    const resA = a.estado === "resolvida" ? 1 : 0, resB = b.estado === "resolvida" ? 1 : 0;
    if (resA !== resB) return resA - resB;
    if (ordem === "previsao") {
      if (!a.previsao && !b.previsao) return 0;
      if (!a.previsao) return 1;
      if (!b.previsao) return -1;
      return a.previsao < b.previsao ? -1 : a.previsao > b.previsao ? 1 : 0;
    }
    if (ordem === "data") {
      return (b.abertaEm?.toMillis?.() ?? 0) - (a.abertaEm?.toMillis?.() ?? 0);
    }
    if (ordem === "status") {
      return (RANK_ESTADO[a.estado] ?? 9) - (RANK_ESTADO[b.estado] ?? 9);
    }
    return (RANK_GRAVIDADE[a.gravidade] ?? 9) - (RANK_GRAVIDADE[b.gravidade] ?? 9);
  });
}

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
  const [ordem, setOrdem] = useState("gravidade");

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

          {comProblema > 0 && (() => {
            const avariados = equipamentos.filter((e) => e.estado !== "ok");
            const aberto = !!verTudo.avariados;
            const visiveis = aberto ? avariados : avariados.slice(0, 3);
            return (
              <div>
                <p className="cap" style={{ padding: "18px 0 4px" }}>
                  <span style={{ background: "var(--magenta)", color: "#fff", padding: "3px 9px", borderRadius: 100 }}>Avariados</span> · {comProblema}
                </p>
                {visiveis.map((e) => (
                  <div className="linha" style={{ cursor: "pointer" }} key={e.id} onClick={() => setSheet({ tipo: "detalheEquipamento", equipamentoId: e.id })}>
                    <div style={{ flex: 1 }}>
                      <p className="nmt">
                        {e.ministerioId && <span className="quadmin" style={{ background: ministerios.find((m) => m.id === e.ministerioId)?.cor }} />}
                        {e.nome}
                      </p>
                      <p className="ds">{e.ministerioId ? nomeMinisterio(e.ministerioId) : "Geral"}</p>
                    </div>
                    <span className={`tag ${e.estado === "em_reparacao" ? "lim" : ""}`}>{e.estado === "em_reparacao" ? "Em reparação" : "Avariado"}</span>
                    <span className="seta">›</span>
                  </div>
                ))}
                {avariados.length > 3 && (
                  <button className="btn sec full" style={{ marginTop: 6 }} onClick={() => setVerTudo((v) => ({ ...v, avariados: !v.avariados }))}>
                    {aberto ? "Ver menos" : `Ver mais (${avariados.length - 3})`}
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="sect">
          <button className="btn sec full" style={{ marginBottom: 12 }} onClick={() => setSheet({ tipo: "novaMelhoria" })}>
            Nova melhoria
          </button>
          {melhorias.length === 0 && <div className="vaz">Nada reportado ainda.</div>}
          {melhorias.length > 0 && (
            <>
              <div className="ordselect" style={{ marginBottom: 10 }}>
                Ordenar por
                <select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
                  {OPCOES_ORDEM.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select>
              </div>
              {ordenarMelhorias(melhorias, ordem).map((m) => {
                const gravInfo = GRAVIDADE_INFO[m.gravidade];
                const estInfo = ESTADO_INFO[m.estado];
                const { atrasada, texto: previsaoTexto } = corPrevisao(m);
                const equipamentoLigado = m.equipamentoId ? equipamentos.find((e) => e.id === m.equipamentoId) : null;
                return (
                  <div className="cartaomelh" key={m.id} onClick={() => setSheet({ tipo: "melhoria", melhoriaId: m.id })}>
                    <span className={`risca ${gravInfo?.cor}`} />
                    {m.foto ? (
                      <FotoRedonda src={m.foto} alt={m.titulo} tamanho={34} />
                    ) : (
                      <span className="miniatura" style={{ background: COR_MINIATURA[gravInfo?.cor] }}>
                        {(equipamentoLigado ? equipamentoLigado.nome : m.titulo).charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="cartaomelh-corpo">
                      <div className="cartaomelh-linha1">
                        <span className="cartaomelh-titulo">{equipamentoLigado ? equipamentoLigado.nome : m.titulo}</span>
                        <button
                          className="cartaomelh-lapis"
                          onClick={(e) => { e.stopPropagation(); setSheet({ tipo: "melhoria", melhoriaId: m.id, editar: true }); }}
                        >
                          ✎
                        </button>
                      </div>
                      <div className="cartaomelh-linha2">
                        {gravInfo && <span className={`selo ${gravInfo.cor}`}>{gravInfo.texto}</span>}
                        {estInfo && <span className={`selo ${estInfo.cor}`}>{estInfo.texto}</span>}
                        <span className={`cartaomelh-previsao ${atrasada ? "atrasada" : ""}`}>
                          {m.estado === "resolvida" ? curta(m.abertaEm) : previsaoTexto}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
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
