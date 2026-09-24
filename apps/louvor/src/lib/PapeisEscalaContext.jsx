import { createContext, useContext, useEffect, useState } from "react";
import { ouvirPapeisEscala, PAPEIS_PADRAO } from "./modelo";

const Ctx = createContext(PAPEIS_PADRAO);

/**
 * Os papéis da escala (Lead, Guitarra, Bateria…), ao vivo, para toda
 * a app — evita passar `papeis` por prop de Sessao.jsx até cada
 * ecrã/sheet que precisa formatar um papel (Escala, SheetEscala,
 * SheetPessoa, Equipamentos, Perfil, Início, SheetConfirmarPresenca…).
 * Montado uma vez em Sessao.jsx, dentro do TorradaProvider — o mesmo
 * padrão de TourProvider ao lado.
 */
export function PapeisEscalaProvider({ children }) {
  const [papeis, setPapeis] = useState(PAPEIS_PADRAO);
  useEffect(() => ouvirPapeisEscala(setPapeis), []);
  return <Ctx.Provider value={papeis}>{children}</Ctx.Provider>;
}

export const usePapeisEscala = () => useContext(Ctx);
