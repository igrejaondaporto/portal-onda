import { ROTULO_STATUS_RELATO, COR_STATUS_RELATO, ROTULO_TIPO_RELATO } from "../lib/relatos.js";

/** "Reportar problema" — o ponto de entrada, igual em qualquer base
 *  (ver CLAUDE.md raiz). Lista o que ESTA pessoa já reportou, com o
 *  botão para abrir um novo — mesmo padrão de `SheetSolicitacoesBase`,
 *  mas aberto a qualquer voluntário, não só ao líder. */
export default function SheetReportarProblema({ relatos, onFechar, onNovoRelato, onVerDetalhe }) {
  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Reportar problema</h2>
        <p className="sb2">Bugs, erros ou melhorias do painel — o Onda Tech Hub trata.</p>

        <button className="btn full" style={{ marginTop: 14 }} onClick={onNovoRelato}>Novo relato</button>

        <label className="rot" style={{ marginTop: 18 }}>Os teus relatos</label>
        {relatos.length === 0 && <div className="vaz">Ainda não reportaste nada.</div>}
        {relatos.map((r) => (
          <div className="linha" style={{ cursor: "pointer" }} key={r.id} onClick={() => onVerDetalhe(r)}>
            <div style={{ flex: 1 }}>
              <p className="nmt">{r.titulo}</p>
              <p className="ds">{ROTULO_TIPO_RELATO[r.tipo]}</p>
            </div>
            <span className="tag" style={{ background: COR_STATUS_RELATO[r.status], marginLeft: "auto" }}>
              {ROTULO_STATUS_RELATO[r.status]}
            </span>
          </div>
        ))}

        <button className="btn sec full" style={{ marginTop: 16 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
