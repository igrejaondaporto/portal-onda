import { useEffect, useMemo, useRef, useState } from "react";
import { ouvirEventosDoMes, ouvirVoluntarios } from "../lib/painel";
import { ouvirRepertorio, guardarRepertorio, itemMusica, itemMomento } from "../lib/repertorio";
import { ouvirMusicas } from "../lib/biblioteca";
import { MESES, dataCurta, dataPorExtenso, hojeISO } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import SheetEscolherMusica from "../components/repertorio/SheetEscolherMusica";

function haQuanto(ts) {
  if (!ts?.toDate) return "agora mesmo";
  const min = Math.round((Date.now() - ts.toDate().getTime()) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

export default function Repertorio({ uid, mes, ano, mudarMes, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const [eventosMes, setEventosMes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [musicas, setMusicas] = useState([]);
  const [eventoId, setEventoId] = useState(null);
  const [repertorio, setRepertorio] = useState(null);
  const [aEscolherMusica, setAEscolherMusica] = useState(null); // null | "musica" | "medley"
  const [aNomearMomento, setANomearMomento] = useState(false);
  const [nomeMomento, setNomeMomento] = useState("");
  const [medleyExpandidoId, setMedleyExpandidoId] = useState(null);

  // Cópia local dos itens — o arrasto reordena isto ao vivo, sem
  // gravar a cada troca; só persiste quando o dedo solta. Sincroniza
  // com o Firestore sempre que não está a meio de um arrasto (senão
  // o próprio eco do snapshot da nossa escrita interrompia o gesto).
  const [itensLocais, setItensLocais] = useState([]);
  const [arrastoId, setArrastoId] = useState(null);
  const [arrastoOffsetY, setArrastoOffsetY] = useState(0);
  const arrastoStartY = useRef(0);
  const refsLinhas = useRef({});

  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirMusicas(setMusicas), []);

  useEffect(() => {
    if (eventoId || !eventosMes.length) return;
    const hoje = hojeISO();
    setEventoId((eventosMes.find((e) => e.data >= hoje) ?? eventosMes.at(-1)).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventosMes]);

  useEffect(() => ouvirRepertorio(eventoId, setRepertorio), [eventoId]);

  const eventoAtual = eventosMes.find((e) => e.id === eventoId) ?? null;
  const itens = repertorio?.itens ?? [];

  useEffect(() => {
    if (!arrastoId) setItensLocais(itens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, eventoId]);

  const nMusicas = itensLocais.filter((i) => i.tipo === "musica").length;
  const autor = repertorio?.atualizadoPor ? voluntarios.find((p) => p.id === repertorio.atualizadoPor)?.nome : null;

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Repertório</em>,
      subtitulo: eventoAtual ? dataPorExtenso(eventoAtual.data) : `${MESES[mes]} ${ano}`,
      chips: [`${nMusicas} ${nMusicas === 1 ? "música" : "músicas"}`, repertorio ? `Atualizado ${haQuanto(repertorio.atualizadoEm)}` : "Ainda não montado"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, eventoAtual?.id, mes, ano, nMusicas, repertorio?.atualizadoEm]);

  // A Técnica lê o repertório (regras já permitem), mas não a
  // biblioteca de músicas — de propósito, decisão 8 do CLAUDE.md
  // desta base: a projeção só vê nome/artista/capa/links, nunca
  // tom/BPM/observações. Por isso guarda uma cópia desses campos no
  // próprio item, sempre que grava — cobre também repertórios de
  // antes desta função existir (a próxima vez que alguém tocar neles,
  // ficam corrigidos sozinhos).
  async function persistir(novosItens) {
    if (!eventoId) return;
    const enriquecidos = novosItens.map((item) => {
      if (item.tipo !== "musica") return item;
      const m = musicaPorId[item.musicaId];
      if (!m) return item; // música apagada da biblioteca — mantém o que já lá estava
      return { ...item, titulo: m.titulo, artista: m.artista, capaUrl: m.capaUrl || null, links: m.links || null };
    });
    setItensLocais(enriquecidos);
    try {
      await guardarRepertorio(eventoId, enriquecidos, uid);
    } catch (e) {
      torrada(e.message || "Não foi possível guardar o repertório.");
    }
  }

  function mover(id, delta) {
    const i = itensLocais.findIndex((it) => it.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= itensLocais.length) return;
    const nova = [...itensLocais];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    persistir(nova);
  }

  function remover(id) {
    persistir(itensLocais.filter((it) => it.id !== id));
  }

  function adicionarMusica(musicaId, versaoId, medley) {
    persistir([...itensLocais, itemMusica(musicaId, versaoId, medley)]);
    setAEscolherMusica(null);
  }

  function confirmarMomento() {
    const nome = nomeMomento.trim();
    if (!nome) return;
    persistir([...itensLocais, itemMomento(nome)]);
    setNomeMomento("");
    setANomearMomento(false);
  }

  // ── Arrastar para reordenar (ponteiro único — mouse e toque) ──
  // O handle captura o ponteiro (setPointerCapture): continua a
  // receber move/up mesmo que o dedo saia da área dele, sem precisar
  // de listeners no window. Troca de posição ao vivo em itensLocais
  // conforme o centro do item arrastado cruza o centro de um vizinho;
  // só grava a sério (persistir) quando solta.
  function iniciarArrasto(e, id) {
    const el = refsLinhas.current[id];
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    arrastoStartY.current = e.clientY;
    setArrastoOffsetY(0);
    setArrastoId(id);
  }

  function moverArrasto(e) {
    if (!arrastoId) return;
    const offsetY = e.clientY - arrastoStartY.current;
    setArrastoOffsetY(offsetY);

    const idxAtual = itensLocais.findIndex((it) => it.id === arrastoId);
    const elAtual = refsLinhas.current[arrastoId];
    if (idxAtual === -1 || !elAtual) return;
    const rectAtual = elAtual.getBoundingClientRect();
    const centroAtual = rectAtual.top + rectAtual.height / 2 + offsetY;

    for (let idx = 0; idx < itensLocais.length; idx++) {
      if (idx === idxAtual) continue;
      const el = refsLinhas.current[itensLocais[idx].id];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const centro = rect.top + rect.height / 2;
      const cruzouParaCima = idx < idxAtual && centroAtual < centro;
      const cruzouParaBaixo = idx > idxAtual && centroAtual > centro;
      if (cruzouParaCima || cruzouParaBaixo) {
        const nova = [...itensLocais];
        const [item] = nova.splice(idxAtual, 1);
        nova.splice(idx, 0, item);
        setItensLocais(nova);
        break;
      }
    }
  }

  function soltarArrasto() {
    if (!arrastoId) return;
    setArrastoId(null);
    setArrastoOffsetY(0);
    persistir(itensLocais);
  }

  const musicaPorId = useMemo(() => Object.fromEntries(musicas.map((m) => [m.id, m])), [musicas]);

  // novo item entra sempre no fim — "anterior" é sempre o último, só
  // vale como par de medley se também for música (não dá pra colar
  // num momento como "Ceia").
  const ultimoItem = itensLocais.at(-1);
  const musicaAnteriorTitulo = ultimoItem?.tipo === "musica" ? musicaPorId[ultimoItem.musicaId]?.titulo : null;

  return (
    <>
      <div className="cabecalho" style={{ paddingTop: 0 }}>
        <h3>{MESES[mes]} {ano}</h3>
        <span className="calnav">
          <button className="calbt" onClick={() => { setEventoId(null); mudarMes(-1); }}>‹</button>
          <button className="calbt" onClick={() => { setEventoId(null); mudarMes(1); }}>›</button>
        </span>
      </div>
      <div className="bib-chips">
        {eventosMes.map((ev) => (
          <button key={ev.id} className="bib-chip" data-on={eventoId === ev.id ? 1 : 0} onClick={() => setEventoId(ev.id)}>
            {dataCurta(ev.data)}
          </button>
        ))}
        {eventosMes.length === 0 && <span className="ds">Sem cultos neste mês.</span>}
      </div>

      {eventoAtual && (
        <p className="rep-selo">
          {repertorio ? `Atualizado ${haQuanto(repertorio.atualizadoEm)}${autor ? ` por ${autor}` : ""} · já visível para a projeção` : "Ainda ninguém montou este repertório — assim que guardares o primeiro item, fica visível."}
        </p>
      )}

      <div style={{ marginTop: 14 }}>
        {itensLocais.map((item, i) => {
          const arrastandoEste = arrastoId === item.id;
          const estilo = arrastandoEste
            ? { transform: `translateY(${arrastoOffsetY}px)`, position: "relative", zIndex: 5, boxShadow: "0 8px 20px rgba(10,15,46,0.18)" }
            : { transition: arrastoId ? "transform 0.15s" : undefined };
          if (item.tipo === "momento") {
            return (
              <div
                className="rep-item momento" key={item.id} style={estilo}
                ref={(el) => { refsLinhas.current[item.id] = el; }}
              >
                <span
                  className="rep-alca" onPointerDown={(e) => iniciarArrasto(e, item.id)}
                  onPointerMove={moverArrasto} onPointerUp={soltarArrasto} onPointerCancel={soltarArrasto}
                >⠿</span>
                <div style={{ flex: 1 }}><p className="nmt">{item.nome}</p><p className="ds">Momento</p></div>
                <button className="btn sec" style={{ padding: "6px 8px", fontSize: 11 }} disabled={i === 0} onClick={() => mover(item.id, -1)}>↑</button>
                <button className="btn sec" style={{ padding: "6px 8px", fontSize: 11 }} disabled={i === itensLocais.length - 1} onClick={() => mover(item.id, 1)}>↓</button>
                <button className="rep-remover" onClick={() => remover(item.id)}>✕</button>
              </div>
            );
          }
          const m = musicaPorId[item.musicaId];
          // a reordenação pode deixar um medley no meio da lista — por
          // isso olha para os dois lados, não só para "é o último".
          // `medley` só desenha colado de facto quando ainda há uma
          // música logo antes: se a ordem mudar e quebrar a
          // vizinhança, o dado continua guardado (volta a colar se
          // voltar a ficar junto), só o visual "conectado" some.
          const proximoEhMedley = itensLocais[i + 1]?.tipo === "musica" && itensLocais[i + 1]?.medley === true;
          const esteEhMedley = item.medley === true && itensLocais[i - 1]?.tipo === "musica";
          const podeExpandir = esteEhMedley && !!item.observacaoMedley;
          return (
            <div key={item.id}>
              <div
                className={`rep-item${proximoEhMedley ? " medley-topo" : ""}${esteEhMedley ? " medley-cauda" : ""}`}
                style={estilo}
                ref={(el) => { refsLinhas.current[item.id] = el; }}
                onClick={podeExpandir ? () => setMedleyExpandidoId((v) => (v === item.id ? null : item.id)) : undefined}
              >
                <span
                  className="rep-alca" onPointerDown={(e) => iniciarArrasto(e, item.id)}
                  onPointerMove={moverArrasto} onPointerUp={soltarArrasto} onPointerCancel={soltarArrasto}
                >⠿</span>
                <div className="bib-capa" style={m?.capaUrl ? { backgroundImage: `url(${m.capaUrl})` } : {}}>
                  {!m?.capaUrl && (m?.titulo?.[0]?.toUpperCase() ?? "?")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="nmt">
                    {m?.titulo ?? "Música removida"}
                    {esteEhMedley && <span className="tag lim" style={{ marginLeft: 8 }}>medley</span>}
                  </p>
                  <p className="ds">{m?.artista ?? ""}</p>
                </div>
                <button className="btn sec" style={{ padding: "6px 8px", fontSize: 11 }} disabled={i === 0} onClick={(e) => { e.stopPropagation(); mover(item.id, -1); }}>↑</button>
                <button className="btn sec" style={{ padding: "6px 8px", fontSize: 11 }} disabled={i === itensLocais.length - 1} onClick={(e) => { e.stopPropagation(); mover(item.id, 1); }}>↓</button>
                <button className="rep-remover" onClick={(e) => { e.stopPropagation(); remover(item.id); }}>✕</button>
              </div>
              {podeExpandir && medleyExpandidoId === item.id && (
                <div className="rep-medley-obs">{item.observacaoMedley}</div>
              )}
            </div>
          );
        })}
        {itensLocais.length === 0 && <div className="vaz">Ainda sem itens neste repertório.</div>}

        {musicaAnteriorTitulo && (
          <button className="btn sec full" style={{ marginTop: 10, borderStyle: "dashed" }} disabled={!eventoId} onClick={() => setAEscolherMusica("medley")}>
            + Medley com "{musicaAnteriorTitulo}"
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="btn full" style={{ flex: 1 }} disabled={!eventoId} onClick={() => setAEscolherMusica("musica")}>
          + Música
        </button>
        <button className="btn sec full" style={{ flex: 1 }} disabled={!eventoId} onClick={() => setANomearMomento(true)}>
          + Momento
        </button>
      </div>

      {aNomearMomento && (
        <>
          <div className="veu on" onClick={() => setANomearMomento(false)} />
          <div className="pin on" role="dialog" aria-modal="true">
            <div className="pux" />
            <h2>Novo momento</h2>
            <label className="rot" style={{ marginTop: 12 }}>Nome</label>
            <input className="campo" value={nomeMomento} onChange={(e) => setNomeMomento(e.target.value)} placeholder="Ceia, Oferta, Testemunho…" autoFocus />
            <button className="btn full" style={{ marginTop: 18 }} onClick={confirmarMomento}>Adicionar</button>
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => { setANomearMomento(false); setNomeMomento(""); }}>Cancelar</button>
          </div>
        </>
      )}

      {aEscolherMusica && (
        <SheetEscolherMusica
          musicas={musicas}
          musicaAnteriorTitulo={musicaAnteriorTitulo}
          comoMedley={aEscolherMusica === "medley"}
          onFechar={() => setAEscolherMusica(null)}
          onEscolhida={adicionarMusica}
        />
      )}
    </>
  );
}
