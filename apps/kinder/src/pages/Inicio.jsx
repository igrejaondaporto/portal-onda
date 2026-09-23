import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { cEscala, souLider, souLiderGeral, minhaSalaRestrita, categoria, nomeCategoria, varsCategoria, CATEGORIAS, capacidadesPorSala, CRIANCAS_POR_VOLUNTARIO, CHECKIN_ATIVO } from "../lib/modelo";
import { ouvirVoluntarios, ouvirEventosDoMes, obterEventosDoMes, ouvirBase } from "../lib/painel";
import { obterMeuEvento } from "../lib/culto";
import { ouvirReembolsos } from "../lib/reembolsos";
import { ouvirInventario, ouvirListaCompraFechada } from "../lib/inventario";
import { licoesDaSala, licoesVistas } from "../lib/licoes";
import {
  hojeLocal, ouvirCriancas, ouvirCheckins,
  ouvirCapacitacoes, ouvirCapacitacoesDe, estadoCapacitacao,
  ouvirItensChecklist, ouvirMarcasChecklist, marcarItem, desmarcarItem,
} from "../lib/kinder";
import { dataPorExtenso, eur, nomeCurto, nomeEvento } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { ouvirMinhasSolicitacoes } from "@portal/shared/lib/solicitacoes.js";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";
import SheetSolicitacoesBase from "@portal/shared/components/SheetSolicitacoesBase.jsx";
import SheetAbrirSolicitacao from "@portal/shared/components/SheetAbrirSolicitacao.jsx";
import SheetDetalheSolicitacao from "@portal/shared/components/SheetDetalheSolicitacao.jsx";
import Calendario from "../components/Calendario";
import ItensChecklist from "../components/sala/ItensChecklist";
import ContagemCriancas from "../components/ContagemCriancas";
import RepertorioLouvorKinder from "../components/licao/RepertorioLouvorKinder";
import RecadoPastoral from "@portal/shared/components/RecadoPastoral.jsx";

function Destaque({ rotulo, titulo, detalhe, onClick, cor }) {
  return (
    <div className="destaque" style={cor ? { background: cor } : undefined} onClick={onClick}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>{rotulo}</p>
        <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>{titulo}</p>
        {detalhe && <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>{detalhe}</p>}
      </div>
      <span style={{ fontSize: 24 }}>›</span>
    </div>
  );
}

export default function Inicio({
  uid, papel, pessoa, mes, ano, mudarMes, ativo, definirCabecalho, licoes,
  onIrEscala, onIrCheckin, onIrCulto, onIrInventario, onIrLicao, onIrReembolsos,
}) {
  const torrada = useTorrada();
  const lider = souLider(papel);
  const liderGeral = souLiderGeral(papel);
  const minhaSala = pessoa?.categoria ?? null;
  // presa à sua sala em tudo, exceto Escala (a única excepção — ver
  // lib/modelo.js) — só a líder geral vê as três.
  const restrita = minhaSalaRestrita(papel, pessoa);
  const hoje = hojeLocal();
  const [base, setBase] = useState(null);
  const [meuEvento, setMeuEvento] = useState(null);
  const [voluntarios, setVoluntarios] = useState([]);
  const [eventosMes, setEventosMes] = useState([]);
  const [criancas, setCriancas] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [capacitacoes, setCapacitacoes] = useState([]);
  const [minhasCaps, setMinhasCaps] = useState({});
  const [inventario, setInventario] = useState([]);
  const [listaComprasFechada, setListaComprasFechada] = useState(null);
  const [pendentesReembolso, setPendentesReembolso] = useState([]);
  const [contactoAberto, setContactoAberto] = useState(null);
  const [minhasSolicitacoes, setMinhasSolicitacoes] = useState([]);
  const [sheetComunicacao, setSheetComunicacao] = useState(null);
  const [eventoChecklist, setEventoChecklist] = useState(null);
  const [itensChecklist, setItensChecklist] = useState([]);
  const [marcasChecklist, setMarcasChecklist] = useState({});

  useEffect(() => ouvirBase(setBase), []);
  useEffect(() => { obterMeuEvento(uid).then(setMeuEvento); }, [uid]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirCriancas(setCriancas), []);
  useEffect(() => ouvirCheckins(hoje, setCheckins), [hoje]);
  useEffect(() => ouvirCapacitacoes(setCapacitacoes), []);
  useEffect(() => ouvirCapacitacoesDe(uid, setMinhasCaps), [uid]);
  useEffect(() => ouvirInventario(setInventario), []);
  useEffect(() => {
    // a lista de compras não tem sala — é sempre a líder geral quem compra
    if (!liderGeral) return;
    return ouvirListaCompraFechada(setListaComprasFechada);
  }, [liderGeral]);
  useEffect(() => {
    // reembolsos não têm sala — aprovar é sempre da líder geral
    if (!liderGeral) return;
    return ouvirReembolsos(true, uid, (l) => setPendentesReembolso(l.filter((r) => r.estado === "submetido")));
  }, [liderGeral, uid]);
  useEffect(() => { if (lider) return ouvirMinhasSolicitacoes(setMinhasSolicitacoes); }, [lider]);

  // culto da checklist: o próximo a sério (hoje ou por vir), nunca
  // preso ao mês que o calendário do Início está a mostrar — mesmo
  // cálculo de ChecklistSala.jsx.
  useEffect(() => {
    const agora = new Date();
    const seguinte = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
    Promise.all([obterEventosDoMes(agora.getFullYear(), agora.getMonth()), obterEventosDoMes(seguinte.getFullYear(), seguinte.getMonth())])
      .then(([a, b]) => setEventoChecklist([...a, ...b].find((e) => e.data >= hoje) ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => ouvirItensChecklist(setItensChecklist), []);
  useEffect(() => {
    if (!eventoChecklist || !restrita) return;
    return ouvirMarcasChecklist(eventoChecklist.id, restrita, setMarcasChecklist);
  }, [eventoChecklist, restrita]);

  // a escala do culto em que sirvo tem de ser ao vivo
  useEffect(() => {
    if (!meuEvento?.id) return;
    return onSnapshot(cEscala(meuEvento.id), (esc) => {
      const escala = esc.exists() ? esc.data() : { pessoas: [], mestras: {} };
      setMeuEvento((ev) => (ev && ev.id === meuEvento.id ? { ...ev, escala } : ev));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meuEvento?.id]);

  const sirvo = !!meuEvento && meuEvento.escala.pessoas.includes(uid);
  // a Kinder não tem líder de escala único — cada sala tem a sua
  // Mestra (ver SheetEscala/guardarMestraKinder); aqui só interessa a
  // da minha própria sala.
  const mestraDaMinhaSalaId = minhaSala ? meuEvento?.escala.mestras?.[minhaSala] : null;
  const mestraDaMinhaSalaNome = mestraDaMinhaSalaId ? voluntarios.find((p) => p.id === mestraDaMinhaSalaId)?.nome : null;
  const chegada = meuEvento?.horaChegada || base?.horaChegada || "08:30";
  const eventoHoje = eventosMes.find((ev) => ev.data === hoje) ?? null;
  const proximoCulto = eventosMes.find((ev) => ev.data >= hoje) ?? null;

  const naSala = checkins.filter((c) => !c.anulado && !c.saidaEm);
  const salasVisiveis = restrita ? CATEGORIAS.filter((c) => c.id === restrita) : CATEGORIAS;
  const naSalaVisivel = restrita ? naSala.filter((c) => c.categoria === restrita) : naSala;
  const porSala = Object.fromEntries(CATEGORIAS.map((c) => [c.id, naSala.filter((k) => k.categoria === c.id).length]));
  const capacidades = capacidadesPorSala(eventoHoje?.escala.pessoas ?? [], voluntarios);
  const criancaPorId = Object.fromEntries(criancas.map((c) => [c.id, c]));
  const comCuidados = naSalaVisivel
    .map((k) => criancaPorId[k.criancaId])
    .filter((c) => c && (c.alergias || c.restricoesAlimentares || c.necessidades));

  const vistas = licoesVistas(uid);
  const minhasLicoes = licoesDaSala(licoes, restrita);
  const licaoSemana = minhasLicoes[0] ?? null;
  const semLicaoHoje = (c) => proximoCulto && !licoes.some((l) => l.eventoId === proximoCulto.id && (l.categorias || []).includes(c));
  const salasSemLicao = !lider || !proximoCulto
    ? []
    : liderGeral
      ? CATEGORIAS.filter((c) => semLicaoHoje(c.id))
      : (restrita && semLicaoHoje(restrita) ? [categoria(restrita)] : []);
  const capsEmFalta = capacitacoes.filter((c) => c.obrigatoria && estadoCapacitacao(c, minhasCaps[c.id]) !== "ok");
  const faltaInventario = inventario.filter((i) => i.quantidade <= i.minimo).length;

  const itensDaMinhaSala = restrita ? itensChecklist.filter((i) => i.categoria === restrita || i.categoria === "todas") : [];
  const feitosChecklist = itensDaMinhaSala.filter((i) => marcasChecklist[i.id]).length;

  function alternarChecklist(item) {
    if (!eventoChecklist || !restrita) return;
    const escrita = marcasChecklist[item.id]
      ? desmarcarItem(eventoChecklist.id, restrita, item.id)
      : marcarItem(eventoChecklist.id, restrita, item.id, uid);
    escrita.catch((e) => torrada(e.message || "Não foi possível atualizar.", true));
  }

  useEffect(() => {
    if (!ativo) return;
    const titulo = <>Olá, <em>{nomeCurto(pessoa?.nome) ?? "…"}</em></>;
    if (!meuEvento) { definirCabecalho({ titulo, subtitulo: "", chips: [] }); return; }
    definirCabecalho({
      titulo,
      subtitulo: sirvo
        ? `Serves no ${meuEvento.tipo || "domingo"}, ${dataPorExtenso(meuEvento.data)}`
        : `Ainda não estás escalado — próximo culto: ${dataPorExtenso(meuEvento.data)}`,
      chips: [
        minhaSala ? `Sala ${nomeCategoria(minhaSala)}` : liderGeral ? "As três salas" : "Sem sala definida",
        ...(sirvo ? [`Chegada ${chegada}`, ...(minhaSala ? [`Mestra · ${mestraDaMinhaSalaNome ?? "por definir"}`] : [])] : []),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, meuEvento, pessoa, sirvo, mestraDaMinhaSalaNome, chegada, minhaSala]);

  const servemComigo = (meuEvento?.escala.pessoas || [])
    .filter((id) => id !== uid)
    .map((id) => voluntarios.find((p) => p.id === id))
    .filter((p) => p && (liderGeral || !minhaSala || !p.categoria || p.categoria === minhaSala));

  return (
    <>
      <RecadoPastoral papel={papel} />
      {salasSemLicao.length > 0 && (
        <Destaque
          rotulo="A precisar de ti" titulo={`Falta a lição de ${salasSemLicao.map((c) => c.nome).join(", ")}`}
          detalhe={nomeEvento(proximoCulto)} onClick={() => onIrLicao?.("licoes")}
        />
      )}
      {!lider && capsEmFalta.length > 0 && (
        <Destaque
          rotulo="Capacitações" titulo={`${capsEmFalta.length} por fazer ou por renovar`}
          detalhe={capsEmFalta.map((c) => c.titulo).slice(0, 2).join(" · ")} onClick={() => onIrLicao?.("capacitacoes")}
        />
      )}
      {liderGeral && listaComprasFechada && (
        <Destaque
          rotulo="A precisar de ti" titulo="Lista de compras para rever"
          detalhe={`${(listaComprasFechada.itens || []).length} ${(listaComprasFechada.itens || []).length === 1 ? "item" : "itens"}`}
          onClick={() => onIrInventario?.()}
        />
      )}
      {liderGeral && pendentesReembolso.length > 0 && (
        <Destaque
          rotulo="A precisar de ti" titulo={`${pendentesReembolso.length} ${pendentesReembolso.length === 1 ? "pedido" : "pedidos"} de reembolso`}
          detalhe={`${voluntarios.find((p) => p.id === pendentesReembolso[0].pessoaId)?.nome ?? ""} · ${eur(pendentesReembolso[0].valor)}`}
          onClick={onIrReembolsos}
        />
      )}

      <div className="duas">
        <div>
          <ContagemCriancas eventoId={eventoHoje?.id ?? null} lider={lider} liderGeral={liderGeral} restrita={restrita} />

          {CHECKIN_ATIVO && eventoHoje && (
            <div className="sect" data-tour="hoje-bloco">
              <div className="cabecalho"><h3>Hoje nas salas</h3><span className="cap">{naSalaVisivel.length} crianças</span></div>
              <div className="kin-grelha" style={{ gridTemplateColumns: `repeat(${salasVisiveis.length}, 1fr)` }}>
                {salasVisiveis.map((c) => {
                  const cap = capacidades[c.id];
                  const noLimite = cap > 0 && porSala[c.id] >= cap;
                  return (
                    <div className={`kin-num${noLimite ? " no-limite" : ""}`} key={c.id} style={varsCategoria(c.id)}>
                      <b>{porSala[c.id]}{cap > 0 ? <small>/{cap}</small> : ""}</b><span>{c.nome}</span>
                    </div>
                  );
                })}
              </div>
              {salasVisiveis.some((c) => capacidades[c.id] > 0 && porSala[c.id] >= capacidades[c.id]) && (
                <p className="ds" style={{ marginTop: 8 }}>Capacidade: {CRIANCAS_POR_VOLUNTARIO} crianças por voluntário na sala.</p>
              )}
              {comCuidados.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p className="rot" style={{ marginTop: 0 }}>Atenção{restrita ? ` na sala ${nomeCategoria(restrita)}` : ""}</p>
                  {comCuidados.map((c) => (
                    <div className="linha" key={c.id}>
                      <div style={{ flex: 1 }}>
                        <p className="nmt">{c.nome}</p>
                        {c.alergias && <span className="kin-alerta">Alergias: {c.alergias}</span>}
                        {c.restricoesAlimentares && <span className="kin-alerta info">{c.restricoesAlimentares}</span>}
                        {c.necessidades && <span className="kin-alerta info">{c.necessidades}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn full" style={{ marginTop: 14 }} onClick={onIrCheckin}>Abrir o check-in</button>
            </div>
          )}

          {restrita && eventoChecklist && (
            <div className="sect" data-tour="checklist-bloco">
              <div className="cabecalho"><h3>Checklist da sala</h3><span className="cap">{feitosChecklist} de {itensDaMinhaSala.length}</span></div>
              <ItensChecklist
                itens={itensDaMinhaSala} marcas={marcasChecklist} voluntarios={voluntarios} sala={restrita}
                onAlternar={alternarChecklist} mostrarFasesVazias={false}
              />
              {itensDaMinhaSala.length === 0 && <div className="vaz">Ainda sem itens de checklist para a tua sala.</div>}
            </div>
          )}

          <div className="sect" data-tour="licao-bloco">
            <div className="cabecalho"><h3>Lição</h3></div>
            {licaoSemana ? (
              <div className="kin-faixa" style={{ ...varsCategoria(licaoSemana.categorias?.[0]), cursor: "pointer" }} onClick={() => onIrLicao?.("licoes")}>
                <div className="kin-faixa-cab">
                  <h4>{licaoSemana.titulo}</h4>
                  {!vistas.has(licaoSemana.id) && <span className="tag lim">Nova</span>}
                </div>
                <div style={{ marginTop: 6 }}>
                  {(licaoSemana.categorias || []).map((c) => (
                    <span key={c} className="kin-tagcat" style={{ ...varsCategoria(c), marginRight: 6 }}>{nomeCategoria(c)}</span>
                  ))}
                </div>
                {(licaoSemana.atividades?.length > 0 || licaoSemana.recursos?.length > 0) && (
                  <p className="ds" style={{ marginTop: 8 }}>
                    {licaoSemana.atividades?.length > 0 && `${licaoSemana.atividades.length} ${licaoSemana.atividades.length === 1 ? "atividade" : "atividades"}`}
                    {licaoSemana.atividades?.length > 0 && licaoSemana.recursos?.length > 0 ? " · " : ""}
                    {licaoSemana.recursos?.length > 0 && `${licaoSemana.recursos.length} ${licaoSemana.recursos.length === 1 ? "recurso" : "recursos"}`}
                  </p>
                )}
              </div>
            ) : (
              <div className="vaz">Ainda não há lição para a tua sala.</div>
            )}
            {proximoCulto && <RepertorioLouvorKinder eventoId={proximoCulto.id} />}
          </div>

          <div className="sect">
            <div className="cabecalho"><h3>A tua sala</h3></div>
            {[
              ["checklist", "Checklist da sala", "Pré-culto, durante e pós-culto", () => onIrCulto?.("checklist"), null],
              ["inventario", "Inventário", lider ? "Materiais e lista de compras" : "Material da sala", () => onIrInventario?.(), faltaInventario ? `${faltaInventario} em falta` : null],
              ["reembolsos", "Reembolsos", "Nota e valor", onIrReembolsos, null],
              ...(lider ? [["comunicacao", "Solicitar BG", "Peças gráficas, vídeo ou fotografia", () => setSheetComunicacao({ tipo: "lista" }), null]] : []),
            ].map(([k, t, d, ir, tag]) => (
              <div className="linha" style={{ cursor: "pointer" }} key={k} onClick={ir}>
                <div style={{ flex: 1 }}><p className="nmt">{t}</p><p className="ds">{d}</p></div>
                {tag ? <span className="tag" style={{ marginLeft: "auto" }}>{tag}</span> : <span className="seta">›</span>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="sect" data-tour="escala-bloco">
            <div className="cabecalho"><h3>Calendário</h3></div>
            <Calendario ano={ano} mes={mes} eventosMes={eventosMes} uid={uid} onMudarMes={mudarMes} onAbrirDia={(id) => onIrEscala?.(id)} />
          </div>
          {meuEvento && sirvo && (
            <div className="sect">
              <div className="cabecalho"><h3>Servem contigo</h3><span className="cap">{dataPorExtenso(meuEvento.data)}</span></div>
              {servemComigo.length ? servemComigo.map((p) => (
                <LinhaPessoaContacto
                  key={p.id} pessoa={p}
                  resumo={p.categoria ? `Sala ${nomeCategoria(p.categoria)}` : "Geral"}
                  funcoesDaPessoa={[]}
                  tagExtra={p.categoria && meuEvento.escala.mestras?.[p.categoria] === p.id ? <span className="tag lim">Mestra</span> : null}
                  aberta={contactoAberto === p.id}
                  onToggle={() => setContactoAberto((a) => (a === p.id ? null : p.id))}
                />
              )) : <div className="vaz">Ninguém mais escalado na tua sala ainda.</div>}
            </div>
          )}
        </div>
      </div>

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
