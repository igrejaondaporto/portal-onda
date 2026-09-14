/**
 * Lições do Kinder. Chegam da Kiwify (área de membros) como
 * documentos — geralmente PDF, às vezes a foto de uma página impressa
 * ou um .docx — que a líder descarrega e sobe aqui, sem link nenhum: a
 * Kiwify não tem webhook de conteúdo (só de pagamento) e a conta do
 * Kinder é de aluna, não de produtora, por isso não há como isto
 * chegar sozinho. Uma lição pode servir mais do que uma sala (muitas
 * vezes Fun e Júnior usam a mesma).
 *
 * Quatro tipos de documento, cada um com o seu botão no envio e a sua
 * ação no detalhe (ver Licao.jsx / SheetLicao.jsx):
 *   - licao      → "Abrir lição do dia" — o documento principal, 1 só
 *   - recurso    → "Abrir recurso" — opcional, 1 só
 *   - atividades → "Abrir atividade 1/2/…" — 0 ou mais
 *
 *   bases/kinder/licoes/{id}
 *     titulo, categorias[], resumo, resumoPais, louvor, eventoId|null,
 *     licao: {url, nome}|null, recurso: {url, nome}|null,
 *     atividades: [{url, nome}, …],
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
 *  imagem ou .docx) — nunca fixo. */
function extensaoDe(ficheiro) {
  const m = /\.[a-z0-9]+$/i.exec(ficheiro.name);
  return m ? m[0] : "";
}

async function subir(id, sufixo, ficheiro) {
  const destino = refStorage(storage, `bases/${BASE_ID}/licoes/${id}-${sufixo}${extensaoDe(ficheiro)}`);
  await uploadBytes(destino, ficheiro, { contentType: ficheiro.type });
  return { url: await getDownloadURL(destino), nome: ficheiro.name };
}

/**
 * Cria ou atualiza. `licaoFicheiro`/`recursoFicheiro` (opcionais na
 * edição — só sobem se a líder tiver escolhido um novo) e
 * `atividadesFicheiros` (array; `null` num lugar = manter o que já
 * estava lá naquele índice, para dar para trocar só uma atividade
 * sem reenviar as outras).
 */
export async function guardarLicao(id, uid, { titulo, categorias, resumo, resumoPais, louvor, eventoId, licaoFicheiro, recursoFicheiro, atividadesFicheiros, atividadesAtuais }, nova) {
  const [licao, recurso] = await Promise.all([
    licaoFicheiro ? subir(id, "licao", licaoFicheiro) : null,
    recursoFicheiro ? subir(id, "recurso", recursoFicheiro) : null,
  ]);
  const atividades = await Promise.all(
    (atividadesFicheiros || []).map((f, i) => (f ? subir(id, `atividade-${i}`, f) : atividadesAtuais?.[i] ?? null))
  );

  await setDoc(doc(cLicoes(), id), {
    titulo: titulo.trim(),
    categorias,
    resumo: resumo?.trim() || "",
    resumoPais: resumoPais?.trim() || "",
    louvor: louvor?.trim() || "",
    eventoId: eventoId || null,
    ...(licao ? { licao } : {}),
    ...(recursoFicheiro !== undefined ? { recurso: recurso ?? null } : {}),
    atividades: atividades.filter(Boolean),
    ...(nova ? {
      enviadoPor: uid, criadoEm: serverTimestamp(), ativo: true,
      licao: licao ?? null, recurso: recurso ?? null,
    } : {}),
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
