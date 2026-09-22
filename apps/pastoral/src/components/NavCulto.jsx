import { nomeEvento } from "@portal/shared/lib/data.js";

/** O culto atual, com setas ‹ › para o anterior/seguinte — mesmo
 *  `.calnav`/`.calbt` que as outras bases já usam para navegar por
 *  mês (`Culto.jsx`), aqui a navegar por culto dentro da janela já
 *  carregada (`eventos`). Troca o dropdown de "escolher uma data" por
 *  "a data certa por omissão, e uma seta se for preciso outra" — o
 *  culto por omissão já vem de `proximoCulto`/`ouvirPonteiroAoVivo`,
 *  isto só deixa andar para os lados a partir dele. */
export default function NavCulto({ eventos, eventoId, evento, onEscolher, extra }) {
  if (eventos.length <= 1) return null;
  const idx = eventos.findIndex((e) => e.id === eventoId);

  return (
    <div className="cabecalho" style={{ marginTop: 14 }}>
      <h3 style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {evento ? nomeEvento(evento) : "Sem culto"}
        </span>
        {extra}
      </h3>
      <span className="calnav">
        <button
          className="calbt" disabled={idx <= 0}
          onClick={() => onEscolher(eventos[idx - 1].id)} aria-label="Culto anterior"
        >‹</button>
        <button
          className="calbt" disabled={idx === -1 || idx >= eventos.length - 1}
          onClick={() => onEscolher(eventos[idx + 1].id)} aria-label="Próximo culto"
        >›</button>
      </span>
    </div>
  );
}
