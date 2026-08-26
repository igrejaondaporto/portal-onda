import { useEffect } from "react";

/**
 * Placeholder — a especificação completa (campos, concelhos/freguesias,
 * GDs por região, duplicados por telemóvel, RGPD) já está em
 * apps/pessoal/CLAUDE.md, "Formulário de contacto". Fica por implementar
 * nesta fase por decisão do dono do produto (Acomodação primeiro).
 */
export default function Formulario({ ativo, definirCabecalho }) {
  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({ titulo: "Formulário", subtitulo: "Novo contacto de visitante", chips: [] });
  }, [ativo, definirCabecalho]);

  return (
    <div className="vaz">
      Em construção. O formulário de contacto (nome, telemóvel, concelho/freguesia, GD sugerido) chega numa próxima atualização.
    </div>
  );
}
