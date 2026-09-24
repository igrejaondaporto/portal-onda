import { createContext, useContext, useEffect, useState } from "react";
import { ouvirTiposCulto, TIPOS_CULTO_PADRAO } from "./tipoCulto.js";

const Ctx = createContext(TIPOS_CULTO_PADRAO);

/**
 * Os tipos de culto (Ceia, Contribua, Culto da Família…), ao vivo,
 * para toda a app — evita passar `tipos` por prop até cada ecrã que
 * formata ou escolhe um tipo. Montado uma vez no shell de cada app
 * (Sessao.jsx), mesmo padrão de TorradaProvider/TourProvider ao lado
 * — só nas apps que mostram/publicam tipo de culto (hoje: Louvor,
 * Louvor Kinder, Backstage, Pastoral — ver CLAUDE.md raiz).
 */
export function TiposCultoProvider({ children }) {
  const [tipos, setTipos] = useState(TIPOS_CULTO_PADRAO);
  useEffect(() => ouvirTiposCulto(setTipos), []);
  return <Ctx.Provider value={tipos}>{children}</Ctx.Provider>;
}

export const useTiposCulto = () => useContext(Ctx);
