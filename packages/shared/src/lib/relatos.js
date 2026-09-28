/**
 * Reportar um problema/bug ou melhoria do painel, com anexo opcional
 * (foto ou vídeo) — genuinamente igual em qualquer base (é para isso
 * que packages/shared existe, ver CLAUDE.md raiz). A gestão (mudar
 * estado, quem assume) é só do Onda Tech Hub — ver apps/ondatechhub.
 */
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, chamar } from "./firebase.js";
import { comprimirImagem } from "./imagem.js";

// gerado no cliente, antes de o documento existir — é o que dá ao
// anexo um caminho de Storage para onde subir antes de abrir o
// relato (mesmo padrão de SheetMarca, ver Comunicação). `doc()` sem
// escrever nada, só para pedir um id novo ao SDK.
export const novoIdRelato = () => doc(collection(db, "relatos")).id;

// Anexo opcional (foto ou vídeo) — sobe primeiro, devolve o URL que
// `abrirRelato` grava. Vídeo não comprime (comprimirImagem ignora o
// que não for imagem/*, devolve o ficheiro tal qual) — o limite de
// tamanho é só o teto do storage.rules (20 MB).
export async function enviarAnexoRelato(relatoId, ficheiro) {
  const preparado = await comprimirImagem(ficheiro);
  const destino = refStorage(storage, `relatos/${relatoId}/anexo`);
  await uploadBytes(destino, preparado, { contentType: preparado.type });
  const url = await getDownloadURL(destino);
  return { anexoUrl: url, anexoTipo: preparado.type };
}

export const abrirRelato = (dados) => chamar("abrirRelato")(dados).then((r) => r.data);

export const excluirMeuRelato = (id) => chamar("excluirMeuRelato")({ id }).then((r) => r.data);

/** Os relatos que ESTA pessoa abriu, de qualquer base — a rule só
 *  deixa ler quem reportou ou o Onda Tech Hub (ver firestore.rules,
 *  euSou(reportadoPorId)). Excluídos (`ativo: false`) ficam de fora —
 *  filtro no cliente, não `where`, mesmo critério de
 *  `ouvirMinhasSolicitacoes`. */
export function ouvirMeusRelatos(uid, cb) {
  const q = query(
    collection(db, "relatos"),
    where("reportadoPorId", "==", uid), orderBy("criadoEm", "desc")
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => r.ativo !== false)));
}

// só dois — "erro" e "bug" eram a mesma coisa na prática (o líder
// pediu para simplificar: "assim fica mais fácil para nós do tech hub
// saber o que é e o que priorizar"). O valor interno continua "bug".
export const ROTULO_TIPO_RELATO = { bug: "Problema/Bug", melhoria: "Melhoria" };
// "aberto"/"resolvido" são os valores internos (Firestore/Cloud
// Functions, já em produção) — só o texto mostrado mudou, para bater
// com o vocabulário pedido pelo líder: "novo" → "em andamento" →
// "concluído".
export const ROTULO_STATUS_RELATO = {
  aberto: "Novo", em_andamento: "Em andamento", resolvido: "Concluído", recusado: "Recusado",
};
export const COR_STATUS_RELATO = {
  aberto: "var(--cinza)", em_andamento: "var(--azul)", resolvido: "var(--verde)", recusado: "var(--magenta)",
};
