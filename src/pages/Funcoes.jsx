import { useEffect, useState } from "react";
import { FASES, funcoesDoCulto, podeDistribuir } from "../lib/modelo";
import { ouvirVoluntarios, ouvirFuncoes, obterEventosDoMes } from "../lib/painel";
import { ouvirAtribuicoes, ouvirChecklist, atribuirFuncao, obterMeuEvento } from "../lib/culto";
import { dataPorExtenso, dataCurta } from "../lib/data";
import { useTorrada } from "../lib/TorradaContext";
import LinhaFuncao from "../components/funcoes/LinhaFuncao";
import SheetEscolher from "../components/funcoes/SheetEscolher";
import SheetFuncao from "../components/painel/SheetFuncao";

export default function Funcoes({ uid, papel, eventoIdFoco, definirCabecalho }) {
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

  useEffect(() => {
    if (eventoIdFoco) setEventoId(eventoIdFoco);
    else obterMeuEvento(uid).then((ev) => setEventoId(ev?.id ?? null));
  }, [uid, eventoIdFoco]);

  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirFuncoes(setFuncoes), []);

  useEffect(() => {
    if (!eventoId) return;
    const ano = Number(eventoId.slice(0, 4)), mes = Number(eventoId.slice(5, 7)) - 1;
    obterEventosDoMes(ano, mes).then(setEventosMes);
  }, [eventoId]);

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
  const nomeLiderEscala = evento?.escala.liderEscala
    ? voluntarios.find((p) => p.id === evento.escala.liderEscala)?.nome
    : null;
  const nomeLiderBase = voluntarios.find((p) => p.papel === "lider_base")?.nome ?? "líder da base";

  useEffect(() => {
    if (!evento) return;
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
  }, [evento, funcoesCulto.length, especiais.length, nomeLiderEscala]);

  async function alternar(funcaoId, pessoaId) {
    const atuais = atribuicoes[funcaoId] || [];
    const novo = atuais.includes(pessoaId) ? atuais.filter((x) => x !== pessoaId) : [...atuais, pessoaId];
    try {
      await atribuirFuncao(evento.id, funcaoId, novo);
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
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
      <div className="menu" style={{ position: "static", border: 0, padding: "14px 0 4px", background: "none", backdropFilter: "none" }}>
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
        const semDono = doF.filter((f) => !(atribuicoes[f.id] || []).length).length;
        return (
          <div key={k}>
            <div className="fasecab"><h4>{t}</h4><span>{d}</span><em>{semDono ? `${semDono} livres` : "completo"}</em></div>
            {doF.map((f) => (
              <LinhaFuncao
                key={f.id} f={f} ids={atribuicoes[f.id] || []} voluntarios={voluntarios}
                feita={!!checklist[f.id]} aberta={aberta === f.id} pode={pode} souLiderBase={souLiderBase}
                uid={uid} nomeLiderBase={nomeLiderBase}
                onAbrir={() => setAberta(aberta === f.id ? null : f.id)}
                onEscolher={() => setSheet({ tipo: "escolher", funcaoId: f.id })}
                onEditar={() => setSheet({ tipo: "funcao", funcaoId: f.id })}
              />
            ))}
          </div>
        );
      })}

      {sheet?.tipo === "escolher" && (
        <SheetEscolher
          funcao={funcoes.find((f) => f.id === sheet.funcaoId)}
          evento={evento} voluntarios={voluntarios} atribuicoes={atribuicoes}
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
