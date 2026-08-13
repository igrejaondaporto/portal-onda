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
  const [expandida, setExpandida] = useState({});
  const [soAtrasadas, setSoAtrasadas] = useState(false);
  const [verResolvidas, setVerResolvidas] = useState(false);

  useEffect(() => ouvirEquipamentos(setEquipamentos), []);
  useEffect(() => ouvirMelhorias(setMelhorias), []);
  useEffect(() => ouvirMinisterios(setMinisterios), []);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);

  const comProblema = equipamentos.filter((e) => e.estado !== "ok").length;
  const melhoriasAtivas = melhorias.filter((m) => m.estado !== "resolvida");
  const melhoriasResolvidas = melhorias.filter((m) => m.estado === "resolvida");
  const abertas = melhoriasAtivas.length;
  const atrasadas = melhoriasAtivas.filter((m) => corPrevisao(m).atrasada).length;

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

  function cartaoMelhoria(m) {
    const gravInfo = GRAVIDADE_INFO[m.gravidade];
    const estInfo = ESTADO_INFO[m.estado];
    const { atrasada, texto: previsaoTexto } = corPrevisao(m);
    const equipamentoLigado = m.equipamentoId ? equipamentos.find((e) => e.id === m.equipamentoId) : null;
    const aberta = !!expandida[m.id];
    return (
      <div className="cartaomelh" key={m.id} onClick={() => setExpandida((v) => ({ ...v, [m.id]: !v[m.id] }))}>
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
              className="lapis"
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
          {aberta && (
            <div className="cartaomelh-desc">
              {m.descricao || "Sem descrição."}
              <br />
              <span className="abrir" onClick={(e) => { e.stopPropagation(); setSheet({ tipo: "melhoria", melhoriaId: m.id, editar: true }); }}>
                Comentários e histórico ›
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

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
            const cor = m.cor || "var(--cinza)";
            return (
              <div className="mincartao" key={chave}>
                <div className="mincartao-barra" style={{ background: cor }} />
                <div className="mincartao-cab">
                  <span className="ponto" style={{ background: cor }} />
                  <span className="nome">{m.nome}</span>
                  <span className="conta">{doM.length} {doM.length === 1 ? "item" : "itens"}</span>
                </div>
                {visiveis.map((e) => (
                  <div className="linha" style={{ cursor: "pointer" }} key={e.id} onClick={() => setSheet({ tipo: "detalheEquipamento", equipamentoId: e.id })}>
                    <div style={{ flex: 1 }}>
                      <p className="nmt">{e.nome}</p>
                      <p className="ds">{[e.modelo, e.local].filter(Boolean).join(" · ") || "Sem detalhes"}</p>
                    </div>
                    {souLiderBase && (
                      <button className="lapis" onClick={(ev) => { ev.stopPropagation(); setSheet({ tipo: "editarEquipamento", equipamentoId: e.id }); }}>✎</button>
                    )}
                    <span className="seta">›</span>
                  </div>
                ))}
                {doM.length > 3 && (
                  <button className="btn sec full verMais" onClick={() => setVerTudo((v) => ({ ...v, [chave]: !v[chave] }))}>
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
                {visiveis.map((e) => {
                  const melhoriaLigada = melhorias.find((m) => m.equipamentoId === e.id && m.estado !== "resolvida");
                  return (
                    <div className="linha" style={{ cursor: "pointer" }} key={e.id} onClick={() => setSheet({ tipo: "detalheEquipamento", equipamentoId: e.id })}>
                      <div style={{ flex: 1 }}>
                        <p className="nmt">
                          {e.ministerioId && <span className="quadmin" style={{ background: ministerios.find((m) => m.id === e.ministerioId)?.cor }} />}
                          {e.nome}
                        </p>
                        <p className="ds">{e.ministerioId ? nomeMinisterio(e.ministerioId) : "Geral"}</p>
                      </div>
                      <span className={`tag ${e.estado === "em_reparacao" ? "lim" : ""}`}>{e.estado === "em_reparacao" ? "Em reparação" : "Avariado"}</span>
                      {melhoriaLigada && (
                        <button
                          className="btn sec"
                          style={{ padding: "8px 12px", fontSize: 12 }}
                          onClick={(ev) => { ev.stopPropagation(); setSheet({ tipo: "melhoria", melhoriaId: melhoriaLigada.id, editar: true, resolver: true }); }}
                        >
                          Marcar resolvida
                        </button>
                      )}
                      <span className="seta">›</span>
                    </div>
                  );
                })}
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
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <div className="ordselect" style={{ flex: 1 }}>
                  Ordenar por
                  <select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
                    {OPCOES_ORDEM.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                  </select>
                </div>
                <button
                  className="tag" data-on={soAtrasadas ? 1 : 0}
                  style={{
                    cursor: "pointer", border: 0,
                    ...(soAtrasadas ? { background: "var(--magenta)", color: "#fff" } : { background: "var(--fio)", color: "var(--cinza)" }),
                  }}
                  onClick={() => setSoAtrasadas((v) => !v)}
                >
                  Atrasadas{atrasadas > 0 ? ` (${atrasadas})` : ""}
                </button>
              </div>

              {(soAtrasadas ? melhoriasAtivas.filter((m) => corPrevisao(m).atrasada) : melhoriasAtivas).length === 0 && (
                <div className="vaz">{soAtrasadas ? "Nenhuma melhoria atrasada." : "Nada em aberto."}</div>
              )}
              {ordenarMelhorias(soAtrasadas ? melhoriasAtivas.filter((m) => corPrevisao(m).atrasada) : melhoriasAtivas, ordem)
                .map((m) => cartaoMelhoria(m))}

              {melhoriasResolvidas.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <button
                    className="btn sec full" onClick={() => setVerResolvidas((v) => !v)}
                  >
                    {verResolvidas ? "Ocultar resolvidas" : `Ver resolvidas (${melhoriasResolvidas.length})`}
                  </button>
                  {verResolvidas && (
                    <div style={{ marginTop: 10 }}>
                      {ordenarMelhorias(melhoriasResolvidas, "data").map((m) => cartaoMelhoria(m))}
                    </div>
                  )}
                </div>
              )}
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
          onReportarAvaria={() => setSheet({ tipo: "novaMelhoria", equipamentoId: sheet.equipamentoId })}
          onAbrirMelhoria={(melhoriaId) => setSheet({ tipo: "melhoria", melhoriaId, editar: true })}
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
          editarInicial={sheet.editar} resolverInicial={sheet.resolver}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}
