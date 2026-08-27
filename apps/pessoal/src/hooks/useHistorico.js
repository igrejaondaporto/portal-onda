import { useRef } from "react";

/**
 * Pilha local de desfazer — { id, estadoAnterior } ou { grupo: [...] }
 * para o "chegou grupo de N". Não vive no Firestore: quem tem a
 * função Mapa só desfaz o que fez na própria sessão do telemóvel dele.
 */
export function useHistorico() {
  const pilha = useRef([]);

  function empilhar(entrada) {
    pilha.current.push(entrada);
  }

  function desempilhar() {
    return pilha.current.pop() ?? null;
  }

  return { empilhar, desempilhar };
}
