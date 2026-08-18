import { useEffect, useState } from "react";
import { ouvirMelhorias, corPrevisao, GRAVIDADE_INFO, ESTADO_INFO, GRAVIDADES } from "../../lib/melhorias";
import { ouvirVoluntarios } from "../../lib/painel";
import { dataCurta } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import FotoRedonda from "@portal/shared/components/FotoRedonda.jsx";
import SheetNovaMelhoria from "./SheetNovaMelhoria";
import SheetMelhoria from "./SheetMelhoria";

const COR_MINIATURA = { alta: "var(--magenta)", media: "var(--laranja)", baixa: "var(--ciano)" };

const curta = (ts) => (ts?.toDate ? dataCurta(ts.toDate().toISOString().slice(0, 10)) : "—");

function CartaoMelhoria({ m, onAbrir }) {
  const gravInfo = GRAVIDADE_INFO[m.gravidade];
  const estInfo = ESTADO_INFO[m.estado];
  const { atrasada, texto: previsaoTexto } = corPrevisao(m);
  return (
    <div className="cartaomelh" onClick={onAbrir}>
      <span className={`risca ${gravInfo?.cor}`} />
      {m.foto ? (
        <FotoRedonda src={m.foto} alt={m.titulo} tamanho={34} />
      ) : (
        <span className="miniatura" style={{ background: COR_MINIATURA[gravInfo?.cor] }}>
          {m.titulo.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="cartaomelh-corpo">
        <div className="cartaomelh-linha1">
          <span className="cartaomelh-titulo">{m.titulo}</span>
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
}

/** Melhorias — igual em espírito ao ecrã da Técnica, sem equipamento
 *  nem ministério (a Backstage não tem nenhum dos dois): qualquer
 *  voluntário reporta algo a melhorar, comenta e resolve; o líder
 *  reabre. Ativas por cima com filtro de gravidade, resolvidas num
 *  grupo à parte, fechado, no fim (ver CLAUDE.md desta app). */
export default function MelhoriasTab({ uid, papel }) {
  const torrada = useTorrada();
  const [melhorias, setMelhorias] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [filtroGravidade, setFiltroGravidade] = useState(null); // null = todas
  const [resolvidasAbertas, setResolvidasAbertas] = useState(false);
  const [sheet, setSheet] = useState(null);

  useEffect(() => ouvirMelhorias(setMelhorias), []);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);

  const ativas = melhorias
    .filter((m) => m.estado !== "resolvida")
    .filter((m) => !filtroGravidade || m.gravidade === filtroGravidade)
    .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === "aberta" ? -1 : 1));
  const resolvidas = melhorias
    .filter((m) => m.estado === "resolvida")
    .sort((a, b) => (b.abertaEm?.toMillis?.() ?? 0) - (a.abertaEm?.toMillis?.() ?? 0));

  return (
    <>
      <button className="btn full" style={{ marginTop: 16 }} onClick={() => setSheet({ tipo: "nova" })}>
        Reportar melhoria
      </button>

      <div className="subtabs" style={{ marginTop: 12 }}>
        <button data-on={!filtroGravidade ? 1 : 0} onClick={() => setFiltroGravidade(null)}>Todas</button>
        {GRAVIDADES.map(([k, t]) => (
          <button key={k} data-on={filtroGravidade === k ? 1 : 0} onClick={() => setFiltroGravidade(k)}>{t}</button>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        {ativas.length === 0 ? (
          <div className="vaz">Nada em aberto.</div>
        ) : (
          ativas.map((m) => (
            <CartaoMelhoria key={m.id} m={m} onAbrir={() => setSheet({ tipo: "melhoria", melhoriaId: m.id })} />
          ))
        )}
      </div>

      {resolvidas.length > 0 && (
        <div className="mincartao" style={{ marginTop: 16 }}>
          <div className="mincartao-barra" style={{ background: "var(--verde)" }} />
          <button
            className="mincartao-cab cabtoque" data-aberto={resolvidasAbertas ? 1 : 0}
            aria-expanded={resolvidasAbertas} onClick={() => setResolvidasAbertas((v) => !v)}
          >
            <span className="ponto" style={{ background: "var(--verde)" }} />
            <span className="nome">Já resolvidas</span>
            <span className="conta">{resolvidas.length}</span>
            <span className="cabtoque-seta" aria-hidden="true">›</span>
          </button>
          {resolvidasAbertas && (
            <div style={{ padding: "4px 12px 8px" }}>
              {resolvidas.map((m) => (
                <CartaoMelhoria key={m.id} m={m} onAbrir={() => setSheet({ tipo: "melhoria", melhoriaId: m.id })} />
              ))}
            </div>
          )}
        </div>
      )}

      {sheet?.tipo === "nova" && (
        <SheetNovaMelhoria
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "melhoria" && (
        <SheetMelhoria
          melhoriaId={sheet.melhoriaId} uid={uid} papel={papel} voluntarios={voluntarios} editarInicial
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}
