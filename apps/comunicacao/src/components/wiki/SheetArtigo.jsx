export default function SheetArtigo({ artigo, onFechar }) {
  if (!artigo) return null;
  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{artigo.titulo}</h2>
        {artigo.resumo && <p className="sb2">{artigo.resumo}</p>}
        {/* sem editor no app (ver CLAUDE.md desta base) — o conteúdo
          * é texto simples, mostrado tal como foi escrito no Firestore,
          * sem interpretar markdown */}
        <p className="ds" style={{ marginTop: 16, whiteSpace: "pre-wrap", lineHeight: 1.6, color: "var(--tinta)" }}>
          {artigo.conteudo}
        </p>
        <button className="btn sec full" style={{ marginTop: 18 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
