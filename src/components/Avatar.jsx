import { useState } from "react";
import ImagemExpandida from "./ImagemExpandida";

export default function Avatar({ pessoa, tamanho = 42, fonte = 16 }) {
  const [expandida, setExpandida] = useState(false);
  if (!pessoa) return null;
  const estilo = pessoa.foto
    ? { width: tamanho, height: tamanho, fontSize: fonte, backgroundImage: `url(${pessoa.foto})`, cursor: "pointer" }
    : { width: tamanho, height: tamanho, fontSize: fonte, background: pessoa.cor || "#0019BE" };
  return (
    <>
      <span
        className={`av${pessoa.foto ? " avfoto" : ""}`} style={estilo}
        onClick={pessoa.foto ? (e) => { e.stopPropagation(); setExpandida(true); } : undefined}
      >
        {pessoa.foto ? "" : pessoa.nome?.[0]}
      </span>
      {expandida && <ImagemExpandida src={pessoa.foto} alt={pessoa.nome} onFechar={() => setExpandida(false)} />}
    </>
  );
}
