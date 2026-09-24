import { useEffect, useMemo, useState } from "react";
import {
  obterCatalogoChecklist, obterEscalasDeTodasAsBases, ouvirChecklist, ouvirContagem,
  ouvirCultoAoVivo, ouvirEventos, ouvirMapaAcomodacao, ouvirPonteiroAoVivo, proximoCulto,
} from "../lib/culto";
import { hojeISO, nomeEvento } from "@portal/shared/lib/data.js";
import { nomeTipoCulto } from "@portal/shared/lib/tipoCulto.js";
import { useTiposCulto } from "@portal/shared/lib/TiposCultoContext.jsx";
import { cruzarComReal } from "@portal/shared/lib/ordemAoVivo.js";
import Atraso from "../components/Atraso";
import SheetRecado from "../components/SheetRecado";
import NavCulto from "../components/NavCulto";
import CalendarioAgenda from "../components/agenda/CalendarioAgenda";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";

/** As três salas fixas da Kinder (baby/fun/junior — `pessoas/{p}.categoria`
 *  lá, ver `apps/kinder/src/lib/modelo.js`). Cores iguais às de lá,
 *  copiadas em vez de importadas — cada app só carrega o seu próprio
 *  bundle (ver CLAUDE.md da raiz), e são três linhas que não mudam. Só
 *  para etiquetar quem serve em qual sala aqui no painel (pedido
 *  2026-09); Mestra/quadro do mês continuam só na Kinder. */
const SALAS_KINDER = {
  baby: { nome: "Baby", cor: "#7b5cff" },
  fun: { nome: "Fun", cor: "#f5c400" },
  junior: { nome: "Júnior", cor: "#1e7bf0" },
};

/** Janela de cultos que a tela carrega: o mês passado e os dois
 *  seguintes. Chega para "o próximo domingo" e para rever o anterior,
 *  sem puxar o histórico inteiro a cada abertura — isso é a aba
 *  Números, que pede uma janela de propósito. */
function janela() {
  const h = new Date();
  const de = new Date(h.getFullYear(), h.getMonth() - 1, 1);
  const ate = new Date(h.getFullYear(), h.getMonth() + 2, 0);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return [iso(de), iso(ate)];
}

/**
 * O domingo — o que está a acontecer, ou o que vai acontecer.
 *
 * É a tela que justifica o painel existir: hoje, para saber se as dez
 * bases estão prontas, é preciso perguntar a dez líderes. Aqui está
 * tudo na mesma página, e nada disto é uma cópia gravada — a escala e
 * a checklist são lidas na hora, a checklist ao vivo.
 *
 * Só leitura. O painel observa e não age (decisão do dono do produto):
 * a única coisa que sai daqui é um recado, de ida, que o líder lê e
 * dispensa. Marcar uma checklist continua a ser de quem está na escala
 * dessa base, e as regras já o garantem.
 */
export default function Domingo({ uid, ativo, definirCabecalho, onAoVivo, irPara, podePublicarCulto }) {
  const tiposCulto = useTiposCulto();
  const [eventos, setEventos] = useState([]);
  const [eventoId, setEventoId] = useState(null);
  const [escalas, setEscalas] = useState(null);       // null = a carregar
  const [catalogo, setCatalogo] = useState(null);
  const [checklist, setChecklist] = useState({});
  const [contagem, setContagem] = useState(null);
  const [mapa, setMapa] = useState(null);
  const [aoVivoId, setAoVivoId] = useState(null);
  const [registoAoVivo, setRegistoAoVivo] = useState(null);
  const [recadoPara, setRecadoPara] = useState(null);
  const [erro, setErro] = useState(null);
  // qual base está aberta a mostrar a escala exata, e dentro dela qual
  // pessoa está aberta a mostrar o WhatsApp — duas chaves, nunca mais
  // de uma aberta em cada nível ao mesmo tempo
  const [baseAberta, setBaseAberta] = useState(null);
  const [contactoAberto, setContactoAberto] = useState(null);

  const [de, ate] = useMemo(janela, []);
  const hoje = useMemo(hojeISO, []);

  useEffect(() => ouvirEventos(de, ate, setEventos), [de, ate]);
  useEffect(() => ouvirPonteiroAoVivo(setAoVivoId), []);

  // o ponto no separador acende quando há culto a acontecer agora,
  // seja qual for a data dele (o botão "Começou o culto" da Técnica
  // não olha para o calendário, de propósito)
  useEffect(() => { onAoVivo(!!aoVivoId); }, [aoVivoId, onAoVivo]);

  // abre no culto ao vivo se houver um; senão no de hoje ou no
  // próximo. Nunca num domingo já passado havendo um pela frente.
  useEffect(() => {
    if (!eventos.length) return;
    setEventoId((atual) => {
      if (aoVivoId && eventos.some((e) => e.id === aoVivoId)) return aoVivoId;
      if (atual && eventos.some((e) => e.id === atual)) return atual;
      return proximoCulto(eventos, hoje)?.id ?? null;
    });
  }, [eventos, aoVivoId, hoje]);

  const evento = eventos.find((e) => e.id === eventoId) ?? null;

  // catálogo: uma chamada por culto. O estado é que é ao vivo.
  useEffect(() => {
    if (!eventoId) return;
    let vivo = true;
    setEscalas(null); setCatalogo(null); setErro(null); setBaseAberta(null); setContactoAberto(null);
    Promise.all([obterEscalasDeTodasAsBases(eventoId), obterCatalogoChecklist(eventoId)])
      .then(([e, c]) => {
        if (!vivo) return;
        // Financeiro e Pastoral nunca escalam ninguém para o culto —
        // sem isto apareciam sempre como "sem escala", tanto na lista
        // de base a base como no banner lá em cima (reportado 2026-09:
        // "nao considera que o Pastoral nao tenha escala, nunca vai
        // ter mesmo. Nem o Financeiro").
        setEscalas(e.filter((b) => b.semEscalaDeCulto !== true));
        setCatalogo(c);
      })
      .catch((e) => { if (vivo) setErro(e.message || "Não foi possível carregar as bases."); });
    return () => { vivo = false; };
  }, [eventoId]);

  useEffect(() => ouvirChecklist(eventoId, setChecklist), [eventoId]);
  useEffect(() => ouvirContagem(eventoId, setContagem), [eventoId]);
  useEffect(() => ouvirMapaAcomodacao(eventoId, setMapa), [eventoId]);
  useEffect(() => ouvirCultoAoVivo(aoVivoId, setRegistoAoVivo), [aoVivoId]);

  useEffect(() => {
    if (!ativo) return;
    // etiqueta em cima da data: o mesmo culto pode estar a acontecer
    // agora, ainda por vir, ou já ter passado (NavCulto deixa andar
    // para trás) — "Próximo culto:" só faz sentido no primeiro caso
    // de "ainda não aconteceu".
    const rotulo = aoVivoId === eventoId && aoVivoId
      ? "A acontecer agora:"
      : evento && evento.data < hoje ? "Culto de:" : "Próximo culto:";
    definirCabecalho({
      rotulo,
      titulo: evento ? nomeEvento(evento) : "Domingo",
      subtitulo: aoVivoId === eventoId && aoVivoId
        ? "A acontecer agora"
        : "As dez bases neste culto, num sítio só",
      chips: [
        evento?.tipoCulto ? nomeTipoCulto(tiposCulto, evento.tipoCulto) : null,
        evento?.ordem ? "Ordem publicada" : "Sem ordem publicada",
      ].filter(Boolean),
    });
  }, [ativo, definirCabecalho, evento, aoVivoId, eventoId, hoje, tiposCulto]);

  /* ── checklist: percentagem por base, ao vivo ────────────── */
  const porBase = useMemo(() => {
    if (!escalas) return [];
    const cat = Object.fromEntries((catalogo ?? []).map((b) => [b.baseId, b]));
    return escalas
      .map((b) => {
        const funcoes = cat[b.baseId]?.funcoes ?? [];
        const feitas = funcoes.filter((f) => checklist[f.id]).length;
        const escalados = b.tipo === "lugares" ? b.itens.length : (b.pessoas?.length ?? 0);
        return {
          ...b,
          escalados,
          tarefas: funcoes.length,
          feitas,
          // sem tarefas não é 0% — é "não se aplica". Uma base sem
          // checklist a aparecer a vermelho todas as semanas ensina a
          // ignorar a cor, e aí a cor deixa de servir para o resto.
          pct: funcoes.length ? Math.round((feitas / funcoes.length) * 100) : null,
        };
      })
      // quem tem mais checklist feita sobe; quem ainda nem tem
      // checklist criada (tarefas:0, "não se aplica") desce para o
      // fim — antes ficavam por ordem alfabética, misturadas com as
      // que têm progresso a sério (pedido 2026-09).
      .sort((a, b) => {
        const semChecklistA = a.tarefas === 0, semChecklistB = b.tarefas === 0;
        if (semChecklistA !== semChecklistB) return semChecklistA ? 1 : -1;
        return (b.pct ?? -1) - (a.pct ?? -1);
      });
  }, [escalas, catalogo, checklist]);

  const semEscala = porBase.filter((b) => b.tipo === "vazio");
  const totalEscalados = porBase.reduce((t, b) => t + b.escalados, 0);

  /* ── ao vivo: em que momento vai o culto ─────────────────── */
  const aoVivo = useMemo(() => {
    if (aoVivoId !== eventoId || !registoAoVivo || !evento?.ordem?.momentos) return null;
    const { linhas } = cruzarComReal(evento.ordem.momentos, registoAoVivo.secoesReais ?? []);
    const comReal = linhas.filter((l) => l.real);
    const atual = comReal.at(-1) ?? null;
    if (!atual) return { atual: null, atraso: null, feitos: 0, total: linhas.length };
    const [hp, mp] = (atual.hora ?? "0:0").split(":").map(Number);
    const [hr, mr] = (atual.real.horaReal ?? "0:0").split(":").map(Number);
    return {
      atual,
      atraso: atual.hora ? (hr * 60 + mr) - (hp * 60 + mp) : null,
      feitos: comReal.length,
      total: linhas.length,
    };
  }, [aoVivoId, eventoId, registoAoVivo, evento]);

  // pessoas no auditório, pelo mapa. Sistema diferente
  // da Contagem manual acima (mapa é lugar a lugar, marcado por quem
  // tem a função Mapa na Base Pessoal; ver o mesmo raciocínio em
  // MapaCalor.jsx, Números).
  const noAuditorio = useMemo(() => {
    if (!mapa?.lugares) return null;
    // só pessoas: ocupados + visitantes (e quem respondeu ao apelo) —
    // os reservados/bloqueados não contam (pedido 2026-09: "são 85
    // ocupados + 5 visitantes, e só"). Mesma conta de `lib/presenca.js`.
    return Object.values(mapa.lugares).filter((e) => ["ocupado", "visitante", "apelo", "apeloVisitante"].includes(e)).length;
  }, [mapa]);

  // visitantes e apelo: do MAPA, em todos os domingos (mesma regra de
  // Números, `lib/presenca.js`). "apeloVisitante" é um visitante que
  // respondeu ao apelo — conta nos dois (ver apps/pessoal/CLAUDE.md,
  // "Manter o dedo = APELO").
  const doMapa = useMemo(() => {
    const est = Object.values(mapa?.lugares ?? {});
    const n = (...e) => est.filter((s) => e.includes(s)).length;
    const marcados = n("ocupado", "visitante", "apelo", "apeloVisitante");
    return marcados ? { visitantes: n("visitante", "apeloVisitante"), apelo: n("apelo", "apeloVisitante") } : null;
  }, [mapa]);
  const visitantesCulto = doMapa?.visitantes ?? null;
  const apeloCulto = doMapa?.apelo ?? null;

  return (
    <>
      {/* a agenda do pastor em cima (pedido 2026-09): eventos da igreja
          e os privados de cada um — ver components/agenda */}
      <CalendarioAgenda uid={uid} />

      {/* o culto por omissão já vem certo (ao vivo, ou hoje, ou o
          próximo) — a seta só é para andar para os lados a partir
          dele, nunca se sobrepõe ao culto ao vivo */}
      <NavCulto
        eventos={eventos} eventoId={eventoId} evento={evento} onEscolher={setEventoId}
        extra={eventoId === aoVivoId && aoVivoId
          ? <span className="tag lim">ao vivo</span>
          : eventoId === hoje ? <span className="tag">hoje</span> : null}
      />

      {erro && <div className="caixa destaque" style={{ marginTop: 12 }}><p className="ds" style={{ marginTop: 0 }}>{erro}</p></div>}

      {/* ── o culto a acontecer agora ───────────────────────── */}
      {aoVivo && (
        <div className="caixa destaque" style={{ marginTop: 12 }}>
          <div className="cabecalho" style={{ marginTop: 0 }}>
            <h3><span className="oc-aovivo-ponto" /> Ao vivo</h3>
            <span className="cap">{aoVivo.feitos} de {aoVivo.total}</span>
          </div>
          {aoVivo.atual ? (
            <>
              <p className="nmt" style={{ fontSize: 19, marginTop: 6 }}>{aoVivo.atual.momento}</p>
              <p className="ds" style={{ marginTop: 2 }}>
                previsto {aoVivo.atual.hora ?? "—"} · entrou {aoVivo.atual.real.horaReal}
              </p>
              <div style={{ marginTop: 8 }}><Atraso minutos={aoVivo.atraso} rotulo="face ao previsto" /></div>
            </>
          ) : (
            <p className="ds" style={{ marginTop: 6 }}>O culto começou, mas ainda não entrou nenhum momento no ar.</p>
          )}
        </div>
      )}

      {/* ── os três números do domingo ──────────────────────── */}
      <div className="dupla" style={{ marginTop: 12 }}>
        <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent", marginTop: 0 }}>
          <p className="ds" style={{ marginTop: 0 }}>A servir</p>
          <p className="pa-num">{totalEscalados}</p>
          <p className="ds" style={{ marginTop: 2 }}>em {porBase.filter((b) => b.tipo !== "vazio").length} bases</p>
        </div>
        <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent", marginTop: 0 }}>
          <p className="ds" style={{ marginTop: 0 }}>No auditório</p>
          <p className="pa-num">{noAuditorio ?? "—"}</p>
          <p className="ds" style={{ marginTop: 2 }}>pessoas no auditório</p>
        </div>
      </div>

      {((visitantesCulto ?? 0) > 0 || (apeloCulto ?? 0) > 0) && (
        <div className="caixa" style={{ marginTop: 10 }}>
          <p className="ds" style={{ marginTop: 0 }}>
            <b>{visitantesCulto ?? 0} visitante{visitantesCulto === 1 ? "" : "s"}</b> neste culto
            {apeloCulto > 0 && <> · <b>{apeloCulto} no apelo</b></>}
            {" — pelo Mapa do auditório."}
          </p>
        </div>
      )}

      {/* ── quem ainda não tem escala ───────────────────────── */}
      {escalas && semEscala.length > 0 && (
        <div className="caixa pa-aviso" style={{ marginTop: 10 }}>
          <p style={{ marginTop: 0 }}>
            <b>{semEscala.length} base{semEscala.length === 1 ? "" : "s"} sem escala</b> neste culto:{" "}
            {semEscala.map((b) => b.nome).join(", ")}.
          </p>
        </div>
      )}

      {/* ── uma linha por base, com a escala exata por dentro ─── */}
      <div className="sect">
        <div className="cabecalho"><h3>As bases neste culto</h3><span className="cap">toca para ver quem serve</span></div>
        {escalas === null ? (
          <div className="vaz">A carregar as bases…</div>
        ) : porBase.map((b) => {
          const abertaBase = baseAberta === b.baseId;
          return (
            <div key={b.baseId}>
              <div
                className="linha cabtoque"
                onClick={() => setBaseAberta(abertaBase ? null : b.baseId)}
                role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setBaseAberta(abertaBase ? null : b.baseId); }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="nmt" style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    {b.cor && <span className="quadmin" style={{ background: b.cor }} />}
                    {b.nome}
                  </p>
                  <p className="ds">
                    {b.tipo === "vazio"
                      ? "Sem escala"
                      : `${b.escalados} a servir${b.tarefas ? ` · ${b.feitas}/${b.tarefas} checklists feitas` : " · sem checklist criada"}`}
                  </p>
                  {b.pct !== null && (
                    <div className="barra" style={{ marginTop: 7 }}>
                      <i style={{ width: `${b.pct}%`, background: b.cor ?? "var(--azul)" }} />
                    </div>
                  )}
                </div>
                <span className="cabtoque-seta" aria-hidden="true">{abertaBase ? "⌃" : "›"}</span>
              </div>

              {abertaBase && (
                <div className="aberto" style={{ padding: "0 0 14px" }}>
                  {b.tipo === "vazio" && <p className="ds" style={{ marginTop: 6 }}>Escala ainda não publicada.</p>}

                  {b.tipo === "pessoas" && b.pessoas.map((p) => {
                    const chave = `${b.baseId}:${p.id}`;
                    const sala = b.baseId === "kinder" ? SALAS_KINDER[p.categoria] : null;
                    return (
                      <LinhaPessoaContacto
                        key={p.id} pessoa={p}
                        resumo={
                          p.id === b.liderEscalaId
                            ? "Líder de escala · toca para chamar no WhatsApp"
                            : sala ? `Sala ${sala.nome} · toca para chamar no WhatsApp` : "Toca para chamar no WhatsApp"
                        }
                        tagExtra={
                          p.id === b.liderEscalaId
                            ? <span className="tag lim">Líder de escala</span>
                            : sala ? <span className="tag" style={{ background: sala.cor }}>{sala.nome}</span> : null
                        }
                        aberta={contactoAberto === chave}
                        onToggle={() => setContactoAberto((c) => (c === chave ? null : chave))}
                      />
                    );
                  })}

                  {b.tipo === "lugares" && b.itens.map((it, i) => (
                    <div key={i}>
                      <p style={{ fontSize: 11.5, fontWeight: 700, color: "var(--cinza)", textTransform: "uppercase", letterSpacing: 0.4, margin: "10px 0 2px" }}>
                        {it.ministerio}
                      </p>
                      {it.titular ? (
                        <LinhaPessoaContacto
                          pessoa={it.titular} resumo="Titular · toca para chamar no WhatsApp"
                          aberta={contactoAberto === `${b.baseId}:${i}:titular`}
                          onToggle={() => setContactoAberto((c) => (c === `${b.baseId}:${i}:titular` ? null : `${b.baseId}:${i}:titular`))}
                        />
                      ) : (
                        <p className="ds">Por definir</p>
                      )}
                      {it.aprendiz && (
                        <LinhaPessoaContacto
                          pessoa={it.aprendiz} resumo="Aprendiz · toca para chamar no WhatsApp"
                          aberta={contactoAberto === `${b.baseId}:${i}:aprendiz`}
                          onToggle={() => setContactoAberto((c) => (c === `${b.baseId}:${i}:aprendiz` ? null : `${b.baseId}:${i}:aprendiz`))}
                        />
                      )}
                    </div>
                  ))}

                  <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setRecadoPara(b)}>
                    Mandar recado à {b.nome}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── a ordem do culto ────────────────────────────────── */}
      <div className="sect">
        <div className="cabecalho">
          <h3>Ordem do culto</h3>
          {evento?.ordem && <span className="cap">{evento.ordem.momentos?.length ?? 0} momentos</span>}
        </div>
        {evento?.ordem ? (
          <>
            <p className="ds" style={{ marginTop: 0 }}>
              Portas {evento.ordem.portasAbertas ?? "—"} · começa {evento.ordem.inicio ?? "—"} · acaba {evento.ordem.fim ?? "—"}
              {evento.ordem.origem === "manual" ? " · montada no painel" : " · do PDF"}
            </p>
            {(evento.ordem.avisos?.length ?? 0) > 0 && (
              <p className="ds" style={{ marginTop: 6 }}>
                {evento.ordem.avisos.length} aviso{evento.ordem.avisos.length === 1 ? "" : "s"} para anunciar.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="vaz">
              {podePublicarCulto
                ? "Este culto ainda não tem ordem publicada."
                : "Este culto ainda não tem ordem publicada — a Backstage sobe o PDF, como sempre."}
            </div>
            {/* a aba Ordem monta um rascunho mesmo sem a claim de
                publicar (ver Ordem.jsx) — por isso o botão leva lá nos
                dois casos, só o texto muda */}
            <button className="btn full" style={{ marginTop: 10 }} onClick={() => irPara("ordem")}>
              {podePublicarCulto ? "Montar a ordem deste culto" : "Montar um rascunho"}
            </button>
          </>
        )}
      </div>

      {/* ── o que ficou registado do culto (feedbacks/frases) ── */}
      {evento && evento.data < hoje && (
        <div className="sect">
          <div className="cabecalho"><h3>Depois do culto</h3></div>
          <p className="ds" style={{ marginTop: 0 }}>
            {contagem?.finalizadoEm
              ? "A contagem deste culto está fechada."
              : "A contagem deste culto ainda não foi fechada pela Base Pessoal."}
          </p>
        </div>
      )}

      {recadoPara && (
        <SheetRecado base={recadoPara} onFechar={() => setRecadoPara(null)} />
      )}
    </>
  );
}
