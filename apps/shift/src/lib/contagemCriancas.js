/**
 * Quantas crianças/adolescentes estão presentes — pedido 2026-09
 * ("quero o mesmo no painel do SHIFT e do New"), mesmo mecanismo da
 * Kinder (ver `apps/kinder/src/lib/contagemCriancas.js`): escreve em
 * `eventos/{e}/contagem/geral` (a Contagem da Base Pessoal) pela
 * Cloud Function `registarContagemSala` — nunca escrita direta, esta
 * base só pode tocar na sua própria categoria ("shift") dentro do
 * mapa `categorias`.
 *
 * A LEITURA não passa por função nenhuma — `eventos/{e}/contagem/
 * geral` já é `allow read: if autenticado()`.
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
