import { useRef, useState } from "react";
import SheetDesbloquearModeracao from "./SheetDesbloquearModeracao";

/** Envolve o logo do cabeçalho — 5 toques em menos de 1.5s abrem a
 *  folha que concede o painel de moderação a quem já entrou, mesmo
 *  gesto do GatilhoDev de cada base (packages/shared), mas próprio do
 *  Mural: não há sessão de dev aqui (CLAUDE.md desta app, "Sem
 *  GatilhoDev" — isso continua a valer, é sobre acesso de dev por
 *  base), e sem sessão nenhuma não há ninguém para marcar como admin.
 *  Por isso só reage com `ativo` (eu != null). */
export default function GatilhoModeracao({ ativo, onConcedido, children }) {
  const toques = useRef([]);
  const [aberto, setAberto] = useState(false);

  function onToque() {
    if (!ativo) return;
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
      {aberto && (
        <SheetDesbloquearModeracao
          onFechar={() => setAberto(false)}
          onConcedido={() => { setAberto(false); onConcedido(); }}
        />
      )}
    </>
  );
}
