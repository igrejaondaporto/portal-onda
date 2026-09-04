import { diaSemanaAbrev } from "@portal/shared/lib/data.js";

const paraISO = (d) => {
  const ano = d.getFullYear(), mes = String(d.getMonth() + 1).padStart(2, "0"), dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

/**
 * Semana de Segunda a Domingo que termina no `domingoISO` dado — é
 * sempre a semana de ensaio "antes" desse culto (só dá para ensaiar
 * de segunda a sábado da semana do próprio culto, pedido do líder).
 * Domingo pintado de rosa (é o culto); o dia escolhido como ensaio,
 * de azul. Omitir `onSelecionar` torna isto só leitura (mostra o
 * estado, não deixa escolher — usado na caixinha de Ensaio em
 * Escala.jsx); com `onSelecionar`, só os dias de Segunda a Sábado são
 * clicáveis (o Domingo é sempre o culto, nunca um dia de ensaio).
 */
export default function CalendarioSemanal({ domingoISO, ensaioISO, onSelecionar }) {
  const [ano, mes, dia] = domingoISO.split("-").map(Number);
  const domingo = new Date(ano, mes - 1, dia);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(domingo);
    d.setDate(d.getDate() - 6 + i); // segunda (i=0) … domingo (i=6)
    return d;
  });

  return (
    <div className="cal-semanal">
      {dias.map((d) => {
        const iso = paraISO(d);
        const ehCulto = iso === domingoISO;
        const ehEnsaio = !ehCulto && iso === ensaioISO;
        const podeEscolher = !!onSelecionar && !ehCulto;
        let cl = "cal-sem-dia";
        if (ehCulto) cl += " culto";
        else if (ehEnsaio) cl += " ensaio";
        return (
          <div
            key={iso} className={cl}
            style={podeEscolher ? { cursor: "pointer" } : undefined}
            onClick={podeEscolher ? () => onSelecionar(iso) : undefined}
          >
            <span className="cal-sem-dow">{diaSemanaAbrev(iso)}</span>
            <span className="cal-sem-num">{d.getDate()}</span>
          </div>
        );
      })}
    </div>
  );
}
