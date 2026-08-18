import { useState } from "react";
import { svgFn } from "../lib/iconesFuncao";
import ImagemExpandida from "@portal/shared/components/ImagemExpandida.jsx";

// a função não guarda cor própria — deriva-se da fase, só para dar variedade visual
const COR_FASE = { pre: "#0019BE", durante: "#0092D4", pos: "#00A88F" };

export default function Bola({ funcao, tamanho = 42 }) {
  const [expandida, setExpandida] = useState(false);

  if (funcao.foto) {
    return (
      <>
        <span
          className="bola avfoto" style={{ width: tamanho, height: tamanho, backgroundImage: `url(${funcao.foto})`, cursor: "pointer" }}
          onClick={(e) => { e.stopPropagation(); setExpandida(true); }}
        />
        {expandida && <ImagemExpandida src={funcao.foto} alt={funcao.nome} onFechar={() => setExpandida(false)} />}
      </>
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
