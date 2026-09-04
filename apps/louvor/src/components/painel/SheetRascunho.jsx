import { useEffect, useState } from "react";
import { obterEventosDoMes } from "../../lib/painel";
import { guardarRascunho, publicarRascunho, obterDetalhesCultos } from "../../lib/rascunho";
import { definirDetalhesCultoLouvor } from "../../lib/culto";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { MESES, nomeEvento, dataPorExtenso } from "@portal/shared/lib/data.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import CalendarioSemanal from "../CalendarioSemanal";
import SheetEscala from "./SheetEscala";
import SheetNovoCulto from "./SheetNovoCulto";

/** Um domingo (ou culto especial) dentro do rascunho — cartão próprio
 *  em vez de uma linha só, porque agora carrega três ações (escalar,
 *  ensaio, remover) e as miniaturas de quem já está posto. */
function CartaoDomingo({ item, evento, ensaio, pessoaPorId, ensaioAberto, onEscalar, onRemover, onToggleEnsaio, onDefinirEnsaio }) {
  const pessoas = item.escalados.map((e) => pessoaPorId(e.pessoaId)).filter(Boolean);
  return (
    <div className="caixa" style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={onEscalar}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="nmt">{evento ? nomeEvento(evento) : dataPorExtenso(item.eventoId)}</p>
          <p className="ds">
            {item.escalados.length ? `${item.escalados.length} pessoa${item.escalados.length === 1 ? "" : "s"}` : "Ninguém escalado"}
            {item.liderEscala ? " · líder definido" : ""}
          </p>
        </div>
        {pessoas.length > 0 && (
          <div style={{ display: "flex", marginLeft: -4 }}>
            {pessoas.slice(0, 4).map((p) => (
              <div key={p.id} style={{ marginLeft: -6, border: "2px solid #fff", borderRadius: "50%" }}>
                <Avatar pessoa={p} tamanho={26} fonte={11} />
              </div>
            ))}
          </div>
        )}
        <button className="btn sec" style={{ padding: "6px 10px", fontSize: 12 }} onClick={(e) => { e.stopPropagation(); onRemover(); }}>
          Remover
        </button>
        <span className="seta">›</span>
      </div>
      <button className="btn sec full" style={{ marginTop: 10, fontSize: 12.5, padding: "9px" }} onClick={onToggleEnsaio}>
        🎙️ {ensaio ? `Ensaio: ${dataPorExtenso(ensaio)}` : "Adicionar ensaio"}
      </button>
      {ensaioAberto && (
        <CalendarioSemanal domingoISO={item.eventoId} ensaioISO={ensaio} onSelecionar={onDefinirEnsaio} />
      )}
    </div>
  );
}

/**
 * Editor de um rascunho — reaproveita a interação de SheetEscala.jsx
 * (tocar para escalar, estrela para líder de escala) através do prop
 * `aoMudar`: em vez de gravar direto na escala ao vivo, guarda no
 * estado local `itens`, só persistido a valer ao tocar "Guardar
 * rascunho". Publicar corre a validação completa (conflito entre
 * bases incluído) no servidor, um domingo de cada vez, e marca a
 * escala ao vivo de todos como publicada de uma só vez — nunca
 * parcial (decisão do líder, ver CLAUDE.md).
 *
 * Um rascunho NOVO já entra com todos os domingos do mês corrente —
 * pedido do líder, "não preciso perguntar se quero adicionar". O
 * ensaio de cada culto é escrita direta na escala ao vivo
 * (definirDetalhesCultoLouvor) mesmo a meio do rascunho — não é
 * "quem serve", pode ficar visível cedo (ver lib/rascunho.js).
 */
export default function SheetRascunho({ rascunho, voluntarios, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const hoje = new Date();
  const anoAtual = hoje.getFullYear(), mesAtual = hoje.getMonth();

  const [nome, setNome] = useState(rascunho?.nome || "");
  const [itens, setItens] = useState(() => (rascunho?.itens ? [...rascunho.itens] : []));
  const [eventosPorId, setEventosPorId] = useState({});
  const [ensaios, setEnsaios] = useState({}); // eventoId -> "AAAA-MM-DD" | null
  const [ensaioAberto, setEnsaioAberto] = useState(null); // eventoId | null
  const [mesSeguinteIncluido, setMesSeguinteIncluido] = useState(false);
  const [aIncluirMesSeguinte, setAIncluirMesSeguinte] = useState(false);

  const [outroMesAberto, setOutroMesAberto] = useState(false);
  const [anoNav, setAnoNav] = useState(anoAtual);
  const [mesNav, setMesNav] = useState(mesAtual + 2 > 11 ? mesAtual - 10 : mesAtual + 2);
  const [eventosMesNav, setEventosMesNav] = useState([]);
  const [aCarregarMesNav, setACarregarMesNav] = useState(false);

  const [eventoAEscalar, setEventoAEscalar] = useState(null);
  const [sheetNovoCulto, setSheetNovoCulto] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [aPublicar, setAPublicar] = useState(false);
  const [aConfirmarPublicar, setAConfirmarPublicar] = useState(false);

  const registarEventos = (evs) => {
    setEventosPorId((s) => ({ ...s, ...Object.fromEntries(evs.map((ev) => [ev.id, ev])) }));
    setEnsaios((s) => ({ ...s, ...Object.fromEntries(evs.map((ev) => [ev.id, ev.escala?.dataEnsaio || null])) }));
  };

  // Rascunho novo: entra logo com todos os domingos do mês corrente.
  useEffect(() => {
    if (rascunho) return;
    obterEventosDoMes(anoAtual, mesAtual).then((evs) => {
      const domingos = evs.filter((ev) => !ev.tipo);
      setItens(domingos.map((ev) => ({ eventoId: ev.id, liderEscala: null, escalados: [] })));
      registarEventos(domingos);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rascunho já existente: busca nome/data/ensaio de cada item já lá dentro.
  useEffect(() => {
    if (!rascunho) return;
    const ids = (rascunho.itens || []).map((it) => it.eventoId);
    if (!ids.length) return;
    obterDetalhesCultos(ids).then((mapa) => registarEventos(Object.values(mapa)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!outroMesAberto) return;
    setACarregarMesNav(true);
    obterEventosDoMes(anoNav, mesNav).then((evs) => { setEventosMesNav(evs); setACarregarMesNav(false); });
  }, [outroMesAberto, anoNav, mesNav]);

  function mudarMesNav(delta) {
    setMesNav((atual) => {
      let novo = atual + delta;
      if (novo < 0) { novo = 11; setAnoNav((a) => a - 1); }
      else if (novo > 11) { novo = 0; setAnoNav((a) => a + 1); }
      return novo;
    });
  }

  async function incluirMesSeguinte() {
    setAIncluirMesSeguinte(true);
    try {
      const d = new Date(anoAtual, mesAtual + 1, 1);
      const evs = await obterEventosDoMes(d.getFullYear(), d.getMonth());
      const jaTem = new Set(itens.map((it) => it.eventoId));
      const novos = evs.filter((ev) => !ev.tipo && !jaTem.has(ev.id));
      setItens((atual) => [...atual, ...novos.map((ev) => ({ eventoId: ev.id, liderEscala: null, escalados: [] }))]);
      registarEventos(novos);
      setMesSeguinteIncluido(true);
    } finally {
      setAIncluirMesSeguinte(false);
    }
  }

  function alternarNoRascunho(ev) {
    registarEventos([ev]);
    setItens((atual) =>
      atual.some((it) => it.eventoId === ev.id)
        ? atual.filter((it) => it.eventoId !== ev.id)
        : [...atual, { eventoId: ev.id, liderEscala: null, escalados: [] }]
    );
  }

  function removerDoRascunho(id) {
    setItens((atual) => atual.filter((it) => it.eventoId !== id));
  }

  function aoMudarEscala(eventoId, escalados, liderEscala) {
    setItens((atual) => atual.map((it) => (it.eventoId === eventoId ? { ...it, escalados, liderEscala } : it)));
  }

  async function definirEnsaio(eventoId, iso) {
    const novaData = ensaios[eventoId] === iso ? null : iso;
    setEnsaios((s) => ({ ...s, [eventoId]: novaData }));
    try {
      await definirDetalhesCultoLouvor(eventoId, { dataEnsaio: novaData });
    } catch (e) {
      torrada(e.message || "Não foi possível guardar o ensaio.");
      setEnsaios((s) => ({ ...s, [eventoId]: ensaios[eventoId] ?? null }));
    }
  }

  async function guardar(fechar = true) {
    if (!itens.length) { torrada("Escolhe pelo menos um domingo."); return null; }
    setAGuardar(true);
    try {
      const r = await guardarRascunho({ rascunhoId: rascunho?.id, nome, itens });
      if (fechar) onGuardado("Rascunho guardado");
      return r.rascunhoId;
    } catch (e) {
      torrada(e.message || "Não foi possível guardar o rascunho.");
      return null;
    } finally {
      setAGuardar(false);
    }
  }

  async function publicar() {
    setAPublicar(true);
    try {
      const id = rascunho?.id || (await guardar(false));
      if (!id) return;
      const r = await publicarRascunho(id);
      onGuardado(`Escala publicada — ${r.domingos} domingo${r.domingos === 1 ? "" : "s"}`);
    } catch (e) {
      torrada(e.message || "Não foi possível publicar.");
    } finally {
      setAPublicar(false);
    }
  }

  const ordenados = [...itens].sort((a, b) => a.eventoId.localeCompare(b.eventoId));
  const itemAEscalar = eventoAEscalar ? itens.find((it) => it.eventoId === eventoAEscalar) : null;

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{rascunho ? "Editar rascunho" : "Novo rascunho"}</h2>
        <p className="sb2">Monta a escala de vários domingos antes de publicar — os voluntários só veem depois de "Publicar".</p>

        <label className="rot">Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Escala de Outubro" />

        <label className="rot" style={{ marginTop: 14 }}>Domingos no rascunho ({ordenados.length})</label>
        {!ordenados.length && <div className="vaz">Nenhum ainda.</div>}
        {ordenados.map((it) => (
          <CartaoDomingo
            key={it.eventoId} item={it} evento={eventosPorId[it.eventoId]} ensaio={ensaios[it.eventoId]}
            pessoaPorId={(id) => voluntarios.find((p) => p.id === id)}
            ensaioAberto={ensaioAberto === it.eventoId}
            onEscalar={() => setEventoAEscalar(it.eventoId)}
            onRemover={() => removerDoRascunho(it.eventoId)}
            onToggleEnsaio={() => setEnsaioAberto((a) => (a === it.eventoId ? null : it.eventoId))}
            onDefinirEnsaio={(iso) => definirEnsaio(it.eventoId, iso)}
          />
        ))}

        {!rascunho && !mesSeguinteIncluido && (
          <button className="btn sec full" style={{ marginTop: 10 }} disabled={aIncluirMesSeguinte} onClick={incluirMesSeguinte}>
            {aIncluirMesSeguinte ? "A incluir…" : `» Incluir ${MESES[(mesAtual + 1) % 12].toLowerCase()} também`}
          </button>
        )}
        <button className="btn sec full" style={{ marginTop: 8 }} onClick={() => setSheetNovoCulto(true)}>
          + Adicionar evento especial
        </button>

        <button className="btn sec full" style={{ marginTop: 8 }} onClick={() => setOutroMesAberto((v) => !v)}>
          {outroMesAberto ? "Ocultar" : "+ Adicionar domingos de outro mês"}
        </button>
        {outroMesAberto && (
          <div className="caixa" style={{ marginTop: 8 }}>
            <div className="cabecalho" style={{ paddingTop: 0 }}>
              <h3>{MESES[mesNav]} {anoNav}</h3>
              <span className="calnav">
                <button className="calbt" onClick={() => mudarMesNav(-1)}>‹</button>
                <button className="calbt" onClick={() => mudarMesNav(1)}>›</button>
              </span>
            </div>
            {aCarregarMesNav && <div className="vaz">A carregar…</div>}
            {!aCarregarMesNav && !eventosMesNav.length && <div className="vaz">Sem cultos criados para este mês ainda.</div>}
            {!aCarregarMesNav && eventosMesNav.map((ev) => (
              <div className="linha" style={{ cursor: "pointer" }} key={ev.id} onClick={() => alternarNoRascunho(ev)}>
                <button className={`chk${itens.some((it) => it.eventoId === ev.id) ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); alternarNoRascunho(ev); }}>✓</button>
                <div style={{ flex: 1 }}><p className="nmt">{nomeEvento(ev)}</p></div>
              </div>
            ))}
          </div>
        )}

        <button className="btn full" style={{ marginTop: 18 }} disabled={aGuardar || aPublicar} onClick={() => guardar(true)}>
          {aGuardar ? "A guardar…" : "Guardar rascunho"}
        </button>

        {!aConfirmarPublicar ? (
          <button className="btn sec full" style={{ marginTop: 9 }} disabled={aGuardar || aPublicar || !ordenados.length} onClick={() => setAConfirmarPublicar(true)}>
            Publicar
          </button>
        ) : (
          <div className="caixa" style={{ background: "#EFF3FF", border: 0, marginTop: 9 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>Publicar {ordenados.length} domingo{ordenados.length === 1 ? "" : "s"}?</p>
            <p className="ds" style={{ marginTop: 4 }}>
              Todos de uma vez — a escala fica visível para os voluntários em cada um desses domingos.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn" style={{ flex: 1, fontSize: 12.5 }} disabled={aPublicar} onClick={publicar}>
                {aPublicar ? "A publicar…" : "Publicar tudo"}
              </button>
              <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aPublicar} onClick={() => setAConfirmarPublicar(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>

      {itemAEscalar && (
        <SheetEscala
          evento={{
            id: eventoAEscalar,
            ...eventosPorId[eventoAEscalar],
            escopo: undefined,
            escala: { escalados: itemAEscalar.escalados || [], liderEscala: itemAEscalar.liderEscala || null },
          }}
          voluntarios={voluntarios}
          aoMudar={(escalados, liderEscala) => aoMudarEscala(eventoAEscalar, escalados, liderEscala)}
          onFechar={() => setEventoAEscalar(null)}
          onGuardado={() => setEventoAEscalar(null)}
        />
      )}

      {sheetNovoCulto && (
        <SheetNovoCulto
          ano={anoAtual} mes={mesAtual}
          onFechar={() => setSheetNovoCulto(false)}
          onGuardado={(msg, novoEvento) => {
            setSheetNovoCulto(false);
            torrada(msg);
            if (novoEvento) {
              setItens((atual) => [...atual, { eventoId: novoEvento.id, liderEscala: null, escalados: [] }]);
              registarEventos([{ ...novoEvento, escala: { pessoas: [], liderEscala: null, escalados: [] } }]);
            }
          }}
        />
      )}
    </>
  );
}
