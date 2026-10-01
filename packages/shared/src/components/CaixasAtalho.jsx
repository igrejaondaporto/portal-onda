/**
 * As caixas de cor no fim do Início, por baixo de "A base" (2026-10,
 * pedido do dono do produto: "coloca esses dois box assim pra todas as
 * bases — tem umas sem cor, umas diferentes — e mais um box de verde
 * lima do Mural Onda"). O desenho é o que a Louvor já tinha:
 *
 * - Reembolsos, laranja — para toda a gente;
 * - Solicitar BG, violeta — só quando a app passa `onSolicitarBG`
 *   (o líder; a Comunicação nunca passa, é ela quem recebe os pedidos);
 * - Mural Onda, lima — link para mural.igrejaonda.pt.
 *
 * Reembolsos e Solicitar BG não têm entrada na barra de baixo; este é o
 * único caminho até eles, por isso vão em cor e não como mais uma linha.
 */
const ROTULO = { fontSize: 11, fontWeight: 600, opacity: 0.85 };
const TITULO = { fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" };
const SETA = <span style={{ fontSize: 24 }}>›</span>;

export default function CaixasAtalho({ onReembolsos, onSolicitarBG, emCurso = 0 }) {
  return (
    <>
      <div className="destaque" style={{ background: "var(--laranja)", marginTop: 14, marginBottom: 0 }} onClick={() => onReembolsos?.()}>
        <div>
          <p style={ROTULO}>Reembolsos</p>
          <p style={TITULO}>Nota e valor</p>
        </div>
        {SETA}
      </div>
      {onSolicitarBG && (
        <div className="destaque" style={{ background: "var(--violeta)", marginTop: 10, marginBottom: 0 }} onClick={onSolicitarBG}>
          <div>
            <p style={ROTULO}>Solicitar BG</p>
            <p style={TITULO}>Peças gráficas, vídeo ou fotografia</p>
          </div>
          {emCurso > 0 ? (
            <span style={{ background: "rgba(255,255,255,.25)", color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "5px 11px", borderRadius: 100, whiteSpace: "nowrap" }}>
              {emCurso} em curso
            </span>
          ) : SETA}
        </div>
      )}
      <a
        className="destaque" href="https://mural.igrejaonda.pt"
        style={{ background: "var(--lima)", color: "var(--tinta)", textDecoration: "none", marginTop: 10, marginBottom: 0 }}
      >
        <div>
          <p style={ROTULO}>Mural Onda</p>
          <p style={TITULO}>Dou, vendo, arrendo e procuro</p>
        </div>
        {SETA}
      </a>
    </>
  );
}
