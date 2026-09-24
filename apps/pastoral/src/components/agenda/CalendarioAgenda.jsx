import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Plus } from "lucide-react";
import { MESES, hojeISO } from "@portal/shared/lib/data.js";
import { ouvirEventos } from "../../lib/culto";
import { ouvirAgendaPrivada, ouvirBasesQueServem, ouvirEquipa } from "../../lib/agenda";
import SheetEventoIgreja from "./SheetEventoIgreja";
import SheetEventoPrivado from "./SheetEventoPrivado";

const DIAS = ["S", "T", "Q", "Q", "S", "S", "D"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (a, m, d) => `${a}-${pad(m + 1)}-${pad(d)}`;

/** Um evento da igreja é editável daqui se for um culto especial
 *  global — os domingos são de `gerarDomingos`, e um `escopo:"base"`
 *  é de uma base só (o servidor recusa os dois na mesma). */
const editavel = (ev) => !!ev.tipo && ev.escopo !== "base";

/**
 * A agenda do pastor, no topo da aba Domingo (pedido 2026-09).
 *
 * Duas camadas no mesmo mês: os eventos da IGREJA (azul — os mesmos
 * `eventos/{data}` das dez bases) e os PRIVADOS (violeta + cadeado —
 * `bases/pastoral/agenda`, só de quem participa). Nunca só a cor: o
 * privado leva sempre o cadeado, e cada linha diz de que tipo é.
 *
 * Mês em grelha + a lista do dia tocado por baixo — no telemóvel é o
 * que cabe: a grelha diz ONDE há coisas, a lista diz O QUÊ.
 */
export default function CalendarioAgenda({ uid }) {
  const hoje = useMemo(hojeISO, []);
  const [ref, setRef] = useState(() => ({ a: Number(hoje.slice(0, 4)), m: Number(hoje.slice(5, 7)) - 1 }));
  const [dia, setDia] = useState(hoje);
  const [eventos, setEventos] = useState([]);
  const [privados, setPrivados] = useState([]);
  const [bases, setBases] = useState([]);
  const [equipa, setEquipa] = useState([]);
  const [escolher, setEscolher] = useState(false);
  const [sheet, setSheet] = useState(null); // { tipo:"igreja"|"privado", evento?|null, data }

  const ultimo = new Date(ref.a, ref.m + 1, 0).getDate();
  const de = iso(ref.a, ref.m, 1);
  const ate = iso(ref.a, ref.m, ultimo);

  useEffect(() => ouvirEventos(de, ate, setEventos), [de, ate]);
  useEffect(() => (uid ? ouvirAgendaPrivada(uid, setPrivados) : undefined), [uid]);
  useEffect(() => ouvirBasesQueServem(setBases), []);
  useEffect(() => ouvirEquipa(setEquipa), []);

  const porDia = useMemo(() => {
    const m = {};
    for (const e of eventos) (m[e.data] ||= { igreja: [], privados: [] }).igreja.push(e);
    for (const p of privados) {
      if (p.data < de || p.data > ate) continue;
      (m[p.data] ||= { igreja: [], privados: [] }).privados.push(p);
    }
    for (const d of Object.values(m)) d.privados.sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
    return m;
  }, [eventos, privados, de, ate]);

  const nomeBase = Object.fromEntries(bases.map((b) => [b.id, b]));
  const nomePessoa = Object.fromEntries(equipa.map((p) => [p.id, p.nome]));

  function mudarMes(delta) {
    const d = new Date(ref.a, ref.m + delta, 1);
    const a = d.getFullYear(), m = d.getMonth();
    setRef({ a, m });
    setDia(hoje.startsWith(`${a}-${pad(m + 1)}`) ? hoje : iso(a, m, 1));
  }

  // segunda-feira primeiro, como no calendário português
  const vazios = (new Date(ref.a, ref.m, 1).getDay() + 6) % 7;
  const celulas = [...Array(vazios).fill(null), ...Array.from({ length: ultimo }, (_, i) => i + 1)];
  const doDia = porDia[dia] ?? { igreja: [], privados: [] };

  return (
    <div className="sect" style={{ marginTop: 4 }}>
      <div className="cabecalho">
        <h3>Agenda</h3>
        <button className="ag-mais" onClick={() => setEscolher(true)} aria-label="Novo evento"><Plus size={18} /></button>
      </div>

      <div className="caixa ag-cal">
        <div className="ag-mes">
          <button onClick={() => mudarMes(-1)} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
          <span>{MESES[ref.m]} {ref.a}</span>
          <button onClick={() => mudarMes(1)} aria-label="Mês seguinte"><ChevronRight size={18} /></button>
        </div>
        <div className="ag-grelha">
          {DIAS.map((d, i) => <span key={i} className="ag-sem">{d}</span>)}
          {celulas.map((n, i) => {
            if (!n) return <span key={`v${i}`} />;
            const id = iso(ref.a, ref.m, n);
            const c = porDia[id];
            return (
              <button
                key={id} className="ag-dia" data-hoje={id === hoje ? "1" : "0"} data-on={id === dia ? "1" : "0"}
                onClick={() => setDia(id)}
              >
                {n}
                <span className="ag-pontos">
                  {c?.igreja.length ? <i className="ag-p-igreja" /> : null}
                  {c?.privados.length ? <i className="ag-p-privado" /> : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="ag-legenda">
          <span><i className="ag-p-igreja" /> Da igreja</span>
          <span><i className="ag-p-privado" /> <Lock size={11} /> Privado</span>
        </div>
      </div>

      <p className="cap" style={{ marginTop: 12 }}>{Number(dia.slice(8))} de {MESES[Number(dia.slice(5, 7)) - 1]}</p>
      {!doDia.igreja.length && !doDia.privados.length && (
        <p className="ds" style={{ marginTop: 4 }}>Nada marcado neste dia.</p>
      )}

      {doDia.igreja.map((e) => {
        const servem = bases.filter((b) => !(e.dispensadaPor ?? []).includes(b.id));
        const podeEditar = editavel(e);
        return (
          <button
            key={e.id} className="ag-ev ag-ev-igreja" disabled={!podeEditar}
            onClick={() => setSheet({ tipo: "igreja", evento: e, data: e.data })}
          >
            <span className="ag-ev-tit">{e.tipo || "Culto de domingo"}</span>
            <span className="ag-ev-sub">
              Da igreja · {e.horaCulto ?? "—"}{e.horaChegada ? ` (chegada ${e.horaChegada})` : ""}
              {e.local ? ` · ${e.local}` : ""}
            </span>
            {e.escopo === "base" ? (
              <span className="ag-ev-sub">Só da {nomeBase[e.baseId]?.nome ?? e.baseId} — gere-se nessa base</span>
            ) : (
              <span className="ag-bases">
                {servem.length === bases.length
                  ? <span className="tag cinz">Todas as bases</span>
                  : servem.map((b) => (
                    <span key={b.id} className="tag cinz"><span className="quadmin" style={{ background: b.cor }} />{b.nome}</span>
                  ))}
              </span>
            )}
            {e.nota && <span className="ag-ev-sub">{e.nota}</span>}
          </button>
        );
      })}

      {doDia.privados.map((p) => (
        <button key={p.id} className="ag-ev ag-ev-privado" onClick={() => setSheet({ tipo: "privado", evento: p, data: p.data })}>
          <span className="ag-ev-tit"><Lock size={13} /> {p.titulo}</span>
          <span className="ag-ev-sub">
            Privado{p.hora ? ` · ${p.hora}${p.horaFim ? `–${p.horaFim}` : ""}` : ""}{p.local ? ` · ${p.local}` : ""}
          </span>
          <span className="ag-ev-sub">
            {p.participantes.length === 1 && p.participantes[0] === uid
              ? "Só tu"
              : p.participantes.map((id) => (id === uid ? "tu" : nomePessoa[id] ?? "alguém")).join(", ")}
          </span>
          {p.nota && <span className="ag-ev-sub">{p.nota}</span>}
        </button>
      ))}

      {escolher && (
        <>
          <div className="veu on" onClick={() => setEscolher(false)} />
          <div className="pin on" role="dialog" aria-modal="true">
            <div className="pux" />
            <h2>Novo evento</h2>
            <p className="sb2">{Number(dia.slice(8))} de {MESES[Number(dia.slice(5, 7)) - 1]} — dá para mudar o dia a seguir.</p>
            <button
              className="btn full" style={{ marginTop: 18 }}
              onClick={() => { setEscolher(false); setSheet({ tipo: "igreja", evento: null, data: dia }); }}
            >
              Evento da igreja
            </button>
            <p className="cap" style={{ marginTop: 6, textAlign: "center" }}>Aparece nas bases que escolheres, para escalarem.</p>
            <button
              className="btn sec full" style={{ marginTop: 12 }}
              onClick={() => { setEscolher(false); setSheet({ tipo: "privado", evento: null, data: dia }); }}
            >
              <Lock size={14} style={{ verticalAlign: "-2px" }} /> Privado
            </button>
            <p className="cap" style={{ marginTop: 6, textAlign: "center" }}>Só tu, ou quem escolheres da equipa pastoral.</p>
            <button className="btn sec full" style={{ marginTop: 16 }} onClick={() => setEscolher(false)}>Fechar</button>
          </div>
        </>
      )}

      {sheet?.tipo === "igreja" && (
        <SheetEventoIgreja
          evento={sheet.evento} dataInicial={sheet.data} bases={bases} hoje={hoje}
          onFechar={() => setSheet(null)}
        />
      )}
      {sheet?.tipo === "privado" && (
        <SheetEventoPrivado
          uid={uid} evento={sheet.evento} dataInicial={sheet.data} equipa={equipa}
          onFechar={() => setSheet(null)}
        />
      )}
    </div>
  );
}
