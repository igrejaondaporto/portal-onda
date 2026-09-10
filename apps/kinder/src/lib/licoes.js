/**
 * Lições do Kinder. Chegam como vídeo novo numa área de membros da
 * Kiwify — a Kiwify não avisa ninguém de fora (os webhooks dela são só
 * de pagamentos, e a conta do Kinder é de aluna, não de produtora),
 * por isso não há automação: a líder cola o link e escolhe a(s)
 * sala(s). Uma lição pode servir mais do que uma sala (muitas vezes
 * Fun e Júnior usam a mesma).
 *
 * O link só abre para quem tem login na Kiwify — por isso a lição traz
 * o essencial cá dentro: resumo para os voluntários, materiais a
 * preparar e um resumo para os pais (aparece no link da família).
 *
 *   bases/kinder/licoes/{id}
 *     titulo, categorias[], kiwifyUrl|null, resumo, materiais[],
 *     resumoPais, eventoId|null, arquivoUrl|null, arquivoNome|null,
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

/** Cria ou atualiza. `ficheiro` (opcional) é sempre .docx — a regra do
 *  Storage recusa outro tipo. */
export async function guardarLicao(id, uid, { titulo, categorias, kiwifyUrl, resumo, materiais, resumoPais, eventoId, ficheiro }, nova) {
  const extra = {};
  if (ficheiro) {
    const destino = refStorage(storage, `bases/${BASE_ID}/licoes/${id}.docx`);
    await uploadBytes(destino, ficheiro, { contentType: ficheiro.type });
    extra.arquivoUrl = await getDownloadURL(destino);
    extra.arquivoNome = ficheiro.name;
  }
  await setDoc(doc(cLicoes(), id), {
    titulo: titulo.trim(),
    categorias,
    kiwifyUrl: kiwifyUrl?.trim() || null,
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
