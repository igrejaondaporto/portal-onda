import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ouvirEventosDoMes, ouvirVoluntarios } from "../lib/painel";
import { ouvirRepertorio, guardarRepertorio, itemMusica, itemMomento } from "../lib/repertorio";
import { ouvirMusicas, obterTonsDosItens, obterLinksDosItens, definirLinkVersao, definirTomComRedirecionamento, registarUsoVersao, desfazerUsoVersao } from "../lib/biblioteca";
import { MESES, dataCurta, dataPorExtenso, hojeISO } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import SheetEscolherMusica from "../components/repertorio/SheetEscolherMusica";
import SheetEditarTom from "../components/repertorio/SheetEditarTom";

// Referência estável para "sem itens" — `repertorio?.itens ?? []`
// parecia inofensivo, mas cria um array NOVO a cada render sempre que
// repertorio for null (antes do primeiro snapshot chegar, ou num
// culto ainda sem repertório montado). Esse array alimentava um
// useEffect (a cópia local do arrasto) por identidade, não valor —
// React via "mudou" a cada render, disparava o efeito, que gravava
// estado, que causava outro render, ad infinitum. "Maximum update
// depth exceeded" a 100% de CPU, sem nenhum erro visível na tela —
// só a app a ficar cada vez mais lenta até precisar de recarregar
// várias vezes. Reutilizar SEMPRE a mesma referência corta o ciclo.
const ITENS_VAZIOS = [];

function haQuanto(ts) {
  if (!ts?.toDate) return "agora mesmo";
  const min = Math.round((Date.now() - ts.toDate().getTime()) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

/**
 * Uma linha arrastável do repertório — em componente próprio porque
 * `useSortable` é um hook, e hooks só podem ser chamados dentro de um
 * componente, nunca direto num `.map()`. `dnd-kit`: mesma biblioteca
 * usada em produção por Shopify, Atlassian, etc. — a primeira
 * tentativa (Pointer Events lavrados à mão) tropeçava em toque real
 * no telemóvel (o gesto nativo de "selecionar texto" do iOS ganhava a
 * corrida ao pointerdown antes do JS conseguir reagir); esta
 * biblioteca já resolve isso de propósito, com sensores próprios para
 * toque. Os `{...listeners}` vão só no ⠿ — é ele o "pega aqui para
 * arrastar", nunca a linha toda (que já responde a clique para abrir
 * a observação do medley).
 */
function ItemRepertorio({
  item, i, total, m, tom, link, esteEhMedley, proximoEhMedley, numero,
  podeAlternar, mostrarObs, aEditarObs, obsEditando, setObsEditando,
  onAlternar, onEditarObs, onGuardarObs, onCancelarObs, onMover, onRemover, onEditarTom,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const estilo = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative",
    zIndex: isDragging ? 5 : undefined,
    boxShadow: isDragging ? "0 8px 20px rgba(10,15,46,0.18)" : undefined,
  };

  if (item.tipo === "momento") {
    return (
      <div ref={setNodeRef} style={estilo} className="rep-item momento">
        <span className="rep-alca" {...attributes} {...listeners}>⠿</span>
        <div style={{ flex: 1 }}><p className="nmt">{item.nome}</p><p className="ds">Momento</p></div>
        <span className="rep-steppers">
          <button aria-label="Mover para cima" disabled={i === 0} onClick={() => onMover(item.id, -1)}>▲</button>
          <button aria-label="Mover para baixo" disabled={i === total - 1} onClick={() => onMover(item.id, 1)}>▼</button>
        </span>
        <button className="rep-remover" onClick={() => onRemover(item.id)}>✕</button>
      </div>
    );
  }

  return (
    <div>
      <div
        ref={setNodeRef} style={estilo}
        className={`rep-item${proximoEhMedley ? " medley-topo" : ""}${esteEhMedley ? " medley-cauda" : ""}`}
        onClick={podeAlternar ? onAlternar : undefined}
      >
        <span className="rep-alca" {...attributes} {...listeners}>⠿</span>
        <div className="bib-capa" style={m?.capaUrl ? { backgroundImage: `url(${m.capaUrl})` } : {}}>
          {!m?.capaUrl && (m?.titulo?.[0]?.toUpperCase() ?? "?")}
        </div>
        <div className="rep-item-corpo">
          <p className="nmt">
            {numero}ª · {m?.titulo ?? "Música removida"}
            {esteEhMedley && <span className="tag lim" style={{ marginLeft: 8 }}>medley</span>}
          </p>
          <p className="ds">{m?.artista ?? ""}</p>
          <div className="rep-item-acoes">
            <button
              className={`rep-tom${tom ? "" : " sem-tom"}`} onClick={(e) => { e.stopPropagation(); onEditarTom(item, m); }}
              aria-label="Trocar o tom"
            >
              {tom || "Tom"}
            </button>
            {link && (
              <a
                className="rep-link-youtube" href={link} target="_blank" rel="noreferrer"
                onClick={(e) => e.stopPropagation()} aria-label="Abrir link desta versão"
              >
                <svg viewBox="0 0 24 17" width="20" height="14" aria-hidden="true">
                  <path d="M23.5 2.5a3 3 0 0 0-2.1-2.1C19.5 0 12 0 12 0S4.5 0 2.6.4A3 3 0 0 0 .5 2.5 31 31 0 0 0 0 8.3a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1C4.5 16.6 12 16.6 12 16.6s7.5 0 9.4-.4a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-5.8 31 31 0 0 0-.5-5.8Z" fill="#FF0000" />
                  <path d="M9.6 11.8 15.8 8.3 9.6 4.8Z" fill="#fff" />
                </svg>
              </a>
            )}
            <span className="rep-acoes-direita">
              <span className="rep-steppers">
                <button aria-label="Mover para cima" disabled={i === 0} onClick={(e) => { e.stopPropagation(); onMover(item.id, -1); }}>▲</button>
                <button aria-label="Mover para baixo" disabled={i === total - 1} onClick={(e) => { e.stopPropagation(); onMover(item.id, 1); }}>▼</button>
              </span>
              <button className="rep-remover" onClick={(e) => { e.stopPropagation(); onRemover(item.id); }}>✕</button>
            </span>
          </div>
        </div>
      </div>
      {esteEhMedley && aEditarObs ? (
        <div className="rep-medley-obs">
          <label className="rot">Qual parte desta música vai ser usada?</label>
          <input
            className="campo" value={obsEditando} onChange={(e) => setObsEditando(e.target.value)}
            placeholder="Só o refrão, a partir da ponte…" autoFocus
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn full" style={{ flex: 1 }} onClick={onGuardarObs}>Guardar</button>
            <button className="btn sec full" style={{ flex: 1 }} onClick={onCancelarObs}>Cancelar</button>
          </div>
        </div>
      ) : mostrarObs ? (
        <div className="rep-medley-obs">
          "{item.observacaoMedley}"
          <button className="rep-medley-editar" onClick={onEditarObs} aria-label="Editar observação">✎</button>
        </div>
      ) : esteEhMedley && !item.observacaoMedley ? (
        <button className="rep-medley-add" onClick={onEditarObs}>
          + Qual parte desta música vai ser usada?
        </button>
      ) : null}
    </div>
  );
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
  // Observação do medley visível por omissão — só entra aqui quem foi
  // explicitamente fechado (o oposto do que "expandido" seria).
  const [medleysFechados, setMedleysFechados] = useState(() => new Set());
  const [medleyAEditar, setMedleyAEditar] = useState(null); // id do item, ou null
  const [obsEditando, setObsEditando] = useState("");

  // Cópia local dos itens — o arrasto reordena isto ao vivo, sem
  // gravar a cada troca; só persiste quando o dedo solta. Sincroniza
  // com o Firestore sempre que não está a meio de um arrasto (senão
  // o próprio eco do snapshot da nossa escrita interrompia o gesto).
  const [itensLocais, setItensLocais] = useState([]);
  const [aArrastar, setAArrastar] = useState(false);
  const [tons, setTons] = useState({});
  const [links, setLinks] = useState({});
  const [itemTomAEditar, setItemTomAEditar] = useState(null); // { item, m } | null

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

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
  // "Versão do Lead" no topo do repertório — só o primeiro nome, é
  // um rótulo, não uma etiqueta de contacto (pedido do líder).
  const leadId = eventoAtual?.escala?.escalados?.find((e) => e.papel === "lead")?.pessoaId;
  const leadNome = leadId ? voluntarios.find((p) => p.id === leadId)?.nome?.split(" ")[0] : null;
  const itens = repertorio?.itens ?? ITENS_VAZIOS;

  useEffect(() => {
    if (!aArrastar) setItensLocais(itens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, eventoId]);

  // Leitura pontual (não onSnapshot) do tom de cada versão — um
  // listener por música seria demais para algo que quase nunca muda
  // depois de escolhido (ver obterTonsDosItens).
  useEffect(() => {
    let cancelado = false;
    obterTonsDosItens(itensLocais).then((mapa) => { if (!cancelado) setTons(mapa); });
    return () => { cancelado = true; };
  }, [itensLocais]);

  // Mesmo padrão da leitura de tons acima, mas para o link de
  // referência de cada versão — só o botão de YouTube ao lado do selo
  // de tom precisa disto (ver ItemRepertorio).
  useEffect(() => {
    let cancelado = false;
    obterLinksDosItens(itensLocais).then((mapa) => { if (!cancelado) setLinks(mapa); });
    return () => { cancelado = true; };
  }, [itensLocais]);

  async function confirmarNovoTom(novoTom, novoLink) {
    const { item } = itemTomAEditar;
    const lead = leadId ? voluntarios.find((p) => p.id === leadId) : null;
    const versaoFinalId = await definirTomComRedirecionamento(item.musicaId, item.versaoId, novoTom, voluntarios, lead, uid);
    const redirecionou = versaoFinalId !== item.versaoId;

    if (redirecionou) {
      if (eventoId) desfazerUsoVersao({ eventoId, musicaId: item.musicaId, versaoId: item.versaoId });
      persistir(itensLocais.map((it) => (it.id === item.id ? { ...it, versaoId: versaoFinalId } : it)));
    }
    // Link é da VERSÃO final (a mesma para onde o tom foi, se
    // redirecionou) — não da música, e não do item do repertório.
    await definirLinkVersao(item.musicaId, versaoFinalId, novoLink);
    setTons((atual) => ({ ...atual, [item.id]: novoTom }));
    setLinks((atual) => ({ ...atual, [item.id]: novoLink || null }));
    setItemTomAEditar(null);
    torrada(redirecionou ? `Tom atualizado — versão de ${lead.nome.split(" ")[0]}` : "Tom atualizado");
    if (eventoId) registarUsoVersao({ eventoId, musicaId: item.musicaId, versaoId: versaoFinalId });
  }

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
    const item = itensLocais.find((it) => it.id === id);
    persistir(itensLocais.filter((it) => it.id !== id));
    if (eventoId && item?.tipo === "musica") {
      desfazerUsoVersao({ eventoId, musicaId: item.musicaId, versaoId: item.versaoId });
    }
  }

  function adicionarMusica(musicaId, versaoId, medley) {
    persistir([...itensLocais, itemMusica(musicaId, versaoId, medley)]);
    setAEscolherMusica(null);
    if (eventoId) registarUsoVersao({ eventoId, musicaId, versaoId });
  }

  function confirmarMomento() {
    const nome = nomeMomento.trim();
    if (!nome) return;
    persistir([...itensLocais, itemMomento(nome)]);
    setNomeMomento("");
    setANomearMomento(false);
  }

  function alternarMedleyFechado(id) {
    setMedleysFechados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  // Observação do medley editável a qualquer momento, não só na hora
  // de adicionar — faltava um jeito de voltar e dizer "entra a partir
  // do refrão" numa música que já estava no repertório sem isso.
  function iniciarEdicaoObs(item) {
    setObsEditando(item.observacaoMedley || "");
    setMedleyAEditar(item.id);
  }

  function guardarObsMedley(id) {
    const texto = obsEditando.trim() || null;
    persistir(itensLocais.map((it) => (it.id === id ? { ...it, observacaoMedley: texto } : it)));
    setMedleyAEditar(null);
  }

  function aoComecarArrasto() {
    setAArrastar(true);
  }

  function aoTerminarArrasto(event) {
    setAArrastar(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const de = itensLocais.findIndex((it) => it.id === active.id);
    const para = itensLocais.findIndex((it) => it.id === over.id);
    if (de === -1 || para === -1) return;
    persistir(arrayMove(itensLocais, de, para));
  }

  const musicaPorId = useMemo(() => Object.fromEntries(musicas.map((m) => [m.id, m])), [musicas]);

  // Numeração 1ª/2ª/3ª… só conta músicas (momento não é "a Nª
  // música"); um medley conta como a MESMA música do que veio antes,
  // por isso repete o número em vez de avançar.
  const numerosOrdinais = useMemo(() => {
    const mapa = {};
    let n = 0;
    itensLocais.forEach((item, i) => {
      if (item.tipo !== "musica") return;
      const continuaMedley = item.medley === true && itensLocais[i - 1]?.tipo === "musica";
      if (!continuaMedley) n += 1;
      mapa[item.id] = n;
    });
    return mapa;
  }, [itensLocais]);

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
      {leadNome && (
        <p className="rep-selo" style={{ marginTop: 4, fontWeight: 700 }}>Versão "{leadNome}"</p>
      )}

      <div style={{ marginTop: 14 }}>
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragStart={aoComecarArrasto} onDragEnd={aoTerminarArrasto} onDragCancel={() => setAArrastar(false)}>
          <SortableContext items={itensLocais.map((it) => it.id)} strategy={verticalListSortingStrategy}>
            {itensLocais.map((item, i) => {
              if (item.tipo === "momento") {
                return (
                  <ItemRepertorio
                    key={item.id} item={item} i={i} total={itensLocais.length}
                    onMover={mover} onRemover={remover}
                  />
                );
              }
              const m = musicaPorId[item.musicaId];
              // a reordenação pode deixar um medley no meio da lista —
              // por isso olha para os dois lados, não só para "é o
              // último". `medley` só desenha colado de facto quando
              // ainda há uma música logo antes: se a ordem mudar e
              // quebrar a vizinhança, o dado continua guardado (volta
              // a colar se voltar a ficar junto), só o visual
              // "conectado" some.
              const proximoEhMedley = itensLocais[i + 1]?.tipo === "musica" && itensLocais[i + 1]?.medley === true;
              const esteEhMedley = item.medley === true && itensLocais[i - 1]?.tipo === "musica";
              const podeAlternar = esteEhMedley && !!item.observacaoMedley;
              return (
                <ItemRepertorio
                  key={item.id} item={item} i={i} total={itensLocais.length} m={m}
                  tom={tons[item.id]} link={links[item.id]}
                  esteEhMedley={esteEhMedley} proximoEhMedley={proximoEhMedley}
                  numero={numerosOrdinais[item.id]}
                  podeAlternar={podeAlternar}
                  mostrarObs={podeAlternar && !medleysFechados.has(item.id)}
                  aEditarObs={medleyAEditar === item.id}
                  obsEditando={obsEditando} setObsEditando={setObsEditando}
                  onAlternar={() => alternarMedleyFechado(item.id)}
                  onEditarObs={() => iniciarEdicaoObs(item)}
                  onGuardarObs={() => guardarObsMedley(item.id)}
                  onCancelarObs={() => setMedleyAEditar(null)}
                  onMover={mover} onRemover={remover}
                  onEditarTom={(it, musica) => setItemTomAEditar({ item: it, m: musica })}
                />
              );
            })}
          </SortableContext>
        </DndContext>
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
      {itemTomAEditar && (
        <SheetEditarTom
          titulo={itemTomAEditar.m?.titulo}
          tomAtual={tons[itemTomAEditar.item.id]}
          linkAtual={links[itemTomAEditar.item.id]}
          onFechar={() => setItemTomAEditar(null)}
          onConfirmar={confirmarNovoTom}
        />
      )}
    </>
  );
}
