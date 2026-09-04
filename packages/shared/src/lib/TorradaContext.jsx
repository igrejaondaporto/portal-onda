import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { acabouDeAtualizar } from "./avisoAtualizacao.js";

const Ctx = createContext(() => {});

export function TorradaProvider({ children }) {
  const [texto, setTexto] = useState("");
  const [aberta, setAberta] = useState(false);
  const [mau, setMau] = useState(false);
  const temporizador = useRef(null);

  // segundo argumento opcional: true pinta a torrada de vermelho — só
  // o PainelChamadas usa isto hoje (erro de ligação/campo vazio), mas
  // qualquer chamador pode passar
  const mostrar = useCallback((msg, ehMau) => {
    setTexto(msg);
    setMau(!!ehMau);
    setAberta(true);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAberta(false), 2400);
  }, []);

  // Aviso de "acabou de atualizar sozinho" (ver pwa.js) — fica aqui,
  // não em cada app, porque toda base já monta um TorradaProvider só.
  useEffect(() => {
    if (acabouDeAtualizar()) mostrar("Atualizámos a app para a versão mais recente");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider value={mostrar}>
      {children}
      <div className={`torrada${aberta ? " on" : ""}${mau ? " mau" : ""}`}>{texto}</div>
    </Ctx.Provider>
  );
}

export const useTorrada = () => useContext(Ctx);
