import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db, BASE_ID } from "./firebase.js";

/**
 * Os textos que o líder escreveu para a enquete desta base, em
 * `bases/{base}/definicoes/mensagensEnquete` → `{ enquete, lembrete }`.
 *
 * Usa `definicoes` (o líder escreve direto, a regra já existe para
 * qualquer base) em vez de uma Cloud Function: é um texto, não uma
 * decisão de escala, e assim guardar-se não faz deploy de nada.
 *
 * `null` num campo = "sem texto dele, vale o de fábrica". Se a leitura
 * falhar (regras ainda não publicadas, sem rede) devolve tudo `null`:
 * o pior que acontece é o líder mandar o texto de sempre.
 */
export function useMensagensEnquete() {
  const [mensagens, setMensagens] = useState({ enquete: null, lembrete: null });
  const ref = useMemo(() => doc(db, `bases/${BASE_ID}/definicoes/mensagensEnquete`), []);

  useEffect(() => onSnapshot(
    ref,
    (s) => {
      const d = s.exists() ? s.data() : {};
      setMensagens({ enquete: d.enquete ?? null, lembrete: d.lembrete ?? null });
    },
    () => setMensagens({ enquete: null, lembrete: null }),
  ), [ref]);

  /** @param tipo "enquete" | "lembrete"  @param texto string|null */
  const guardar = useCallback(
    (tipo, texto) => {
      // sem rede o setDoc não falha: fica pendurado à espera de ligação e
      // a folha ficava em "A guardar…" para sempre. As chamadas às
      // Cloud Functions (`chamar`) recusam logo; aqui faz-se o mesmo.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return Promise.reject(new Error("Precisas de estar ligado à internet para isto."));
      }
      return setDoc(ref, { [tipo]: texto ?? null, atualizadoEm: serverTimestamp() }, { merge: true });
    },
    [ref],
  );

  return { mensagens, guardar };
}

/** O endereço que fecha o texto de fábrica ("… tecnica.igrejaonda.pt 🙏").
 *  Vem do sítio onde a app está aberta — a Backstage é `back.`, não
 *  `backstage.`, e escrevê-lo à mão foi como New e SHIFT ficaram a dizer
 *  "apoio.igrejaonda.pt". Em desenvolvimento (localhost) cai no nome da base. */
export function dominioDaBase() {
  const h = typeof window !== "undefined" ? window.location.hostname : "";
  return h.endsWith(".igrejaonda.pt") ? h : `${BASE_ID}.igrejaonda.pt`;
}
