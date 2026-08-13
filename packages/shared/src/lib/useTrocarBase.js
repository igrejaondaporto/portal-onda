import { useState } from "react";
import { trocarBase } from "./auth";
import { useTorrada } from "./TorradaContext";

/** Estado partilhado de "trocar de base" — usado pelo botão do
 *  cabeçalho e pelo menu do perfil, para não duplicar a lógica do
 *  link de reserva (nem todo browser/PWA deixa navegar sozinho para
 *  outro domínio por script). */
export function useTrocarBase() {
  const torrada = useTorrada();
  const [aTrocar, setATrocar] = useState(false);
  const [destino, setDestino] = useState(null); // { nome, url }

  async function escolherBase(base) {
    if (aTrocar) return;
    setATrocar(true);
    setDestino(null);
    const r = await trocarBase(base.id);
    if (!r.ok) { torrada(r.mensagem); setATrocar(false); return; }
    // em localhost troca no sítio (sem url); noutro domínio, guarda o
    // link de reserva — os separadores voltam a responder ao fim de
    // 2.5s se a navegação automática não tirar da página.
    if (r.url) {
      setDestino({ nome: base.nome, url: r.url });
      setTimeout(() => setATrocar(false), 2500);
    }
  }

  return { aTrocar, destino, escolherBase };
}
