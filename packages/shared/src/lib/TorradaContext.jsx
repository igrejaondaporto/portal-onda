import { createContext, useCallback, useContext, useRef, useState } from "react";

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

  return (
    <Ctx.Provider value={mostrar}>
      {children}
      <div className={`torrada${aberta ? " on" : ""}${mau ? " mau" : ""}`}>{texto}</div>
    </Ctx.Provider>
  );
}

export const useTorrada = () => useContext(Ctx);
