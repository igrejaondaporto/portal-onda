const ESTADOS = {
  avariado: { tag: "", texto: "Avariado" },
  em_reparacao: { tag: "lim", texto: "Em reparação" },
};

/** Vista de leitura, aberta para qualquer voluntário — mostra o
 *  histórico de melhorias ligadas e o atalho para reportar uma nova
 *  avaria. Editar o catálogo (nome, modelo, local…) é só o líder,
 *  ver SheetEquipamento.jsx. */
export default function SheetEquipamentoDetalhe({ equipamento, melhorias, ministerios, souLiderBase, onFechar, onEditar, onReportarAvaria, onAbrirMelhoria }) {
  if (!equipamento) return null;
  const nomeMinisterio = ministerios.find((m) => m.id === equipamento.ministerioId)?.nome;
  const ligadas = melhorias.filter((m) => m.equipamentoId === equipamento.id);
  const estado = ESTADOS[equipamento.estado];

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{equipamento.nome}</h2>
        <p className="ds" style={{ marginTop: 6 }}>
          {[equipamento.modelo, equipamento.local, nomeMinisterio].filter(Boolean).join(" · ") || "Sem mais detalhes"}
        </p>
        {equipamento.nSerie && <p className="ds">Nº série {equipamento.nSerie}</p>}
        {estado && <span className={`tag ${estado.tag}`} style={{ marginTop: 8, display: "inline-block" }}>{estado.texto}</span>}
        {equipamento.foto && <img src={equipamento.foto} className="fotofn" alt="" style={{ marginTop: 10 }} />}

        <button className="btn full" style={{ marginTop: 16 }} onClick={onReportarAvaria}>Reportar avaria</button>
        {souLiderBase && (
          <button className="btn sec full" style={{ marginTop: 9 }} onClick={onEditar}>Editar equipamento</button>
        )}

        <label className="rot" style={{ marginTop: 16 }}>Histórico de melhorias</label>
        {ligadas.length === 0 && <div className="vaz">Nada reportado ainda.</div>}
        {ligadas.map((m) => (
          <div className="linha" style={{ cursor: "pointer" }} key={m.id} onClick={() => onAbrirMelhoria(m.id)}>
            <div style={{ flex: 1 }}>
              <p className="nmt">{m.titulo}</p>
              <p className="ds">{m.estado === "resolvida" ? "Resolvida" : m.estado === "em_curso" ? "Em curso" : "Aberta"}</p>
            </div>
            <span className="seta">›</span>
          </div>
        ))}

        <button className="btn sec full" style={{ marginTop: 14 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
