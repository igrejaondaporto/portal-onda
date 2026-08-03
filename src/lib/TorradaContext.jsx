import { createContext, useCallback, useContext, useRef, useState } from "react";

const Ctx = createContext(() => {});

export function TorradaProvider({ children }) {
  const [texto, setTexto] = useState("");
  const [aberta, setAberta] = useState(false);
  const temporizador = useRef(null);

  const mostrar = useCallback((msg) => {
    setTexto(msg);
    setAberta(true);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAberta(false), 2400);
  }, []);

  return (
    <Ctx.Provider value={mostrar}>
      {children}
      <div className={`torrada${aberta ? " on" : ""}`}>{texto}</div>
    </Ctx.Provider>
  );
}

export const useTorrada = () => useContext(Ctx);
