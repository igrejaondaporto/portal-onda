/**
 * Equipamentos da Kinder — impressora, cadeiras, mesas, colchões…
 * (pedido 2026-09: "a Kinder tem equipamentos também"). É o mesmo
 * "modo património" da Técnica e do Louvor: vive na MESMA coleção
 * `bases/kinder/inventario` que o material de consumo, e o que separa
 * os dois é o campo `estado` — só o equipamento o tem (as Cloud
 * Functions `criarEquipamento`/`guardarEquipamento`, index.js, gravam
 * `estado: "ok"`; `criarItemInventario` nunca). É a mesma regra que o
 * Painel Pastoral já usa (`patrimonioPastoral`, functions/pastoral.js),
 * por isso estes aparecem lá no Património sem mais nada.
 *
 * Reaproveita as funções da Técnica/Louvor tal como estão — nenhuma
 * mudança nas Functions. Elas pedem líder ou auxiliar (`exigeLider`):
 * na Kinder, a líder geral e as líderes de sala criam e editam; os
 * voluntários veem.
 *
 * Campos usados aqui: nome, tipo (equipamento/mobiliário/outro),
 * `local` = a sala (baby/fun/junior/partilhado), quantidade, `modelo`
 * (marca/modelo, opcional) e foto. `nSerie`/`ministerioId`/fatura/valor
 * de compra ficam por usar.
 */
import { doc, onSnapshot, query, where } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";
import { comprimirImagem } from "@portal/shared/lib/imagem.js";
import { cInventario } from "./modelo";

export const ehEquipamento = (item) => typeof item?.estado === "string";

export const TIPOS_EQUIPAMENTO = [
  { id: "equipamento", nome: "Equipamento" },
  { id: "mobiliario", nome: "Mobiliário" },
  { id: "outro", nome: "Outro" },
];
export const nomeTipo = (id) => TIPOS_EQUIPAMENTO.find((t) => t.id === id)?.nome ?? "Equipamento";

export function ouvirEquipamentos(cb) {
  const q = query(cInventario(), where("ativo", "==", true));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(ehEquipamento)));
}

/** Id gerado no cliente, para a foto (Storage) e o documento apontarem
 *  ao mesmo sítio — mesmo padrão de `novoItemInventarioId`. */
export const novoEquipamentoId = () => doc(cInventario()).id;

export async function enviarFotoEquipamento(itemId, ficheiro) {
  const comprimida = await comprimirImagem(ficheiro);
  const destino = refStorage(storage, `bases/${BASE_ID}/inventario/${itemId}`);
  await uploadBytes(destino, comprimida, { contentType: comprimida.type });
  return getDownloadURL(destino);
}

export const criarEquipamento = (dados) => chamar("criarEquipamento")(dados).then((r) => r.data);
export const guardarEquipamento = (dados) => chamar("guardarEquipamento")(dados).then((r) => r.data);
export const desativarEquipamento = (itemId) => chamar("desativarEquipamento")({ itemId }).then((r) => r.data);
