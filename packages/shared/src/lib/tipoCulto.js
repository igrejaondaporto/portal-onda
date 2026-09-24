/**
 * Tipo do culto (Ceia/Contribua/Culto da Família…) — global
 * (`eventos/{eventoId}.tipoCulto`), escrito ao publicar/rever a Ordem
 * do Culto (Backstage `SheetRevisaoOrdem.jsx`/`publicarOrdemCulto`, e
 * o Painel Pastoral `Ordem.jsx`), lido por qualquer base. Era um campo
 * só da Louvor (`eventos/{e}/escalas/louvor.enfase`) até 2026-09,
 * movido para aqui a pedido do líder da Louvor para ter um dono só.
 *
 * A LISTA de tipos passou a ser editável (2026-09, pedido do dono do
 * produto: "adicionei uma nova etiqueta lá no Painel Pastoral, quero
 * que apareça em todas as bases") — `config/tiposCulto` (global,
 * `{lista:[{id,nome}]}`), escrita direta do cliente, só de quem tem a
 * capacidade `ve_tudo_pastoral` (Painel Pastoral — "é uma decisão de
 * quem publica a ordem, não de cada base por si", `firestore.rules`).
 * `TIPOS_CULTO_PADRAO` é só o valor de arranque: o que
 * `scripts/seedTiposCulto.mjs` gravou uma vez, e o que qualquer ecrã
 * mostra por instantes até o primeiro snapshot chegar — nunca uma
 * fonte de verdade paralela. Ver `TiposCultoContext.jsx` (o hook que
 * qualquer app monta) e `apps/pastoral/src/pages/Ordem.jsx` (onde se
 * adiciona um tipo novo).
 *
 * `tipoCultoDefault` é só uma sugestão para quando ainda não há
 * `tipoCulto` gravado nenhum (a ordem deste culto ainda não foi
 * publicada) — nunca grava sozinho, cada base decide se mostra.
 */
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

export const TIPOS_CULTO_PADRAO = [
  { id: "ceia", nome: "Ceia" },
  { id: "contribua", nome: "Contribua" },
  { id: "familia", nome: "Culto da Família" },
];

const cTiposCulto = () => doc(db, "config/tiposCulto");

/** Ao vivo — um tipo adicionado no Painel Pastoral aparece nas outras
 *  bases sem sair e voltar a entrar. Sem o doc ainda, ou lista vazia,
 *  cai em TIPOS_CULTO_PADRAO — nunca um ecrã sem nenhum tipo. */
export function ouvirTiposCulto(cb) {
  return onSnapshot(cTiposCulto(), (s) => {
    const lista = s.exists() ? s.data().lista : null;
    cb(Array.isArray(lista) && lista.length ? lista : TIPOS_CULTO_PADRAO);
  });
}

/** Substitui a lista inteira — quem chama calcula o array todo (com o
 *  tipo novo/editado já dentro) antes de chamar isto; nunca um
 *  `arrayUnion` de um item só (editar um campo de um item específico
 *  do array não dá para fazer assim). */
export const guardarTiposCulto = (lista) =>
  setDoc(cTiposCulto(), { lista, atualizadoEm: serverTimestamp() }, { merge: true });

/** `tipos` vem sempre de `useTiposCulto()` (`TiposCultoContext.jsx`).
 *  Cai no id cru se não encontrar — um culto antigo nunca fica sem
 *  etiqueta nenhuma só porque o tipo foi renomeado ou (no caso de um
 *  texto livre de antes deste ecrã existir) nunca esteve na lista. */
export const nomeTipoCulto = (tipos, id) => tipos.find((t) => t.id === id)?.nome ?? id;
export const tipoCultoDefault = (dataISO) => (Number(dataISO.slice(8, 10)) <= 7 ? "ceia" : "familia");
