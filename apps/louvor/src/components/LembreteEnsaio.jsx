import { dataPorExtenso } from "@portal/shared/lib/data.js";

/**
 * Lembrete do ensaio da semana, no Início — só uma frase, sem
 * confirmação nenhuma (pedido do líder, 2026-09: "não vou querer
 * confirmação, quero apenas um lembrete: tem ensaio esta semana,
 * tal dia, tal local, tal horário"). Antes tinha "Vou"/"Não posso";
 * saiu, e com ele as fotinhas de quem ia na caixinha "Ensaio" da
 * Escala — já não há nada para ninguém confirmar.
 *
 * Aparece a quem está escalado num culto com ensaio marcado entre
 * hoje e daqui a 7 dias (ver Inicio.jsx), até ao próprio dia.
 */
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** "2026-10-01" em hora LOCAL (nunca toISOString, que é UTC e em
 *  Portugal vira o dia anterior entre a meia-noite e a 1h no verão). */
export function isoLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Hoje", "Amanhã" ou "Quinta" — quem abre a app em pé, com pressa,
 *  percebe mais depressa "amanhã" do que uma data. */
function quando(iso) {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  if (iso === isoLocal()) return "Hoje";
  if (iso === isoLocal(amanha)) return "Amanhã";
  const [a, m, d] = iso.split("-").map(Number);
  return DIAS[new Date(a, m - 1, d).getDay()];
}

export default function LembreteEnsaio({ evento }) {
  const { dataEnsaio, horaEnsaio, localEnsaio } = evento.escala;
  return (
    <div className="destaque lv-ensaio">
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>Tens ensaio esta semana</p>
        <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>
          {quando(dataEnsaio)}, {dataPorExtenso(dataEnsaio)}{horaEnsaio ? ` · ${horaEnsaio}` : ""}
        </p>
        <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>
          {localEnsaio ? `📍 ${localEnsaio} · ` : ""}para o culto de {dataPorExtenso(evento.data)}
        </p>
      </div>
      <span style={{ fontSize: 24 }}>🎙️</span>
    </div>
  );
}
