import { nomeEvento } from "@portal/shared/lib/data.js";
import { nomeTipoCulto } from "@portal/shared/lib/tipoCulto.js";

/**
 * A ordem do culto em papel.
 *
 * O pastor monta no painel, mas quem está na régie quer a folha na
 * mão: um telemóvel apagado a meio do culto é um telemóvel apagado, e
 * o papel não tem bateria. Fecha o ciclo ao contrário do que existia —
 * antes o papel (PDF) era a origem e a app o destino; agora a app é a
 * origem e o papel um dos destinos.
 *
 * ── Porque não é um PDF gerado no servidor ──────────────────────
 *
 * Seria uma Cloud Function nova, com uma biblioteca de PDF, para
 * produzir o que o botão "Imprimir" do browser já produz — incluindo
 * "Guardar como PDF", que é o que toda a gente usa de qualquer forma.
 * Uma folha de estilos de impressão custa zero dependências, zero
 * deploy de functions, e funciona offline. Se um dia fizer falta o PDF
 * anexado a um email, aí sim: o servidor passa a ter razão para o
 * gerar.
 *
 * ── O que está impresso, e o que não ────────────────────────────
 *
 * Vai a hora, o momento, a duração, quem é responsável e o que entra
 * na projeção — as cinco colunas que a régie usa. NÃO vão os avisos
 * com "criar culto" marcado como tal: em papel isso é ruído (é uma
 * instrução para o sistema, não para quem lê), e o aviso em si vai na
 * mesma, com a data.
 *
 * Fica sempre montado e escondido (`display: none` fora da impressão).
 * Montar só ao carregar em Imprimir corria o risco de o `window.print`
 * disparar antes de o React ter pintado — e a folha saía em branco.
 */
export default function OrdemImprimivel({ evento, momentos, avisos, horas }) {
  if (!evento) return null;

  return (
    <div className="pa-print" aria-hidden="true">
      <h1>{nomeEvento(evento)}</h1>
      <p className="pa-print-sub">
        {evento.tipoCulto ? `${nomeTipoCulto(evento.tipoCulto)} · ` : ""}
        Portas {horas.portasAbertas ?? "—"} · começa {horas.inicio ?? "—"} · acaba {horas.fim ?? "—"}
      </p>

      <table className="pa-print-tab">
        <thead>
          <tr>
            <th>Hora</th>
            <th>Momento</th>
            <th>Min</th>
            <th>Quem</th>
            <th>Projeção</th>
          </tr>
        </thead>
        <tbody>
          {momentos.map((m, i) => (
            <tr key={m._k ?? i}>
              <td className="pa-print-hora">{m.hora}</td>
              <td>
                <b>{m.momento}</b>
                {m.detalhe ? <span className="pa-print-det">{m.detalhe}</span> : null}
              </td>
              <td className="pa-print-min">{m.minutos}</td>
              <td>{m.responsavel || ""}</td>
              <td>{m.projecao || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {avisos.length > 0 && (
        <>
          <h2>Avisos</h2>
          <ul className="pa-print-avisos">
            {avisos.map((a, i) => (
              <li key={a._k ?? i}>
                <b>{a.nome}</b>
                {a.data ? ` — ${a.data}` : ""}
                {a.info ? <span className="pa-print-det">{a.info}</span> : null}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="pa-print-rodape">igrejaonda · Portal do Voluntário</p>
    </div>
  );
}
