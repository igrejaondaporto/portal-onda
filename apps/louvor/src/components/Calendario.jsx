import { MESES } from "@portal/shared/lib/data.js";

export default function Calendario({ ano, mes, eventosMes, uid, confirmados, onMudarMes, onAbrirDia }) {
  const primeiro = (new Date(ano, mes, 1).getDay() + 6) % 7;
  const dias = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date();
  const ehHoje = (d) => hoje.getFullYear() === ano && hoje.getMonth() === mes && hoje.getDate() === d;

  const porDia = {};
  eventosMes.forEach((ev) => { porDia[Number(ev.data.slice(8, 10))] = ev; });

  // Dia de ensaio (eventos/{e}/escalas/louvor.dataEnsaio) — só pintado
  // quando cai dentro do próprio mês em exibição (a semana de ensaio
  // de um culto no início do mês pode cair no mês anterior; fica sem
  // marcar aí, simplificação aceitável — ver CalendarioSemanal). Um
  // dia que já é culto nunca perde essa cor por também ser ensaio de
  // outro culto (raro, mas o culto é a informação mais importante).
  const diasEnsaio = new Set();
  eventosMes.forEach((ev) => {
    const iso = ev.escala?.dataEnsaio;
    if (!iso) return;
    const [ea, em, ed] = iso.split("-").map(Number);
    if (ea === ano && em - 1 === mes) diasEnsaio.add(ed);
  });

  const celulas = [];
  for (let i = 0; i < primeiro; i++) celulas.push(<div className="cald vazio" key={`v${i}`} />);
  for (let d = 1; d <= dias; d++) {
    const ev = porDia[d];
    let cl = "cald";
    if (ev) {
      const souEscalado = ev.escala.pessoas.includes(uid);
      const porConfirmar = souEscalado && ev.escala.publicado && !confirmados?.has(ev.id);
      cl += porConfirmar ? " naoconfirmado" : souEscalado ? " sirvo" : " culto";
    } else if (diasEnsaio.has(d)) {
      cl += " ensaio";
    }
    if (ehHoje(d)) cl += " hoje";
    celulas.push(
      <div
        key={d} className={cl}
        style={ev ? { cursor: "pointer" } : undefined}
        onClick={ev ? () => onAbrirDia(ev.id) : undefined}
      >
        {d}
      </div>
    );
  }

  const algumaEscala = eventosMes.some((e) => e.escala.pessoas.length);
  const algumaPorConfirmar = eventosMes.some(
    (e) => e.escala.pessoas.includes(uid) && e.escala.publicado && !confirmados?.has(e.id)
  );
  const algumEnsaio = diasEnsaio.size > 0;

  return (
    <div className="cal">
      <div className="calcab">
        <b>{MESES[mes]} {ano}</b>
        <span className="calnav">
          <button className="calbt" onClick={() => onMudarMes(-1)}>‹</button>
          <button className="calbt" onClick={() => onMudarMes(1)}>›</button>
        </span>
      </div>
      <div className="calgrid">
        {["S", "T", "Q", "Q", "S", "S", "D"].map((x, i) => (
          <div className="calsem" key={i}>{x}</div>
        ))}
      </div>
      <div className="calgrid" style={{ marginTop: 5 }}>{celulas}</div>
      {algumaEscala ? (
        <div className="legenda">
          <span className="lg"><s style={{ background: "linear-gradient(118deg,#001ED1,#001594)" }} />Serves</span>
          <span className="lg"><s style={{ background: "var(--agua)" }} />Culto</span>
          {algumaPorConfirmar && (
            <span className="lg"><s style={{ background: "var(--magenta)" }} />Por confirmar</span>
          )}
          {algumEnsaio && (
            <span className="lg"><s style={{ background: "var(--violeta)" }} />Ensaio</span>
          )}
          <span className="lg"><s style={{ boxShadow: "inset 0 0 0 2.5px var(--lima)" }} />Hoje</span>
        </div>
      ) : (
        <div className="semescala">Sem escala ainda para {MESES[mes].toLowerCase()}</div>
      )}
    </div>
  );
}
