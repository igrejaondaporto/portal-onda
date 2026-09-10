import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { cEscala, souLider, nomeCategoria, varsCategoria, CATEGORIAS, capacidadesPorSala, CRIANCAS_POR_VOLUNTARIO } from "../lib/modelo";
import { ouvirVoluntarios, ouvirEventosDoMes, ouvirBase } from "../lib/painel";
import { obterMeuEvento } from "../lib/culto";
import { ouvirReembolsos } from "../lib/reembolsos";
import { ouvirInventario } from "../lib/inventario";
import { licoesDaSala, licoesVistas } from "../lib/licoes";
import {
  hojeLocal, ouvirFamilias, ouvirCriancas, ouvirCheckins,
  ouvirCapacitacoes, ouvirCapacitacoesDe, estadoCapacitacao,
} from "../lib/kinder";
import { dataPorExtenso, eur, nomeCurto, nomeEvento } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { ouvirMinhasSolicitacoes } from "@portal/shared/lib/solicitacoes.js";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";
import SheetSolicitacoesBase from "@portal/shared/components/SheetSolicitacoesBase.jsx";
import SheetAbrirSolicitacao from "@portal/shared/components/SheetAbrirSolicitacao.jsx";
import SheetDetalheSolicitacao from "@portal/shared/components/SheetDetalheSolicitacao.jsx";
import Calendario from "../components/Calendario";

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
  onIrEscala, onIrCheckin, onIrCulto, onIrLicao, onIrReembolsos,
}) {
  const torrada = useTorrada();
  const lider = souLider(papel);
  const minhaSala = pessoa?.categoria ?? null;
  const hoje = hojeLocal();
  const [base, setBase] = useState(null);
  const [meuEvento, setMeuEvento] = useState(null);
  const [voluntarios, setVoluntarios] = useState([]);
  const [eventosMes, setEventosMes] = useState([]);
  const [familias, setFamilias] = useState([]);
  const [criancas, setCriancas] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [capacitacoes, setCapacitacoes] = useState([]);
  const [minhasCaps, setMinhasCaps] = useState({});
  const [inventario, setInventario] = useState([]);
  const [pendentesReembolso, setPendentesReembolso] = useState([]);
  const [contactoAberto, setContactoAberto] = useState(null);
  const [minhasSolicitacoes, setMinhasSolicitacoes] = useState([]);
  const [sheetComunicacao, setSheetComunicacao] = useState(null);

  useEffect(() => ouvirBase(setBase), []);
  useEffect(() => { obterMeuEvento(uid).then(setMeuEvento); }, [uid]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => ouvirFamilias(setFamilias), []);
  useEffect(() => ouvirCriancas(setCriancas), []);
  useEffect(() => ouvirCheckins(hoje, setCheckins), [hoje]);
  useEffect(() => ouvirCapacitacoes(setCapacitacoes), []);
  useEffect(() => ouvirCapacitacoesDe(uid, setMinhasCaps), [uid]);
  useEffect(() => ouvirInventario(setInventario), []);
  useEffect(() => {
    if (!lider) return;
    return ouvirReembolsos(true, uid, (l) => setPendentesReembolso(l.filter((r) => r.estado === "submetido")));
  }, [lider, uid]);
  useEffect(() => { if (lider) return ouvirMinhasSolicitacoes(setMinhasSolicitacoes); }, [lider]);

  // a escala do culto em que sirvo tem de ser ao vivo
  useEffect(() => {
    if (!meuEvento?.id) return;
    return onSnapshot(cEscala(meuEvento.id), (esc) => {
      const escala = esc.exists() ? esc.data() : { pessoas: [], liderEscala: null };
      setMeuEvento((ev) => (ev && ev.id === meuEvento.id ? { ...ev, escala } : ev));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meuEvento?.id]);

  const sirvo = !!meuEvento && meuEvento.escala.pessoas.includes(uid);
  const liderEscalaNome = meuEvento?.escala.liderEscala ? voluntarios.find((p) => p.id === meuEvento.escala.liderEscala)?.nome : null;
  const chegada = meuEvento?.horaChegada || base?.horaChegada || "08:30";
  const eventoHoje = eventosMes.find((ev) => ev.data === hoje) ?? null;
  const proximoCulto = eventosMes.find((ev) => ev.data >= hoje) ?? null;

  const pendentes = familias.filter((f) => f.estado === "pendente");
  const naSala = checkins.filter((c) => !c.anulado && !c.saidaEm);
  const porSala = Object.fromEntries(CATEGORIAS.map((c) => [c.id, naSala.filter((k) => k.categoria === c.id).length]));
  const capacidades = capacidadesPorSala(eventoHoje?.escala.pessoas ?? [], voluntarios);
  const criancaPorId = Object.fromEntries(criancas.map((c) => [c.id, c]));
  const comCuidados = naSala
    .filter((k) => lider || !minhaSala || k.categoria === minhaSala)
    .map((k) => criancaPorId[k.criancaId])
    .filter((c) => c && (c.alergias || c.restricoesAlimentares || c.necessidades));

  const vistas = licoesVistas(uid);
  const minhasLicoes = licoesDaSala(licoes, lider ? null : minhaSala);
  const licaoSemana = minhasLicoes[0] ?? null;
  const salasSemLicao = lider && proximoCulto
    ? CATEGORIAS.filter((c) => !licoes.some((l) => l.eventoId === proximoCulto.id && (l.categorias || []).includes(c.id)))
    : [];
  const capsEmFalta = capacitacoes.filter((c) => c.obrigatoria && estadoCapacitacao(c, minhasCaps[c.id]) !== "ok");
  const faltaInventario = inventario.filter((i) => i.quantidade <= i.minimo).length;

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
        minhaSala ? `Sala ${nomeCategoria(minhaSala)}` : lider ? "As três salas" : "Sem sala definida",
        ...(sirvo ? [`Chegada ${chegada}`, `Líder de escala · ${liderEscalaNome ?? "por definir"}`] : []),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, meuEvento, pessoa, sirvo, liderEscalaNome, chegada, minhaSala]);

  const servemComigo = (meuEvento?.escala.pessoas || [])
    .filter((id) => id !== uid)
    .map((id) => voluntarios.find((p) => p.id === id))
    .filter((p) => p && (lider || !minhaSala || !p.categoria || p.categoria === minhaSala));

  return (
    <>
      {lider && pendentes.length > 0 && (
        <Destaque
          rotulo="Registos pelo QR" titulo={`${pendentes.length} ${pendentes.length === 1 ? "família à espera" : "famílias à espera"} de confirmação`}
          detalhe="Confirmam-se sozinhas no primeiro check-in" onClick={onIrCheckin}
        />
      )}
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
      {lider && pendentesReembolso.length > 0 && (
        <Destaque
          rotulo="A precisar de ti" titulo={`${pendentesReembolso.length} ${pendentesReembolso.length === 1 ? "pedido" : "pedidos"} de reembolso`}
          detalhe={`${voluntarios.find((p) => p.id === pendentesReembolso[0].pessoaId)?.nome ?? ""} · ${eur(pendentesReembolso[0].valor)}`}
          onClick={onIrReembolsos}
        />
      )}

      <div className="duas">
        <div>
          {eventoHoje && (
            <div className="sect" data-tour="hoje-bloco">
              <div className="cabecalho"><h3>Hoje nas salas</h3><span className="cap">{naSala.length} crianças</span></div>
              <div className="kin-grelha">
                {CATEGORIAS.map((c) => {
                  const cap = capacidades[c.id];
                  const noLimite = cap > 0 && porSala[c.id] >= cap;
                  return (
                    <div className={`kin-num${noLimite ? " no-limite" : ""}`} key={c.id} style={varsCategoria(c.id)}>
                      <b>{porSala[c.id]}{cap > 0 ? <small>/{cap}</small> : ""}</b><span>{c.nome}</span>
                    </div>
                  );
                })}
              </div>
              {CATEGORIAS.some((c) => capacidades[c.id] > 0 && porSala[c.id] >= capacidades[c.id]) && (
                <p className="ds" style={{ marginTop: 8 }}>Capacidade: {CRIANCAS_POR_VOLUNTARIO} crianças por voluntário na sala.</p>
              )}
              {comCuidados.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p className="rot" style={{ marginTop: 0 }}>Atenção{minhaSala && !lider ? ` na sala ${nomeCategoria(minhaSala)}` : ""}</p>
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
                {licaoSemana.materiais?.length > 0 && (
                  <p className="ds" style={{ marginTop: 8 }}>Materiais: {licaoSemana.materiais.join(", ")}</p>
                )}
              </div>
            ) : (
              <div className="vaz">Ainda não há lição para a tua sala.</div>
            )}
          </div>

          <div className="sect">
            <div className="cabecalho"><h3>A tua sala</h3></div>
            {[
              ["checklist", "Checklist da sala", "Abrir e fechar a sala", () => onIrCulto?.("checklist"), null],
              ["inventario", "Inventário", "Materiais das salas", () => onIrCulto?.("inventario"), faltaInventario ? `${faltaInventario} em falta` : null],
              ["contagem", "Contagem e ocorrências", "Quantas crianças, o que aconteceu", () => onIrCulto?.("contagem"), null],
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
                  tagExtra={meuEvento.escala.liderEscala === p.id ? <span className="tag lim">Líder de escala</span> : null}
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
