import { useEffect, useMemo, useState } from "react";
import {
  obterCatalogoChecklist, obterEscalasDeTodasAsBases, ouvirChecklist, ouvirContagem,
  ouvirCultoAoVivo, ouvirEventos, ouvirPonteiroAoVivo, proximoCulto,
} from "../lib/culto";
import { hojeISO, nomeEvento } from "@portal/shared/lib/data.js";
import { nomeTipoCulto } from "@portal/shared/lib/tipoCulto.js";
import { cruzarComReal } from "@portal/shared/lib/ordemAoVivo.js";
import Atraso from "../components/Atraso";
import SheetRecado from "../components/SheetRecado";

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
export default function Domingo({ ativo, definirCabecalho, onAoVivo, irPara, podePublicarCulto }) {
  const [eventos, setEventos] = useState([]);
  const [eventoId, setEventoId] = useState(null);
  const [escalas, setEscalas] = useState(null);       // null = a carregar
  const [catalogo, setCatalogo] = useState(null);
  const [checklist, setChecklist] = useState({});
  const [contagem, setContagem] = useState(null);
  const [aoVivoId, setAoVivoId] = useState(null);
  const [registoAoVivo, setRegistoAoVivo] = useState(null);
  const [recadoPara, setRecadoPara] = useState(null);
  const [erro, setErro] = useState(null);

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
    setEscalas(null); setCatalogo(null); setErro(null);
    Promise.all([obterEscalasDeTodasAsBases(eventoId), obterCatalogoChecklist(eventoId)])
      .then(([e, c]) => { if (vivo) { setEscalas(e); setCatalogo(c); } })
      .catch((e) => { if (vivo) setErro(e.message || "Não foi possível carregar as bases."); });
    return () => { vivo = false; };
  }, [eventoId]);

  useEffect(() => ouvirChecklist(eventoId, setChecklist), [eventoId]);
  useEffect(() => ouvirContagem(eventoId, setContagem), [eventoId]);
  useEffect(() => ouvirCultoAoVivo(aoVivoId, setRegistoAoVivo), [aoVivoId]);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: evento ? nomeEvento(evento) : "Domingo",
      subtitulo: aoVivoId === eventoId && aoVivoId
        ? "A acontecer agora"
        : "As dez bases neste culto, num sítio só",
      chips: [
        evento?.tipoCulto ? nomeTipoCulto(evento.tipoCulto) : null,
        evento?.ordem ? "Ordem publicada" : "Sem ordem publicada",
      ].filter(Boolean),
    });
  }, [ativo, definirCabecalho, evento, aoVivoId, eventoId]);

  /* ── checklist: percentagem por base, ao vivo ────────────── */
  const porBase = useMemo(() => {
    if (!escalas) return [];
    const cat = Object.fromEntries((catalogo ?? []).map((b) => [b.baseId, b]));
    return escalas.map((b) => {
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

  /* ── contagem do culto (Base Pessoal) ────────────────────── */
  const presentes = useMemo(() => {
    const cats = contagem?.categorias ?? {};
    const v = (id) => (typeof cats[id]?.valor === "number" ? cats[id].valor : null);
    const auditorio = ["membros", "visitantes", "voluntarios"].map(v).filter((n) => n !== null);
    const salas = ["new", "shift", "juniorFun", "baby"].map(v).filter((n) => n !== null);
    return {
      auditorio: auditorio.length ? auditorio.reduce((t, n) => t + n, 0) : null,
      salas: salas.length ? salas.reduce((t, n) => t + n, 0) : null,
      visitantes: v("visitantes"),
      finalizada: !!contagem?.finalizadoEm,
    };
  }, [contagem]);

  return (
    <>
      {/* seletor de culto: só aparece havendo mais do que um, e nunca
          se sobrepõe ao culto ao vivo — se há culto a acontecer, é
          esse que interessa */}
      {eventos.length > 1 && (
        <select
          className="campo ordselect" value={eventoId ?? ""}
          onChange={(e) => setEventoId(e.target.value)}
          style={{ marginTop: 14 }}
        >
          {eventos.map((e) => (
            <option key={e.id} value={e.id}>
              {nomeEvento(e)}{e.id === hoje ? " · hoje" : ""}{e.id === aoVivoId ? " · ao vivo" : ""}
            </option>
          ))}
        </select>
      )}

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
          <p className="pa-num">{presentes.auditorio ?? "—"}</p>
          <p className="ds" style={{ marginTop: 2 }}>
            {presentes.salas !== null ? `+${presentes.salas} nas salas` : "salas por contar"}
          </p>
        </div>
      </div>

      {presentes.visitantes !== null && presentes.visitantes > 0 && (
        <div className="caixa" style={{ marginTop: 10 }}>
          <p className="ds" style={{ marginTop: 0 }}>
            <b>{presentes.visitantes} visitante{presentes.visitantes === 1 ? "" : "s"}</b> neste culto
            {presentes.finalizada ? "." : " — contagem ainda a decorrer."}
          </p>
        </div>
      )}

      {/* ── quem ainda não tem escala ───────────────────────── */}
      {escalas && semEscala.length > 0 && (
        <div className="caixa destaque" style={{ marginTop: 10 }}>
          <p className="ds" style={{ marginTop: 0 }}>
            <b>{semEscala.length} base{semEscala.length === 1 ? "" : "s"} sem escala</b> neste culto:{" "}
            {semEscala.map((b) => b.nome).join(", ")}.
          </p>
        </div>
      )}

      {/* ── uma linha por base ──────────────────────────────── */}
      <div className="sect">
        <div className="cabecalho"><h3>As bases neste culto</h3><span className="cap">escala e checklist</span></div>
        {escalas === null ? (
          <div className="vaz">A carregar as bases…</div>
        ) : porBase.map((b) => (
          <div className="linha" key={b.baseId}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="nmt" style={{ display: "flex", alignItems: "center", gap: 7 }}>
                {b.cor && <span className="quadmin" style={{ background: b.cor }} />}
                {b.nome}
              </p>
              <p className="ds">
                {b.tipo === "vazio"
                  ? "Sem escala"
                  : `${b.escalados} a servir${b.tarefas ? ` · ${b.feitas}/${b.tarefas} feitas` : ""}`}
              </p>
              {b.pct !== null && (
                <div className="barra" style={{ marginTop: 7 }}>
                  <i style={{ width: `${b.pct}%`, background: b.cor ?? "var(--azul)" }} />
                </div>
              )}
            </div>
            <button className="btn sec" style={{ flex: "none" }} onClick={() => setRecadoPara(b)}>
              Recado
            </button>
          </div>
        ))}
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
        ) : podePublicarCulto ? (
          <>
            <div className="vaz">Este culto ainda não tem ordem publicada.</div>
            <button className="btn full" style={{ marginTop: 10 }} onClick={() => irPara("ordem")}>
              Montar a ordem deste culto
            </button>
          </>
        ) : (
          // sem a claim, a aba Ordem não compõe nada — um botão que
          // levasse lá só para ler "ainda não está ativo" seria pior
          // do que dizer isso já aqui
          <div className="vaz">Este culto ainda não tem ordem publicada — a Backstage sobe o PDF, como sempre.</div>
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
