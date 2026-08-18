import { useEffect, useState } from "react";
import { FASES, funcoesDoCulto, podeDistribuir } from "../lib/modelo";
import { ouvirVoluntarios, ouvirFuncoes, ouvirEventosDoMes, reordenarFuncoes } from "../lib/painel";
import { ouvirAtribuicoes, ouvirChecklist, atribuirFuncao, obterMeuEvento } from "../lib/culto";
import { MESES, dataPorExtenso, dataCurta } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import LinhaFuncao from "../components/funcoes/LinhaFuncao";
import SheetEscolher from "../components/funcoes/SheetEscolher";
import SheetFuncao from "../components/painel/SheetFuncao";

export default function Funcoes({ uid, papel, eventoIdFoco, focoSeq, mes, ano, mudarMes, irParaMesDoEvento, ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const [eventoId, setEventoId] = useState(eventoIdFoco ?? null);
  const [eventosMes, setEventosMes] = useState([]);
  const [funcoes, setFuncoes] = useState([]);
  const [atribuicoes, setAtribuicoes] = useState({});
  const [checklist, setChecklist] = useState({});
  const [voluntarios, setVoluntarios] = useState([]);
  const [aberta, setAberta] = useState(null);
  const [sheet, setSheet] = useState(null);

  // o alvo (toque num dia, ou "o meu próximo culto" por omissão) manda
  // no mês partilhado com a Escala/Culto — sem isto, chegar aqui vindo
  // de um culto de outro mês mostrava as setas apontando para o mês
  // errado. focoSeq muda a cada navegação para aqui, mesmo que o alvo
  // seja o mesmo de antes.
  useEffect(() => {
    if (eventoIdFoco) {
      setEventoId(eventoIdFoco);
      irParaMesDoEvento(eventoIdFoco);
    } else {
      obterMeuEvento(uid).then((ev) => {
        if (!ev) return;
        setEventoId(ev.id);
        irParaMesDoEvento(ev.id);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, eventoIdFoco, focoSeq]);

  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirFuncoes(setFuncoes), []);

  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);

  // as setas ‹ › trocam de mês sem passar por eventoIdFoco — quando o
  // culto selecionado já não está na lista, cai no primeiro do mês novo
  useEffect(() => {
    if (!eventosMes.length) { setEventoId(null); return; }
    setEventoId((atual) => (eventosMes.some((e) => e.id === atual) ? atual : eventosMes[0].id));
  }, [eventosMes]);

  useEffect(() => {
    if (!eventoId) return;
    const p1 = ouvirAtribuicoes(eventoId, setAtribuicoes);
    const p2 = ouvirChecklist(eventoId, setChecklist);
    return () => { p1(); p2(); };
  }, [eventoId]);

  const evento = eventosMes.find((e) => e.id === eventoId);
  const funcoesCulto = evento ? funcoesDoCulto(funcoes, evento.id) : [];
  const especiais = evento ? funcoes.filter((f) => f.eventoId === evento.id) : [];
  const pode = evento ? podeDistribuir(papel, uid, evento.escala) : false;
  const titularId = evento?.escala.liderEscala ?? null;
  const nomeLiderEscala = titularId
    ? voluntarios.find((p) => p.id === titularId)?.nome
    : null;
  const nomeLiderBase = voluntarios.find((p) => p.papel === "lider_base")?.nome ?? "líder da base";

  // é sempre a pessoa escalada a fazer tudo — por isso, uma função sem
  // atribuição própria (nenhum documento gravado, `atribuirFuncao`
  // nunca chamado para ela) mostra-se já com o titular do dia. É só
  // aparência: uma função "limpa" de propósito (documento gravado com
  // `pessoas: []`) fica mesmo vazia — não volta a mostrar o titular.
  const atribuicoesEfetivas = { ...atribuicoes };
  if (titularId) {
    funcoesCulto.forEach((f) => {
      if (!(f.id in atribuicoesEfetivas)) atribuicoesEfetivas[f.id] = [titularId];
    });
  }

  useEffect(() => {
    if (!ativo || !evento) return;
    definirCabecalho({
      titulo: "Funções",
      subtitulo: evento.tipo ? `${evento.tipo} · ${dataPorExtenso(evento.data)}` : "Toca numa função para ver como se faz",
      chips: [
        dataCurta(evento.data),
        nomeLiderEscala ? `Líder de escala · ${nomeLiderEscala}` : "Líder por definir",
        `${funcoesCulto.length} funções${especiais.length ? ` · ${especiais.length} só deste culto` : ""}`,
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, evento, funcoesCulto.length, especiais.length, nomeLiderEscala]);

  async function alternar(funcaoId, pessoaId) {
    const atuais = atribuicoesEfetivas[funcaoId] || [];
    const novo = atuais.includes(pessoaId) ? atuais.filter((x) => x !== pessoaId) : [...atuais, pessoaId];
    try {
      await atribuirFuncao(evento.id, funcaoId, novo);
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    }
  }

  async function mover(doF, indice, direcao) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= doF.length) return;
    const nova = [...doF];
    [nova[indice], nova[alvo]] = [nova[alvo], nova[indice]];
    try {
      await reordenarFuncoes(nova);
    } catch (e) {
      torrada(e.message || "Não foi possível reordenar.");
    }
  }

  async function limpar(funcaoId) {
    try {
      await atribuirFuncao(evento.id, funcaoId, []);
      torrada(`${funcoes.find((f) => f.id === funcaoId)?.nome} ficou por atribuir`);
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    }
  }

  if (!evento) return null;

  return (
    <>
      <div className="cabecalho" style={{ paddingTop: 14 }}>
        <h3>{MESES[mes]} {ano}</h3>
        <span className="calnav">
          <button className="calbt" onClick={() => mudarMes(-1)}>‹</button>
          <button className="calbt" onClick={() => mudarMes(1)}>›</button>
        </span>
      </div>
      {!eventosMes.length && <div className="vaz">Sem cultos marcados neste mês.</div>}
      <div className="menu" style={{ position: "static", border: 0, padding: "4px 0 4px", background: "none", backdropFilter: "none" }}>
        {eventosMes.map((e) => (
          <button key={e.id} data-on={e.id === evento.id ? 1 : 0} onClick={() => setEventoId(e.id)}>
            {e.tipo ? "✦ " : ""}{dataCurta(e.data)}
          </button>
        ))}
      </div>

      {pode ? (
        <div className="caixa" style={{ background: "var(--agua)", border: 0 }}>
          <p style={{ fontSize: 13.5, fontWeight: 600 }}>Podes distribuir as funções deste domingo</p>
          <p className="ds" style={{ marginTop: 4 }}>
            {souLiderBase ? "És líder da base, podes editar qualquer data." : `És o líder de escala de ${dataPorExtenso(evento.data)}. Só podes editar este domingo.`}
            {" "}Cada função aceita mais do que uma pessoa.
          </p>
          <p className="ds" style={{ marginTop: 4 }}>
            Ao escalar alguém, essa pessoa já fica responsável por todas as funções do dia — muda ou acrescenta quem quiseres aqui.
          </p>
        </div>
      ) : (
        <div className="caixa">
          <p className="ds">
            {nomeLiderEscala ? `${nomeLiderEscala} é o líder de escala deste domingo e é quem distribui as funções.` : "O líder de escala ainda não foi definido."}
          </p>
        </div>
      )}

      {pode && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {souLiderBase && (
            <button
              className="btn sec" style={{ flex: 1, minWidth: 150, padding: "12px 10px", fontSize: 13.5 }}
              onClick={() => setSheet({ tipo: "funcao", funcaoId: null })}
            >
              Nova função do catálogo
            </button>
          )}
          <button
            className="btn sec" style={{ flex: 1, minWidth: 150, padding: "12px 10px", fontSize: 13.5 }}
            onClick={() => setSheet({ tipo: "funcao", funcaoId: null, soDesteEvento: true })}
          >
            Nova função só deste culto
          </button>
        </div>
      )}

      {FASES.map(([k, t, d]) => {
        const doF = funcoesCulto.filter((f) => f.fase === k);
        if (!doF.length) return null;
        const semDono = doF.filter((f) => !(atribuicoesEfetivas[f.id] || []).length).length;
        return (
          <div key={k}>
            <div className="fasecab"><h4>{t}</h4><span>{d}</span><em>{semDono ? `${semDono} livres` : "completo"}</em></div>
            {doF.map((f, i) => (
              <LinhaFuncao
                key={f.id} f={f} ids={atribuicoesEfetivas[f.id] || []} voluntarios={voluntarios}
                feita={!!checklist[f.id]} aberta={aberta === f.id} pode={pode} souLiderBase={souLiderBase}
                uid={uid} nomeLiderBase={nomeLiderBase}
                onAbrir={() => setAberta(aberta === f.id ? null : f.id)}
                onEscolher={() => setSheet({ tipo: "escolher", funcaoId: f.id })}
                onEditar={() => setSheet({ tipo: "funcao", funcaoId: f.id })}
                onSubir={() => mover(doF, i, -1)} onDescer={() => mover(doF, i, 1)}
                primeira={i === 0} ultima={i === doF.length - 1}
              />
            ))}
          </div>
        );
      })}

      {sheet?.tipo === "escolher" && (
        <SheetEscolher
          funcao={funcoes.find((f) => f.id === sheet.funcaoId)}
          evento={evento} voluntarios={voluntarios} atribuicoes={atribuicoesEfetivas}
          onFechar={() => setSheet(null)}
          onAlternar={(pid) => alternar(sheet.funcaoId, pid)}
          onLimpar={() => { limpar(sheet.funcaoId); setSheet(null); }}
        />
      )}
      {sheet?.tipo === "funcao" && (
        <SheetFuncao
          funcao={sheet.funcaoId ? funcoes.find((f) => f.id === sheet.funcaoId) : null}
          eventosDisponiveis={eventosMes}
          eventoAtual={sheet.soDesteEvento || !souLiderBase ? evento.id : null}
          souLiderBase={souLiderBase}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}
