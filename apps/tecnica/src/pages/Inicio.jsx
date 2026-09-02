import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { cEscala, funcoesDosMeusMinisterios, meusLugares } from "../lib/modelo";
import { ouvirVoluntarios, ouvirFuncoes, ouvirEventosDoMes, ouvirBase, ouvirMinisterios } from "../lib/painel";
import { ouvirChecklist, marcarFeito, desmarcarFeito, obterMeuEvento } from "../lib/culto";
import { ouvirRepertorioLouvor } from "../lib/repertorioLouvor";
import { ouvirReembolsos, marcarReembolsoVisto } from "../lib/reembolsos";
import { ouvirEquipamentos } from "../lib/equipamentos";
import { ouvirMelhorias, minhasTarefas } from "../lib/melhorias";
import { ouvirIndiceWiki } from "../lib/wiki";
import { ouvirEnquetesAbertas, ouvirMinhaResposta, obterEventosPorIds } from "../lib/enquetes";
import { dataPorExtenso, eur, nomeCurto, MESES } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { ouvirMinhasSolicitacoes } from "@portal/shared/lib/solicitacoes.js";
import Bola from "../components/Bola";
import Calendario from "../components/Calendario";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";
import SheetResponderEnquete from "../components/SheetResponderEnquete";
import SheetSolicitacoesBase from "@portal/shared/components/SheetSolicitacoesBase.jsx";
import SheetAbrirSolicitacao from "@portal/shared/components/SheetAbrirSolicitacao.jsx";
import SheetDetalheSolicitacao from "@portal/shared/components/SheetDetalheSolicitacao.jsx";

/** A checklist é espelho de Funções/Checklists — mesma ordem (o líder
 *  reordena lá, com as setas ↑/↓), nunca outra. A lista já chega
 *  ordenada por "ordem" (ver ouvirFuncoes em lib/painel.js), então
 *  aqui só falta mandar quem já está feito para o fim — sort é
 *  estável, por isso preserva a ordem dentro de cada grupo (feitas /
 *  por fazer). Já existiu uma versão que ordenava por fase + nome —
 *  foi removida por quebrar o espelho. */
function ordenarChecklist(lista, checklist) {
  return [...lista].sort((a, b) => (checklist[a.id] ? 1 : 0) - (checklist[b.id] ? 1 : 0));
}

// Referência estável para "sem itens" — ver o mesmo cuidado em
// apps/louvor/src/pages/Repertorio.jsx (o comentário lá tem a
// história completa do bug: um array novo a cada render, mesmo
// vazio, é "mudou" por identidade pra um useEffect — loop infinito).
const ITENS_VAZIOS_REP = [];

export default function Inicio({ uid, papel, pessoa, mes, ano, mudarMes, ativo, definirCabecalho, onIrEscala, onIrInventario, onIrReembolsos, onIrWiki }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const [base, setBase] = useState(null);
  const [meuEvento, setMeuEvento] = useState(null);
  const [voluntarios, setVoluntarios] = useState([]);
  const [funcoes, setFuncoes] = useState([]);
  const [ministerios, setMinisterios] = useState([]);
  const [checklist, setChecklist] = useState({});
  const [eventosMes, setEventosMes] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [meusReembolsos, setMeusReembolsos] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [melhorias, setMelhorias] = useState([]);
  const [contactoAberto, setContactoAberto] = useState(null);
  const [verChecklistToda, setVerChecklistToda] = useState(false);
  const [wikiItens, setWikiItens] = useState([]);
  const [enquetes, setEnquetes] = useState([]); // 1 ou 2, se o líder abriu dois meses de uma vez
  const [minhasRespostas, setMinhasRespostas] = useState({}); // { [mes]: resposta | null }
  const [eventosEnquete, setEventosEnquete] = useState({});
  const [aResponderEnquete, setAResponderEnquete] = useState(false);
  const [minhasSolicitacoes, setMinhasSolicitacoes] = useState([]);
  const [sheetComunicacao, setSheetComunicacao] = useState(null); // { tipo: "lista" | "abrir" | "detalhe", solicitacao? }
  const [repertorio, setRepertorio] = useState(null);

  useEffect(() => ouvirBase(setBase), []);
  useEffect(() => { obterMeuEvento(uid).then(setMeuEvento); }, [uid]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirFuncoes(setFuncoes), []);
  useEffect(() => ouvirMinisterios(setMinisterios), []);
  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirIndiceWiki(setWikiItens), []);
  useEffect(() => ouvirMelhorias(setMelhorias), []);

  // a escala do culto que vamos mostrar no Início tem de ser ao vivo — se
  // o líder mudar quem serve ou o líder de culto, não é preciso refresh.
  useEffect(() => {
    if (!meuEvento?.id) return;
    return onSnapshot(cEscala(meuEvento.id), (esc) => {
      const escala = esc.exists() ? esc.data() : { pessoas: [], liderEscala: null, lugares: [] };
      setMeuEvento((ev) => (ev && ev.id === meuEvento.id ? { ...ev, escala } : ev));
    });
  }, [meuEvento?.id]);
  useEffect(() => {
    if (!souLiderBase) return;
    return ouvirReembolsos(true, uid, (lista) => setPendentes(lista.filter((r) => r.estado === "submetido")));
  }, [souLiderBase, uid]);
  useEffect(() => ouvirReembolsos(false, uid, setMeusReembolsos), [uid]);
  useEffect(() => ouvirEquipamentos(setEquipamentos), []);
  useEffect(() => {
    if (!souLiderBase) return;
    return ouvirMinhasSolicitacoes(setMinhasSolicitacoes);
  }, [souLiderBase]);
  useEffect(() => ouvirEnquetesAbertas(setEnquetes), []);
  useEffect(() => {
    if (!enquetes.length) { setMinhasRespostas({}); return; }
    const paragens = enquetes.map((e) =>
      ouvirMinhaResposta(e.id, uid, (resposta) => setMinhasRespostas((m) => ({ ...m, [e.id]: resposta })))
    );
    return () => paragens.forEach((p) => p());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquetes.map((e) => e.id).join(","), uid]);
  useEffect(() => {
    const ids = [...new Set(enquetes.flatMap((e) => e.domingos || []))];
    if (!ids.length) { setEventosEnquete({}); return; }
    obterEventosPorIds(ids).then(setEventosEnquete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquetes.map((e) => e.id).join(",")]);

  useEffect(() => {
    if (!meuEvento) return;
    return ouvirChecklist(meuEvento.id, setChecklist);
  }, [meuEvento?.id]);

  const sirvo = !!meuEvento && (meuEvento.escala.pessoas || []).includes(uid);
  const meusLugaresHoje = meuEvento ? meusLugares(meuEvento.escala, uid) : [];
  const souAprendiz = meusLugaresHoje.some((l) => l.aprendizId === uid);
  // Repertório no Início: só pra quem está escalado na Projeção NESTE
  // culto (meuEvento já é "o meu próximo domingo a servir", ver
  // obterMeuEvento em lib/culto.js — passado o domingo, vira sozinho
  // pra quem estiver na Projeção do seguinte). Ao contrário do
  // souProjecao de Culto.jsx (ministerios.projecao da pessoa, um
  // atributo permanente, sempre visível), isto é por escala da
  // semana — quem só entra daqui a duas semanas não vê já.
  const souProjecaoHoje = meusLugaresHoje.some((l) => l.ministerioId === "projecao");
  useEffect(() => {
    if (!souProjecaoHoje) { setRepertorio(null); return; }
    return ouvirRepertorioLouvor(meuEvento.id, setRepertorio);
  }, [souProjecaoHoje, meuEvento?.id]);
  const itensRep = repertorio?.itens ?? ITENS_VAZIOS_REP;
  const blocosRepertorio = [];
  itensRep.forEach((item, i) => {
    if (item.tipo !== "musica") return;
    const continuaMedley = item.medley === true && itensRep[i - 1]?.tipo === "musica";
    const entrada = { titulo: item.titulo, artista: item.artista, capaUrl: item.capaUrl, observacaoMedley: item.observacaoMedley || null };
    if (continuaMedley && blocosRepertorio.length) {
      blocosRepertorio.at(-1).itens.push(entrada);
    } else {
      blocosRepertorio.push({ numero: blocosRepertorio.length + 1, itens: [entrada] });
    }
  });
  const minhas = meuEvento ? funcoesDosMeusMinisterios(funcoes, meuEvento.id, meuEvento.escala, uid, souLiderBase) : [];
  const funcoesCulto = meuEvento ? funcoes.filter((f) => !f.eventoId || f.eventoId === meuEvento.id) : [];
  const liderNome = meuEvento?.escala.liderEscala
    ? voluntarios.find((p) => p.id === meuEvento.escala.liderEscala)?.nome
    : null;
  const chegada = meuEvento?.horaChegada || base?.horaChegada || "08:30";
  const reembolsoIndeferido = meusReembolsos.find((r) => r.estado === "indeferido" && !r.vistoPeloVoluntario);

  function fecharAvisoReembolso() {
    marcarReembolsoVisto(reembolsoIndeferido.id).catch(() => {});
  }

  const nomeMinisterio = (id) => ministerios.find((m) => m.id === id)?.nome ?? "";
  const nomeDe = (id) => voluntarios.find((p) => p.id === id)?.nome;


  useEffect(() => {
    if (!ativo) return;
    if (!meuEvento) {
      definirCabecalho({ titulo: <>Olá, <em>{nomeCurto(pessoa?.nome) ?? "…"}</em></>, subtitulo: "", chips: [] });
      return;
    }
    definirCabecalho({
      titulo: <>Olá, <em>{nomeCurto(pessoa?.nome) ?? "…"}</em></>,
      subtitulo: sirvo
        ? (meuEvento.tipo ? `Serves no ${meuEvento.tipo}, ${dataPorExtenso(meuEvento.data)}` : `Serves no domingo, ${dataPorExtenso(meuEvento.data)}`)
        : `Ainda não estás escalado — próximo culto: ${dataPorExtenso(meuEvento.data)}`,
      chips: sirvo
        ? [`Chegada ${chegada}`, `Responsável · ${liderNome ?? "por definir"}`, meusLugaresHoje.length ? nomeMinisterio(meusLugaresHoje[0].ministerioId) : "Ministério por definir"]
        : [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, meuEvento, pessoa, sirvo, liderNome, meusLugaresHoje.length, chegada]);

  // não se espera pela promessa: a marca (ou a limpeza) tem de aparecer já,
  // vinda da cache local — sem rede, a escrita fica pendente e sincroniza
  // sozinha quando ela voltar. Esperar aqui deixaria o toque sem efeito
  // nenhum enquanto a Casa do Povo não tiver sinal.
  function alternarFeito(funcaoId) {
    if (!meuEvento) return;
    const escrita = checklist[funcaoId] ? desmarcarFeito(meuEvento.id, funcaoId) : marcarFeito(meuEvento.id, funcaoId, uid);
    escrita.catch((e) => torrada(e.message || "Não foi possível atualizar."));
  }


  // O que alguém encarregou esta pessoa de fazer. Sem hook de
  // propósito: é um filtro barato, e assim não há risco de acabar
  // abaixo de um `return null` como já aconteceu uma vez aqui.
  const tarefas = minhasTarefas(melhorias, uid);

  // As mais antigas primeiro — quem perguntou há três semanas já
  // desistiu de esperar; é essa que interessa destapar.
  //
  // Fica ACIMA do `return null` abaixo, e tem de ficar. Um hook a
  // seguir a um return condicional não corre nas renderizações em que
  // o componente sai mais cedo — aqui, todas as que acontecem antes de
  // `meuEvento` chegar do Firestore. Na renderização seguinte já corre,
  // o React conta mais hooks do que antes e mata a app inteira com o
  // erro #310. Foi o que aconteceu em produção a 15/08/2026.
  const duvidasAbertas = useMemo(
    () => wikiItens
      .filter((w) => w.tipo === "duvida" && !w.resolvida)
      .sort((a, b) => (a.atualizadoEm?.toMillis?.() ?? 0) - (b.atualizadoEm?.toMillis?.() ?? 0)),
    [wikiItens]
  );

  if (!meuEvento) return null;

  // fica visível até ao prazo, mesmo depois de responder — para quem
  // quiser alterar o voto ainda dentro do prazo do líder. Se o líder
  // abriu dois meses de uma vez, as duas contam pra este alerta.
  const hojeISO = new Date().toISOString().slice(0, 10);
  const enquetesDentroDoPrazo = enquetes.filter((e) => !e.prazo || hojeISO <= e.prazo);
  const carregandoRespostas = enquetesDentroDoPrazo.some((e) => !(e.id in minhasRespostas));
  const todasRespondidas = enquetesDentroDoPrazo.length > 0 && enquetesDentroDoPrazo.every((e) => !!minhasRespostas[e.id]);
  const mesesEnquete = enquetesDentroDoPrazo.map((e) => MESES[Number(e.id.split("-")[1]) - 1]).join(" e ");

  return (
    <>
      {enquetesDentroDoPrazo.length > 0 && !carregandoRespostas && (
        <div className="destaque" onClick={() => setAResponderEnquete(true)}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>A precisar de ti — Escala de {mesesEnquete}</p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>
              {todasRespondidas ? "Já respondeste — queres alterar?" : "Tens alguma indisponibilidade nesse período?"}
            </p>
            <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>Prazo até {dataPorExtenso(enquetesDentroDoPrazo[0].prazo)}</p>
          </div>
          <span style={{ fontSize: 24 }}>›</span>
        </div>
      )}
      {souLiderBase && pendentes.length > 0 && (
        <div className="destaque" onClick={() => onIrReembolsos?.()}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>A precisar de ti</p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>
              {pendentes.length} {pendentes.length === 1 ? "pedido" : "pedidos"} de reembolso
            </p>
            <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>
              {voluntarios.find((p) => p.id === pendentes[0].pessoaId)?.nome} · {eur(pendentes[0].valor)}
            </p>
          </div>
          <span style={{ fontSize: 24 }}>›</span>
        </div>
      )}
      {reembolsoIndeferido && (
        <div className="destaque" style={{ background: "var(--magenta)" }} onClick={() => { fecharAvisoReembolso(); onIrReembolsos?.(); }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>O teu pedido de reembolso</p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>
              Indeferido · {eur(reembolsoIndeferido.valor)}
            </p>
            {reembolsoIndeferido.comentarioLider && (
              <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>{reembolsoIndeferido.comentarioLider}</p>
            )}
          </div>
          <span style={{ fontSize: 24 }}>›</span>
        </div>
      )}
      {/* Uma dúvida sem resposta é um guia que ainda não existe. Toca e
        * vais direto à mais antiga — a que está à espera há mais tempo. */}
      {souLiderBase && duvidasAbertas.length > 0 && (
        <div className="destaque" onClick={() => onIrWiki?.(duvidasAbertas[0].id)}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>A precisar de ti</p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>
              {duvidasAbertas.length} {duvidasAbertas.length === 1 ? "dúvida" : "dúvidas"} da equipa sem resposta
            </p>
            <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>{duvidasAbertas[0].titulo}</p>
          </div>
          <span style={{ fontSize: 24 }}>›</span>
        </div>
      )}
    <div className="duas">
      <div>
        {souAprendiz && (
          <div className="caixa" style={{ background: "var(--agua)", border: 0, marginTop: 14 }}>
            <p className="ds">
              📝 Estás em treino hoje com{" "}
              {meusLugaresHoje.filter((l) => l.aprendizId === uid).map((l) => nomeDe(l.titularId)).filter(Boolean).join(" e ")}
              {" "}— acompanha e pergunta.
            </p>
          </div>
        )}

        {/* Antes da checklist de propósito: ao domingo de manhã, o que
          * alguém te pediu para fazer vem antes da rotina de sempre.
          * "Testa os COB com os cabos novos" tem de ser a primeira coisa
          * que se lê, não algo a descobrir na aba dos Equipamentos. */}
        {tarefas.length > 0 && (
          <div className="sect">
            <div className="cabecalho">
              <h3>A tua vez</h3>
              <span className="cap">{tarefas.length}</span>
            </div>
            {tarefas.map((m) => {
              const eq = m.equipamentoId ? equipamentos.find((x) => x.id === m.equipamentoId) : null;
              return (
                <div className="linha" style={{ cursor: "pointer" }} key={m.id} onClick={() => onIrInventario?.()}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="nmt">{m.titulo}</p>
                    <p className="ds">
                      {eq ? `${eq.nome} · ` : ""}
                      {m.estado === "em_curso" ? "Em curso" : "Por começar"}
                    </p>
                  </div>
                  <span className="seta">›</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="blococor" data-tour="checklist-bloco">
          <div className="cabecalho">
            <h3>{meusLugaresHoje.length ? nomeMinisterio(meusLugaresHoje[0].ministerioId) : "As tuas funções"}</h3>
            <span className="cap">{minhas.filter((f) => checklist[f.id]).length}/{minhas.length}</span>
          </div>
          {minhas.length ? (
            (() => {
              const ordenadas = ordenarChecklist(minhas, checklist);
              const visiveis = verChecklistToda ? ordenadas : ordenadas.slice(0, 3);
              return (
                <>
                  {visiveis.map((f) => {
                    const ok = !!checklist[f.id];
                    return (
                      <div
                        className={`linha${ok ? " feita" : ""}`} key={f.id} style={{ cursor: "pointer" }}
                        onClick={() => alternarFeito(f.id)}
                      >
                        <button className={`chk${ok ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); alternarFeito(f.id); }}>✓</button>
                        <div style={{ flex: 1 }}>
                          <p className="nmt">{f.nome}</p>
                          <p className="ds">
                            {ok
                              ? `Feito às ${checklist[f.id].hora}`
                              : (f.descricao || "").slice(0, 52) + ((f.descricao || "").length > 52 ? "…" : "")}
                          </p>
                        </div>
                        <Bola funcao={f} tamanho={34} />
                      </div>
                    );
                  })}
                  {ordenadas.length > 3 && (
                    <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setVerChecklistToda((v) => !v)}>
                      {verChecklistToda ? "Ver menos" : `Ver mais (${ordenadas.length - 3})`}
                    </button>
                  )}
                </>
              );
            })()
          ) : (
            <div className="vaz" style={{ border: 0 }}>
              {sirvo ? "Este ministério ainda não tem checklist." : (liderNome ? `${liderNome} ainda não montou a escala deste domingo.` : "O Responsável ainda não foi definido.")}
            </div>
          )}
        </div>

        {/* Só pra quem está na Projeção NESTE domingo (ver
          * souProjecaoHoje acima) — passado o domingo, some sozinho e
          * volta só quando for de novo a vez da pessoa. */}
        {souProjecaoHoje && (
          <div className="blococor">
            <div className="cabecalho">
              <h3>Repertório de {dataPorExtenso(meuEvento.data)}</h3>
            </div>
            {repertorio ? (
              blocosRepertorio.length > 0 ? (
                <div style={{ marginTop: 4 }}>
                  {blocosRepertorio.map((b) => (
                    <div key={b.numero}>
                      {b.itens.map((it, i) => {
                        const medleyTopo = i === 0 && b.itens.length > 1;
                        const medleyCauda = i > 0;
                        return (
                          <div key={i}>
                            <div className={`tec-rep-mini-item${medleyTopo ? " medley-topo" : ""}${medleyCauda ? " medley-cauda" : ""}`}>
                              <span className="tec-rep-num">{b.numero}ª</span>
                              <div
                                className="tec-rep-capa"
                                style={it.capaUrl ? { backgroundImage: `url(${it.capaUrl})` } : {}}
                              >
                                {!it.capaUrl && (it.titulo?.[0]?.toUpperCase() ?? "?")}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p className="nmt">
                                  {it.titulo ?? "Música removida"}
                                  {medleyCauda && <span className="tag lim" style={{ marginLeft: 8 }}>medley</span>}
                                </p>
                                <p className="ds">{it.artista ?? ""}</p>
                              </div>
                            </div>
                            {medleyCauda && it.observacaoMedley && (
                              <div className="tec-rep-medley-obs">"{it.observacaoMedley}"</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="vaz" style={{ border: 0 }}>Só momentos por agora, sem músicas.</div>
              )
            ) : (
              <div className="vaz" style={{ border: 0 }}>A Louvor ainda não montou o repertório deste domingo.</div>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="sect" data-tour="escala-bloco">
          <div className="cabecalho"><h3>Calendário</h3></div>
          <Calendario
            ano={ano} mes={mes} eventosMes={eventosMes} uid={uid}
            onMudarMes={mudarMes}
            onAbrirDia={(eventoId) => onIrEscala?.(eventoId)}
          />
        </div>
        <div className="sect">
          <div className="cabecalho"><h3>Servem contigo</h3></div>
          {ministerios.some((m) => (meuEvento.escala.lugares || []).find((l) => l.ministerioId === m.id)?.titularId && m.id !== meusLugaresHoje[0]?.ministerioId) ? (
            ministerios.map((m) => {
              const lugar = (meuEvento.escala.lugares || []).find((l) => l.ministerioId === m.id);
              if (!lugar?.titularId || meusLugaresHoje.some((l) => l.ministerioId === m.id)) return null;
              const titular = voluntarios.find((p) => p.id === lugar.titularId);
              const aprendiz = lugar.aprendizId ? voluntarios.find((p) => p.id === lugar.aprendizId) : null;
              const fs = funcoesCulto.filter((f) => f.ministerioId === m.id);
              const fe = fs.filter((f) => checklist[f.id]).length;
              if (!titular) return null;
              return (
                <LinhaPessoaContacto
                  key={m.id} pessoa={titular}
                  resumo={`${m.nome}${aprendiz ? ` · com ${aprendiz.nome} em treino` : ""} · ${fe} de ${fs.length} feitas`}
                  corMinisterio={m.cor}
                  funcoesDaPessoa={fs}
                  aberta={contactoAberto === titular.id}
                  onToggle={() => setContactoAberto((a) => (a === titular.id ? null : titular.id))}
                />
              );
            })
          ) : (
            <div className="vaz">Ninguém mais escalado ainda.</div>
          )}
        </div>
        <div className="sect">
          <div className="cabecalho"><h3>A base</h3></div>
          {/* Só o que NÃO tem entrada na barra de baixo. Equipamentos,
            * Culto e a Wiki saíram daqui: estavam repetidos, e a barra
            * é o caminho que a mão já conhece. Reembolsos e Solicitar BG
            * ficam porque este é o único sítio por onde se lá chega. */}
          {[
            ["reembolsos", "Reembolsos", "Nota e valor", () => onIrReembolsos?.()],
            ...(souLiderBase ? [["comunicacao", "Solicitar BG", "Peças gráficas, vídeo ou fotografia", () => setSheetComunicacao({ tipo: "lista" })]] : []),
          ].map(([k, t, d, ir]) => {
            const emCurso = k === "comunicacao" ? minhasSolicitacoes.filter((s) => s.status !== "entregue" && s.status !== "recusada").length : 0;
            return (
              <div className="linha" style={{ cursor: "pointer" }} key={k} onClick={ir}>
                <div style={{ flex: 1 }}>
                  <p className="nmt">{t}</p>
                  <p className="ds">{d}</p>
                </div>
                {emCurso ? <span className="tag" style={{ marginLeft: "auto" }}>{emCurso} em curso</span>
                  : <span className="seta">›</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
    {aResponderEnquete && enquetesDentroDoPrazo.length > 0 && (
      <SheetResponderEnquete
        enquetes={enquetesDentroDoPrazo} eventosPorId={eventosEnquete} minhasRespostas={minhasRespostas}
        onFechar={() => setAResponderEnquete(false)}
        onGuardado={(msg) => { setAResponderEnquete(false); torrada(msg); }}
      />
    )}
    {sheetComunicacao?.tipo === "lista" && (
      <SheetSolicitacoesBase
        solicitacoes={minhasSolicitacoes}
        onFechar={() => setSheetComunicacao(null)}
        onNovoPedido={() => setSheetComunicacao({ tipo: "abrir" })}
        onVerDetalhe={(s) => setSheetComunicacao({ tipo: "detalhe", solicitacao: s })}
      />
    )}
    {sheetComunicacao?.tipo === "abrir" && (
      <SheetAbrirSolicitacao
        onFechar={() => setSheetComunicacao({ tipo: "lista" })}
        onGuardado={(msg) => { setSheetComunicacao({ tipo: "lista" }); torrada(msg); }}
      />
    )}
    {sheetComunicacao?.tipo === "detalhe" && (
      <SheetDetalheSolicitacao
        solicitacao={minhasSolicitacoes.find((s) => s.id === sheetComunicacao.solicitacao.id) ?? sheetComunicacao.solicitacao}
        papel={papel}
        onFechar={() => setSheetComunicacao({ tipo: "lista" })}
        onExcluido={() => setSheetComunicacao({ tipo: "lista" })}
      />
    )}
    </>
  );
}
