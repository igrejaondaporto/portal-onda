import { useState } from "react";
import { Lock } from "lucide-react";
import { criarPrivado, desativarPrivado, editarPrivado } from "../../lib/agenda";
import { AvisoConflitos, CampoRepetir, useConflitos, useRepetir } from "./Repetir";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const MENU = { position: "static", border: 0, padding: "10px 0 0", background: "none", backdropFilter: "none", flexWrap: "wrap", whiteSpace: "normal" };

/**
 * Um evento PRIVADO da agenda — `bases/pastoral/agenda/{id}`. Só quem
 * está em "Quem participa" o vê (firestore.rules), por isso
 * "discipulado com líder" fica de um pastor e "sala de oração" dos
 * dois. Nenhuma base o vê, nunca.
 *
 * Quem cria está sempre incluído — as regras recusam criar um evento
 * de que não se faz parte (senão desaparecia no momento de gravar).
 *
 * Com hora marcada, outro evento à mesma hora (da igreja ou privado
 * que esta pessoa vê) bloqueia — sem hora não há conflito possível.
 * "Repetir" cria N semanas seguidas numa escrita só.
 */
export default function SheetEventoPrivado({ uid, evento, dataInicial, equipa, privados, onFechar }) {
  const torrada = useTorrada();
  const editar = !!evento;
  const [titulo, setTitulo] = useState(evento?.titulo ?? "");
  const [data, setData] = useState(evento?.data ?? dataInicial);
  const [hora, setHora] = useState(evento?.hora ?? "");
  const [horaFim, setHoraFim] = useState(evento?.horaFim ?? "");
  const [local, setLocal] = useState(evento?.local ?? "");
  const [nota, setNota] = useState(evento?.nota ?? "");
  const [participantes, setParticipantes] = useState(evento?.participantes ?? [uid]);
  const [aGuardar, setAGuardar] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const repetir = useRepetir();
  const semanas = editar ? 1 : repetir.semanas;
  const { conflitos, aVerificar } = useConflitos({ data, semanas, hora, privados, ignorar: evento?.id });

  const alternar = (id) => {
    if (id === uid) return;
    setParticipantes((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  };

  async function guardar() {
    if (!titulo.trim()) return torrada("Dá um nome ao evento.");
    if (!data) return torrada("Escolhe o dia.");
    const dados = { titulo, data, hora, horaFim, local, nota, participantes: participantes.includes(uid) ? participantes : [uid, ...participantes] };
    setAGuardar(true);
    try {
      if (editar) await editarPrivado(evento.id, dados);
      else await criarPrivado(uid, dados, semanas);
      torrada(editar ? "Evento atualizado." : semanas > 1 ? `${semanas} eventos privados criados.` : "Evento privado criado.");
      onFechar();
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAGuardar(false);
    }
  }

  async function apagar() {
    setAGuardar(true);
    try {
      await desativarPrivado(evento.id);
      torrada("Evento apagado.");
      onFechar();
    } catch (e) {
      torrada(e.message || "Não foi possível apagar.");
      setAGuardar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2><Lock size={18} style={{ verticalAlign: "-2px" }} /> {editar ? "Evento privado" : "Novo evento privado"}</h2>
        <p className="sb2">Nenhuma base o vê — só quem escolheres em baixo.</p>

        <label className="rot" style={{ marginTop: 16 }}>Nome</label>
        <input className="campo" value={titulo} maxLength={80} placeholder="Ex.: Discipulado com líder" onChange={(e) => setTitulo(e.target.value)} />

        <label className="rot" style={{ marginTop: 12 }}>Dia</label>
        <input className="campo" type="date" value={data} onChange={(e) => setData(e.target.value)} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 12 }}>
          <div>
            <label className="rot">Começa (opcional)</label>
            <input className="campo" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
          <div>
            <label className="rot">Acaba (opcional)</label>
            <input className="campo" type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
          </div>
        </div>

        <AvisoConflitos conflitos={conflitos} hora={hora} />
        {!editar && <CampoRepetir repetir={repetir} data={data} />}

        <label className="rot" style={{ marginTop: 12 }}>Local (opcional)</label>
        <input className="campo" value={local} maxLength={80} onChange={(e) => setLocal(e.target.value)} />

        <label className="rot" style={{ marginTop: 12 }}>Nota (opcional)</label>
        <textarea className="campo" rows={2} value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />

        <label className="rot" style={{ marginTop: 12 }}>Quem participa</label>
        <div className="menu" style={MENU}>
          {equipa.map((p) => (
            <button key={p.id} data-on={participantes.includes(p.id) || p.id === uid ? "1" : "0"} onClick={() => alternar(p.id)}>
              {p.id === uid ? `${p.nome} (tu)` : p.nome}
            </button>
          ))}
        </div>
        <p className="cap" style={{ marginTop: 6 }}>Só estas pessoas veem o evento na agenda delas.</p>

        {confirmarApagar ? (
          <div className="caixa destaque" style={{ marginTop: 16 }}>
            <p className="ds" style={{ marginTop: 0 }}>Apagar este evento? Deixa de aparecer para todos os que participam.</p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn sec" style={{ flex: 1 }} onClick={() => setConfirmarApagar(false)}>Não</button>
              <button className="btn perigo" style={{ flex: 1 }} disabled={aGuardar} onClick={apagar}>Apagar</button>
            </div>
          </div>
        ) : (
          <>
            <button className="btn full" style={{ marginTop: 18 }} disabled={aGuardar || aVerificar || conflitos.length > 0} onClick={guardar}>
              {aGuardar ? "A guardar…" : editar ? "Guardar" : "Criar evento"}
            </button>
            {editar && (
              <button className="btn sec full" style={{ marginTop: 8, color: "var(--magenta)" }} onClick={() => setConfirmarApagar(true)}>
                Apagar evento
              </button>
            )}
          </>
        )}
        <button className="btn sec full" style={{ marginTop: 8 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
