import { useEffect, useRef, useState } from "react";
import { getDoc } from "firebase/firestore";
import { cEvento } from "../../lib/modelo";
import { basesComEscala } from "../../lib/agenda";
import { apagarEventoIgreja, guardarEventoIgreja } from "../../lib/pastoral";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const MENU = { position: "static", border: 0, padding: "10px 0 0", background: "none", backdropFilter: "none", flexWrap: "wrap", whiteSpace: "normal" };

/**
 * Criar/editar um evento da IGREJA — `eventos/{data}`, o mesmo que as
 * dez bases leem (calendário, escala, enquete). As bases que NÃO se
 * escolhem ficam em `dispensadaPor`, que é como cada base já esconde
 * um evento; por isso nenhuma precisou de mudar.
 *
 * O dia não se muda ao editar: o id do documento É a data, e as
 * escalas vivem debaixo dele. Mudar de dia é apagar e criar outro.
 */
export default function SheetEventoIgreja({ evento, dataInicial, bases, hoje, onFechar }) {
  const torrada = useTorrada();
  const editar = !!evento;
  const [data, setData] = useState(evento?.data ?? dataInicial);
  const [nome, setNome] = useState(evento?.tipo ?? "");
  const [horaCulto, setHoraCulto] = useState(evento?.horaCulto ?? "10:30");
  const [horaChegada, setHoraChegada] = useState(evento?.horaChegada ?? "08:00");
  const [local, setLocal] = useState(evento?.local ?? "");
  const [nota, setNota] = useState(evento?.nota ?? "");
  const servemDe = (lista) => lista.map((b) => b.id).filter((id) => !(evento?.dispensadaPor ?? []).includes(id));
  const [escolhidas, setEscolhidas] = useState(() => servemDe(bases));
  // as bases chegam por onSnapshot — se a folha abrir antes, preenche
  // quando chegarem (uma vez só, para não desfazer o que se escolheu)
  const iniciado = useRef(bases.length > 0);
  useEffect(() => {
    if (iniciado.current || !bases.length) return;
    iniciado.current = true;
    setEscolhidas(servemDe(bases));
  }, [bases]); // eslint-disable-line react-hooks/exhaustive-deps
  const [ocupado, setOcupado] = useState(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(null); // null | [bases com escala]

  // um evento da igreja por dia (o id é a data) — avisar antes de
  // carregar em Guardar, em vez de só depois pelo erro do servidor
  useEffect(() => {
    if (editar || !data) return;
    let vivo = true;
    getDoc(cEvento(data)).then((s) => {
      if (vivo) setOcupado(s.exists() && s.data().ativo !== false ? (s.data().tipo || "Culto de domingo") : null);
    });
    return () => { vivo = false; };
  }, [data, editar]);

  const todas = escolhidas.length === bases.length;
  const alternar = (id) => setEscolhidas((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  async function guardar() {
    if (!nome.trim()) return torrada("Dá um nome ao evento.");
    if (!escolhidas.length) return torrada("Escolhe pelo menos uma base.");
    setAGuardar(true);
    try {
      await guardarEventoIgreja({ data, nome, horaCulto, horaChegada, local, nota, bases: escolhidas, editar });
      torrada(editar ? "Evento atualizado nas bases." : "Evento criado — já aparece nas bases escolhidas.");
      onFechar();
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  }

  async function pedirApagar() {
    setAGuardar(true);
    try {
      setConfirmarApagar(await basesComEscala(evento.id));
    } catch {
      setConfirmarApagar([]);
    } finally {
      setAGuardar(false);
    }
  }

  async function apagar() {
    setAGuardar(true);
    try {
      await apagarEventoIgreja(evento.id);
      torrada("Evento apagado.");
      onFechar();
    } catch (e) {
      torrada(e.message || "Não foi possível apagar.");
      setAGuardar(false);
    }
  }

  const nomeDe = (id) => bases.find((b) => b.id === id)?.nome ?? id;

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{editar ? "Evento da igreja" : "Novo evento da igreja"}</h2>
        <p className="sb2">Aparece no calendário das bases escolhidas, para escalarem.</p>

        <label className="rot" style={{ marginTop: 16 }}>Dia</label>
        <input className="campo" type="date" value={data} disabled={editar} onChange={(e) => setData(e.target.value)} />
        {editar && <p className="cap" style={{ marginTop: 4 }}>Para mudar o dia, apaga e cria de novo — as escalas ficam presas ao dia.</p>}
        {ocupado && (
          <p className="ds" style={{ marginTop: 6, color: "var(--magenta)" }}>
            Já há "{ocupado}" neste dia — só cabe um evento da igreja por dia.
          </p>
        )}

        <label className="rot" style={{ marginTop: 12 }}>Nome</label>
        <input className="campo" value={nome} maxLength={60} placeholder="Ex.: Culto de Mulheres" onChange={(e) => setNome(e.target.value)} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 12 }}>
          <div>
            <label className="rot">Começa</label>
            <input className="campo" type="time" value={horaCulto} onChange={(e) => setHoraCulto(e.target.value)} />
          </div>
          <div>
            <label className="rot">Chegada das bases</label>
            <input className="campo" type="time" value={horaChegada} onChange={(e) => setHoraChegada(e.target.value)} />
          </div>
        </div>

        <label className="rot" style={{ marginTop: 12 }}>Local (opcional)</label>
        <input className="campo" value={local} maxLength={80} placeholder="Ex.: Casa do Povo de Vermoim" onChange={(e) => setLocal(e.target.value)} />

        <label className="rot" style={{ marginTop: 12 }}>Nota (opcional)</label>
        <textarea className="campo" rows={2} value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />

        <label className="rot" style={{ marginTop: 12 }}>Que bases servem</label>
        <div className="menu" style={MENU}>
          <button data-on={todas ? "1" : "0"} onClick={() => setEscolhidas(todas ? [] : bases.map((b) => b.id))}>Todas</button>
          {bases.map((b) => (
            <button key={b.id} data-on={escolhidas.includes(b.id) ? "1" : "0"} onClick={() => alternar(b.id)}>
              <span className="quadmin" style={{ background: b.cor }} />{b.nome}
            </button>
          ))}
        </div>
        <p className="cap" style={{ marginTop: 6 }}>
          As outras não o veem. O líder de uma base não escolhida pode, na mesma, decidir servir.
        </p>

        {confirmarApagar ? (
          <div className="caixa destaque" style={{ marginTop: 16 }}>
            <p className="ds" style={{ marginTop: 0 }}>
              {confirmarApagar.length
                ? <>Já há gente escalada em <b>{confirmarApagar.map(nomeDe).join(", ")}</b>. Apagar tira o evento e essas escalas de todas as bases.</>
                : "Nenhuma base escalou ninguém ainda. Apagar tira o evento de todas as bases."}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn sec" style={{ flex: 1 }} onClick={() => setConfirmarApagar(null)}>Não</button>
              <button className="btn perigo" style={{ flex: 1 }} disabled={aGuardar} onClick={apagar}>Apagar</button>
            </div>
          </div>
        ) : (
          <>
            <button className="btn full" style={{ marginTop: 18 }} disabled={aGuardar || !!ocupado} onClick={guardar}>
              {aGuardar ? "A guardar…" : editar ? "Guardar" : "Criar evento"}
            </button>
            {editar && evento.data >= hoje && (
              <button className="btn sec full" style={{ marginTop: 8, color: "var(--magenta)" }} disabled={aGuardar} onClick={pedirApagar}>
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
