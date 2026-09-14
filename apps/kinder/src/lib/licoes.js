/**
 * Lições do Kinder. Chegam da Kiwify (área de membros) como um
 * documento — geralmente um PDF, às vezes a foto de uma página
 * impressa ou um .docx — que a líder descarrega e sobe aqui, sem
 * link nenhum: a Kiwify não tem webhook de conteúdo (só de
 * pagamento) e a conta do Kinder é de aluna, não de produtora, por
 * isso não há como isto chegar sozinho. Uma lição pode servir mais
 * do que uma sala (muitas vezes Fun e Júnior usam a mesma).
 *
 *   bases/kinder/licoes/{id}
 *     titulo, categorias[], resumo, materiais[], resumoPais,
 *     eventoId|null, arquivoUrl|null, arquivoNome|null,
 *     enviadoPor, criadoEm, ativo
 *
 * Só as líderes escrevem (firestore.rules → licoes, souLiderBase).
 * "Excluir" é ativo:false (regra 5).
 */
import { doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, BASE_ID } from "@portal/shared/lib/firebase.js";
import { cLicoes } from "./modelo";

const ms = (ts) => ts?.toMillis?.() ?? Date.now(); // pendente de escrita = agora

export function ouvirLicoes(cb) {
  return onSnapshot(query(cLicoes(), where("ativo", "==", true)), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.criadoEm) - ms(a.criadoEm)));
  });
}

export const novoIdLicao = () => doc(cLicoes()).id;

/** Nome do ficheiro no Storage com a extensão real do que foi
 *  enviado (a regra do Storage é que decide o que é aceite: pdf,
 *  imagem ou .docx) — nunca fixo, ao contrário do molde da New. */
function extensaoDe(ficheiro) {
  const m = /\.[a-z0-9]+$/i.exec(ficheiro.name);
  return m ? m[0] : "";
}

/** Cria ou atualiza. `ficheiro` é o documento da lição em si —
 *  geralmente um PDF. Substituir apaga o ficheiro antigo do Storage
 *  sozinho? Não: o nome inclui a extensão, por isso um PDF a
 *  substituir uma foto antiga deixa a foto antiga órfã no Storage —
 *  raro (trocar de tipo de ficheiro na mesma lição), aceitável por
 *  agora; reconsiderar se vier a ser frequente. */
export async function guardarLicao(id, uid, { titulo, categorias, resumo, materiais, resumoPais, eventoId, ficheiro }, nova) {
  const extra = {};
  if (ficheiro) {
    const destino = refStorage(storage, `bases/${BASE_ID}/licoes/${id}${extensaoDe(ficheiro)}`);
    await uploadBytes(destino, ficheiro, { contentType: ficheiro.type });
    extra.arquivoUrl = await getDownloadURL(destino);
    extra.arquivoNome = ficheiro.name;
  }
  await setDoc(doc(cLicoes(), id), {
    titulo: titulo.trim(),
    categorias,
    resumo: resumo?.trim() || "",
    materiais: (materiais || []).map((m) => m.trim()).filter(Boolean),
    resumoPais: resumoPais?.trim() || "",
    eventoId: eventoId || null,
    ...extra,
    ...(nova ? { enviadoPor: uid, criadoEm: serverTimestamp(), ativo: true, arquivoUrl: extra.arquivoUrl ?? null, arquivoNome: extra.arquivoNome ?? null } : {}),
  }, { merge: true });
}

export const desativarLicao = (id) => updateDoc(doc(cLicoes(), id), { ativo: false });

/* ── "nova" até a pessoa abrir — por aparelho, no localStorage (é só
 *  uma conveniência; perder isto só volta a mostrar o ponto). ── */
const CHAVE_VISTAS = (uid) => `kinder-licoes-vistas-${uid}`;
export function licoesVistas(uid) {
  try { return new Set(JSON.parse(localStorage.getItem(CHAVE_VISTAS(uid)) || "[]")); } catch { return new Set(); }
}
export function marcarLicaoVista(uid, id) {
  try {
    const v = licoesVistas(uid);
    v.add(id);
    localStorage.setItem(CHAVE_VISTAS(uid), JSON.stringify([...v].slice(-200)));
  } catch { /* sem armazenamento (navegação privada): continua a funcionar, só sem memória */ }
}

/** As lições que dizem respeito a uma sala (ou todas, se `cat` null). */
export const licoesDaSala = (licoes, cat) => (cat ? licoes.filter((l) => (l.categorias || []).includes(cat)) : licoes);
