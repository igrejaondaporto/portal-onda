import { svgFn } from "../lib/iconesFuncao";

// a função não guarda cor própria — deriva-se da fase, só para dar variedade visual
const COR_FASE = { pre: "#0019BE", durante: "#0092D4", pos: "#00A88F" };

export default function Bola({ funcao, tamanho = 42 }) {
  if (funcao.foto) {
    return (
      <span
        className="bola avfoto"
        style={{ width: tamanho, height: tamanho, backgroundImage: `url(${funcao.foto})` }}
      />
    );
  }
  return (
    <span
      className="bola"
      style={{ width: tamanho, height: tamanho, background: COR_FASE[funcao.fase] || COR_FASE.pre }}
      dangerouslySetInnerHTML={{ __html: svgFn(funcao.icone, Math.round(tamanho * 0.47)) }}
    />
  );
}
