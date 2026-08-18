import { useRef, useState } from "react";
import SheetAcessoDev from "./SheetAcessoDev";

/** Envolve o logo no ecrã de entrada — 5 toques em menos de 1.5s
 *  abrem a folha de acesso de dev. Ninguém encontra isto sem saber
 *  que existe; a senha é a segurança real, isto é só não deixar o
 *  botão à vista de qualquer voluntário curioso. */
export default function GatilhoDev({ children }) {
  const toques = useRef([]);
  const [aberto, setAberto] = useState(false);

  function onToque() {
    const agora = Date.now();
    toques.current = [...toques.current.filter((t) => agora - t < 1500), agora];
    if (toques.current.length >= 5) {
      toques.current = [];
      setAberto(true);
    }
  }

  return (
    <>
      <span onClick={onToque}>{children}</span>
      {aberto && <SheetAcessoDev onFechar={() => setAberto(false)} />}
    </>
  );
}
