/**
 * Os avisos locais da ordem do culto — só o nome do evento.
 *
 * Antes mostrava um crachá de data à esquerda e a linha de
 * "Informações" por baixo do nome. Nenhum dos dois sobrevive ao PDF a
 * sério: a coluna "Informações" tanto traz "27-28/11" como "26/set" ou
 * "No final do culto", e o que saía era um crachá inventado ("28 nov")
 * e uma legenda truncada ("Video +"). Quem monta a projeção precisa da
 * lista completa do que vai ser anunciado — CONF26, CASA DE ORAÇÃO,
 * BATISMOS, STORE — e essa é a coluna "Evento", a única que a grelha
 * garante preenchida em todas as linhas (pedido do líder da Técnica,
 * 2026-09). O resto continua guardado no aviso e visível no ecrã de
 * revisão, para o líder poder criar um culto especial a partir dele.
 */
export default function AvisosLocais({ avisos, style }) {
  if (!avisos?.length) return null;
  return (
    <div style={style}>
      <p className="cap">Avisos locais</p>
      {avisos.map((a, i) => (
        <div className="oc-aviso" key={i}>
          <span className="quadmin" style={{ background: "var(--lima)" }} />
          <p className="nm" style={{ fontSize: 14.5, fontWeight: 700 }}>{a.nome}</p>
        </div>
      ))}
    </div>
  );
}
