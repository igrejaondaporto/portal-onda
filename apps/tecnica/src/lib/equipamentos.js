/**
 * Equipamentos — o "Inventário" da Técnica em modo património: cada
 * item é individual (modelo, nº série, local, ministério), não uma
 * quantidade em stock. Mesma coleção bases/{base}/inventario que a
 * Apoio usa em modo consumível (ver apps/apoio/src/lib/inventario.js)
 * — nunca colidem porque cada Cloud Function só mexe na base de quem
 * a chama. Só o líder gere o catálogo, por isso tudo passa por função.
 */
import { doc, onSnapshot, query, where } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";
import { cInventario } from "./modelo";
import { comprimirImagem } from "@portal/shared/lib/imagem.js";

export function ouvirEquipamentos(cb) {
  const q = query(cInventario(), where("ativo", "==", true));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Id gerado no cliente — precisa de existir antes de guardar, para a
 *  foto (em Storage) apontar para o equipamento certo (mesmo padrão
 *  de novoFuncaoId/novoWikiId). */
export const novoEquipamentoId = () => doc(cInventario()).id;

export async function enviarFotoEquipamento(itemId, ficheiro) {
  const comprimida = await comprimirImagem(ficheiro);
  const destino = refStorage(storage, `bases/${BASE_ID}/inventario/${itemId}`);
  await uploadBytes(destino, comprimida, { contentType: comprimida.type });
  return getDownloadURL(destino);
}

/**
 * A fatura de compra. Vive ao lado da foto, no mesmo sítio do
 * Storage, com "-fatura" no nome — é o papel que a loja pede para
 * acionar a garantia quando o aparelho avaria, e ninguém o encontra
 * numa gaveta dois anos depois.
 *
 * Aceita PDF (o formato em que quase sempre chega) e imagem, para quem
 * só tem o papel e o fotografa. A imagem comprime pouco, como a dos
 * reembolsos: um número de série ilegível não serve de prova.
 */
export async function enviarFaturaEquipamento(itemId, ficheiro) {
  const paraEnviar = ficheiro.type.startsWith("image/")
    ? await comprimirImagem(ficheiro, { maxDimensao: 2000, qualidade: 0.9 })
    : ficheiro;
  const destino = refStorage(storage, `bases/${BASE_ID}/inventario/${itemId}-fatura`);
  await uploadBytes(destino, paraEnviar, { contentType: paraEnviar.type });
  return { url: await getDownloadURL(destino), nome: ficheiro.name };
}

export const criarEquipamento = (dados) => chamar("criarEquipamento")(dados).then((r) => r.data);
export const guardarEquipamento = (dados) => chamar("guardarEquipamento")(dados).then((r) => r.data);
export const desativarEquipamento = (itemId) => chamar("desativarEquipamento")({ itemId }).then((r) => r.data);
