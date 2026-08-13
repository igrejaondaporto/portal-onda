import { useState } from "react";
import ImagemExpandida from "./ImagemExpandida.jsx";

/** Foto redonda com toque para expandir — o mesmo padrão visual das
 *  fotos de Funções (ver Bola.jsx), só que genérico, para qualquer
 *  foto avulsa (equipamentos, melhorias…). Não renderiza nada sem
 *  `src` — quem chama decide o que mostrar no lugar (placeholder,
 *  ícone, ou simplesmente nada). */
export default function FotoRedonda({ src, alt = "", tamanho = 42 }) {
  const [expandida, setExpandida] = useState(false);
  if (!src) return null;
  return (
    <>
      <span
        className="bola avfoto" style={{ width: tamanho, height: tamanho, backgroundImage: `url(${src})`, cursor: "pointer" }}
        onClick={(e) => { e.stopPropagation(); setExpandida(true); }}
      />
      {expandida && <ImagemExpandida src={src} alt={alt} onFechar={() => setExpandida(false)} />}
    </>
  );
}
