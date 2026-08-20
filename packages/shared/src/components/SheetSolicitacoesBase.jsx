import { dataPorExtenso } from "../lib/data.js";

// mesma paleta de cor por estado que a Comunicação já usa em
// Solicitacoes.jsx (cinza=por fazer, azul=a decorrer, laranja=à
// espera de alguém, verde=fechado bem, magenta=recusado) — para o
// líder reconhecer o estado sem ler o rótulo.
export const ROTULO_STATUS_SOLICITACAO = {
  fila: "Na fila", producao: "Em produção", revisao: "Em revisão",
  entregue: "Entregue", recusada: "Recusada",
};
export const COR_STATUS_SOLICITACAO = {
  fila: "var(--cinza)", producao: "var(--azul)", revisao: "var(--laranja)",
  entregue: "var(--verde)", recusada: "var(--magenta)",
};

/** "Solicitar BG" — genuinamente igual em qualquer base que pede à
 *  Comunicação (Apoio/Técnica/Backstage), por isso vive em
 *  packages/shared. Só o líder da base abre isto (gate no item que
 *  chama, na Home — ver Inicio.jsx de cada app). Junta num sítio só
 *  o que antes eram dois caminhos sem ligação nenhuma: abrir um
 *  pedido (Painel do líder → Comunicação) e nunca mais saber o que
 *  aconteceu com ele. */
export default function SheetSolicitacoesBase({ solicitacoes, onFechar, onNovoPedido, onVerDetalhe }) {
  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Solicitar BG</h2>
        <p className="sb2">Peças gráficas, vídeo ou fotografia — pede à Comunicação e acompanha aqui até saíres com a entrega.</p>

        <button className="btn full" style={{ marginTop: 14 }} onClick={onNovoPedido}>Novo pedido</button>

        <label className="rot" style={{ marginTop: 18 }}>Os teus pedidos</label>
        {solicitacoes.length === 0 && <div className="vaz">Ainda não pediste nada.</div>}
        {solicitacoes.map((s) => (
          <div className="linha" style={{ cursor: "pointer" }} key={s.id} onClick={() => onVerDetalhe(s)}>
            <div style={{ flex: 1 }}>
              <p className="nmt">{s.titulo}</p>
              <p className="ds">prazo {dataPorExtenso(s.prazo)}</p>
            </div>
            <span className="tag" style={{ background: COR_STATUS_SOLICITACAO[s.status], marginLeft: "auto" }}>
              {ROTULO_STATUS_SOLICITACAO[s.status]}
            </span>
          </div>
        ))}

        <button className="btn sec full" style={{ marginTop: 16 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
