/**
 * Quantas crianças estão presentes, por sala — pedido 2026-09: "logo
 * NA TELA inicial do domingo já apareça um POP UP GRANDE perguntando
 * quantas crianças estão presentes... e essa contagem já vai direto
 * pra contagem da base pessoal". Escreve em `eventos/{e}/contagem/
 * geral` (a Contagem da Base Pessoal, `apps/pessoal/src/lib/
 * contagem.js`) pela Cloud Function `registarContagemSala` — nunca
 * escrita direta, cada base só pode tocar na sua própria categoria
 * dentro do mapa `categorias` (ver `functions/contagemSalas.js`).
 *
 * A LEITURA não passa por função nenhuma — `eventos/{e}/contagem/
 * geral` já é `allow read: if autenticado()`, o mesmo padrão de
 * sempre ("função para escrever o que exige regra fina, onSnapshot
 * para o resto").
 */
import { onSnapshot } from "firebase/firestore";
import { chamar } from "@portal/shared/lib/firebase.js";
import { cContagemPessoal } from "./modelo";

export const ouvirContagemPessoal = (eventoId, cb) => {
  if (!eventoId) return () => {};
  return onSnapshot(cContagemPessoal(eventoId), (s) => cb(s.exists() ? s.data() : null));
};

export const registarContagemSala = (eventoId, categoria, valor) =>
  chamar("registarContagemSala")({ eventoId, categoria, valor }).then((r) => r.data);
