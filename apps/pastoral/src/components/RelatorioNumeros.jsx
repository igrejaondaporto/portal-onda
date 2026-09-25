import { createPortal } from "react-dom";
import { eur } from "@portal/shared/lib/data.js";
import { textoAtraso } from "./Atraso";

/**
 * Números em papel (ou "Guardar como PDF") — pedido 2026-09: "um
 * botão de exportar, dos três meses e do ano".
 *
 * Mesmo caminho de `OrdemImprimivel.jsx`, pelas mesmas razões (lê o
 * cabeçalho dela): uma folha de estilos de impressão em vez de um PDF
 * gerado no servidor — zero dependências, zero deploy de functions, e
 * o "Guardar como PDF" do browser é o que toda a gente usa de qualquer
 * forma. Portal para `document.body`, sempre montado e escondido.
 *
 * A diferença: as duas folhas vivem montadas ao mesmo tempo (Ordem e
 * Números ficam sempre montadas, ver `Sessao.jsx`), e sem mais nada
 * imprimir numa imprimia as duas. `exportarNumeros()` marca
 * `body[data-imprimir="numeros"]` só durante a impressão, e o CSS
 * (`.pa-print-rel` em `pastoral.css`) mostra ESTA folha só com essa
 * marca e esconde a da ordem com ela — a Ordem continua a imprimir-se
 * sozinha como sempre, sem mudar uma linha.
 *
 * Só números, nunca nomes: é um relatório para circular (reunião de
 * liderança, email), e nada nele identifica uma pessoa.
 */
export function exportarNumeros() {
  const corpo = document.body;
  const limpar = () => { delete corpo.dataset.imprimir; };
  corpo.dataset.imprimir = "numeros";
  window.addEventListener("afterprint", limpar, { once: true });
  window.print();
}

const dataPt = (iso) => iso.split("-").reverse().join("/");
const ou = (v) => (v === null || v === undefined ? "—" : v);

export default function RelatorioNumeros({ titulo, intervalo, resumo, porAno, domingos, criancas, ofertaPorMes, blocos }) {
  return createPortal(
    <div className="pa-print pa-print-rel" aria-hidden="true">
      <h1>Números · {titulo}</h1>
      <p className="pa-print-sub">
        {intervalo[0] ? `${dataPt(intervalo[0])} a ${dataPt(intervalo[1])}` : "Sem cultos no período"} · Painel Pastoral,
        gerado a {dataPt(new Date().toLocaleDateString("sv-SE"))}
      </p>

      <h2>Resumo</h2>
      <table className="pa-print-tab pa-print-num">
        <tbody>
          {resumo.map(([rotulo, valor]) => (
            <tr key={rotulo}><td>{rotulo}</td><td>{ou(valor)}</td></tr>
          ))}
        </tbody>
      </table>

      {porAno.length > 0 && (
        <>
          <h2>Por ano</h2>
          <table className="pa-print-tab pa-print-num">
            <thead>
              <tr><th>Ano</th><th>Domingos</th><th>Presença média</th><th>Visitantes</th><th>Crianças (média)</th><th>Ofertas</th></tr>
            </thead>
            <tbody>
              {porAno.map((a) => (
                <tr key={a.ano}>
                  <td>{a.ano}</td><td>{a.domingos}</td><td>{ou(a.presenca)}</td><td>{a.visitantes || "—"}</td>
                  <td>{ou(a.criancas)}</td><td>{a.oferta ? eur(a.oferta) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Domingo a domingo</h2>
      {domingos.length === 0 ? <p className="pa-print-sub">Nenhum culto com números neste período.</p> : (
        <table className="pa-print-tab pa-print-num">
          <thead>
            <tr><th>Culto</th><th>Auditório</th><th>Voluntários</th><th>Crianças</th><th>Total</th><th>Visitantes</th><th>Apelo</th><th>Cadastrados</th></tr>
          </thead>
          <tbody>
            {domingos.map((d) => (
              <tr key={d.chave}>
                <td>{dataPt(d.data)}</td><td>{ou(d.auditorio)}</td><td>{d.voluntarios || "—"}</td><td>{ou(d.criancas)}</td>
                <td><b>{ou(d.total)}</b></td><td>{ou(d.visitantes)}</td><td>{ou(d.apelo)}</td><td>{d.cadastrados || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {criancas.length > 0 && (
        <>
          <h2>Crianças por sala</h2>
          <table className="pa-print-tab pa-print-num">
            <thead>
              <tr><th>Culto</th><th>Baby</th><th>Fun</th><th>Júnior</th><th>New</th><th>Shift</th><th>Total</th></tr>
            </thead>
            <tbody>
              {criancas.map((d) => (
                <tr key={d.chave}>
                  <td>{dataPt(d.data)}</td>
                  {["baby", "fun", "junior", "new", "shift"].map((s) => <td key={s}>{ou(d.contagem?.[s])}</td>)}
                  <td><b>{d.total}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {ofertaPorMes.length > 0 && (
        <>
          <h2>Ofertas por mês</h2>
          <table className="pa-print-tab pa-print-num">
            <thead><tr><th>Mês</th><th>Total</th></tr></thead>
            <tbody>
              {ofertaPorMes.map((m) => <tr key={m.chave}><td>{m.rotulo}</td><td>{eur(m.valor)}</td></tr>)}
            </tbody>
          </table>
        </>
      )}

      {blocos.some((b) => b.vezes) && (
        <>
          <h2>O culto começa a horas?</h2>
          <table className="pa-print-tab pa-print-num">
            <thead><tr><th>Bloco</th><th>Atraso médio</th><th>Cultos</th></tr></thead>
            <tbody>
              {blocos.map((b) => (
                <tr key={b.chave}><td>{b.rotulo}</td><td>{b.vezes ? textoAtraso(b.media) : "—"}</td><td>{b.vezes || "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="pa-print-rodape">
        Auditório e visitantes: Mapa (Base Pessoal). Apelo: Mapa desde 27/09/2026, Contagem antes. Voluntários: escalas publicadas das bases. Crianças: contador
        de cada sala. Ofertas: Financeiro. "—" quer dizer que não foi contado, nunca zero.
      </p>
    </div>,
    document.body,
  );
}
