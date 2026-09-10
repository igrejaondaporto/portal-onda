/**
 * Dados e ações do Painel do líder (cópia da Base New, sem o catálogo
 * de funções — o Kinder usa a checklist de sala, ver lib/kinder.js).
 *
 * Criar/editar/remover pessoas, a escala e cultos especiais passam
 * sempre pelas Cloud Functions: o papel e a existência de um culto
 * são coisas que o cliente não pode decidir sozinho.
 */
import { query, where, orderBy, onSnapshot, getDocs, getDoc, collection } from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";
import { cPessoas, cEventos, cEscala, cBase } from "./modelo";
import { corPara } from "@portal/shared/lib/cores.js";
import { comprimirImagem } from "@portal/shared/lib/imagem.js";

/* ── a base (horas, nome…) — poucos sítios usam, todos ao vivo,
 *  para uma edição do líder aparecer em qualquer aba sem refresh ── */
export function ouvirBase(cb) {
  return onSnapshot(cBase(), (s) => cb(s.exists() ? s.data() : null));
}

/* ── voluntários ──────────────────────────────────────────── */
export function ouvirVoluntarios(cb) {
  const q = query(cPessoas(), where("ativo", "==", true), orderBy("nome"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d, i) => ({ id: d.id, ...d.data(), cor: corPara(i) })));
  });
}

export const criarVoluntario = (dados) => chamar("criarVoluntario")(dados).then((r) => r.data);
export const editarVoluntario = (dados) => chamar("editarVoluntario")(dados).then((r) => r.data);

/** O líder muda a foto de outra pessoa da base — o próprio já muda a
 *  sua (Perfil → enviarFotoPerfil). Só sobe ao Storage (permitido ao
 *  líder pela storage.rules); quem chama grava a URL no Firestore via
 *  editarVoluntario, junto com o resto do formulário. */
export async function enviarFotoVoluntario(pessoaId, ficheiro) {
  const comprimida = await comprimirImagem(ficheiro);
  const destino = refStorage(storage, `bases/${BASE_ID}/pessoas/${pessoaId}`);
  await uploadBytes(destino, comprimida, { contentType: comprimida.type });
  return getDownloadURL(destino);
}
export const removerVoluntario = (pessoaId) => chamar("removerVoluntario")({ pessoaId }).then((r) => r.data);
export const reporPin = (pessoaId) => chamar("reporPin")({ pessoaId }).then((r) => r.data);
export const reporTodosPins = () => chamar("reporTodosPins")({}).then((r) => r.data);

/* ── definições da base ───────────────────────────────────── */
export const definirBase = (dados) => chamar("definirBase")(dados).then((r) => r.data);

/** Quantas vezes cada pessoa serviu nos últimos `dias` — para o líder
 *  decidir a escala com informação, nunca para bloquear ninguém. Uma
 *  query aos eventos do período, depois uma leitura por culto (não por
 *  pessoa), tudo feito uma vez quando o ecrã abre. */
export async function obterEstatisticasEscala(dias = 90) {
  const hoje = new Date().toISOString().slice(0, 10);
  const inicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const q = query(cEventos(), where("data", ">=", inicio), where("data", "<=", hoje), orderBy("data"));
  const snap = await getDocs(q);
  const eventos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const escalas = await Promise.all(eventos.map((ev) => getDoc(cEscala(ev.id))));

  const porPessoa = {};
  const toque = (id) => (porPessoa[id] ??= { vezes: 0, liderVezes: 0, ultima: null });
  escalas.forEach((esc, i) => {
    if (!esc.exists()) return;
    const { pessoas = [], liderEscala = null } = esc.data();
    const data = eventos[i].data;
    pessoas.forEach((id) => {
      const p = toque(id);
      p.vezes += 1;
      if (!p.ultima || data > p.ultima) p.ultima = data;
    });
    if (liderEscala) toque(liderEscala).liderVezes += 1;
  });
  return porPessoa;
}

/* ── escala do mês ────────────────────────────────────────── */
const pad2 = (n) => String(n).padStart(2, "0");

/** Evento escopo:"base" de outra base, ou um evento global que esta
 *  base marcou "não servimos" — não aparece no calendário, escala,
 *  enquete nem em lado nenhum desta app. Não é sigilo a sério (ver
 *  CLAUDE.md raiz): o documento em si continua legível por qualquer
 *  autenticado, isto só filtra o que a interface mostra. */
function visivelParaBase(ev) {
  if (ev.escopo === "base" && ev.baseId !== BASE_ID) return false;
  if ((ev.dispensadaPor || []).includes(BASE_ID)) return false;
  return true;
}

export async function obterEventosDoMes(ano, mesIndex) {
  const inicio = `${ano}-${pad2(mesIndex + 1)}-01`;
  const fim = new Date(Date.UTC(ano, mesIndex + 1, 1)).toISOString().slice(0, 10);
  const q = query(cEventos(), where("data", ">=", inicio), where("data", "<", fim), orderBy("data"));
  const snap = await getDocs(q);
  const eventos = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((ev) => ev.ativo !== false).filter(visivelParaBase);
  return Promise.all(
    eventos.map(async (ev) => {
      const esc = await getDoc(cEscala(ev.id));
      return { ...ev, escala: esc.exists() ? esc.data() : { pessoas: [], liderEscala: null } };
    })
  );
}

/** Como obterEventosDoMes, mas ao vivo — quando o líder da base muda a
 *  escala, quem está a olhar para o mês vê a alteração sem dar refresh.
 *  Não há junções no Firestore, por isso ouve os eventos do mês e depois
 *  a escala de cada um, e junta os dois em cada emissão. */
export function ouvirEventosDoMes(ano, mesIndex, cb) {
  const inicio = `${ano}-${pad2(mesIndex + 1)}-01`;
  const fim = new Date(Date.UTC(ano, mesIndex + 1, 1)).toISOString().slice(0, 10);
  const q = query(cEventos(), where("data", ">=", inicio), where("data", "<", fim), orderBy("data"));

  let pararEscalas = [];

  const pararEventos = onSnapshot(q, (snap) => {
    pararEscalas.forEach((p) => p());
    pararEscalas = [];

    const eventos = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((ev) => ev.ativo !== false).filter(visivelParaBase);
    if (!eventos.length) { cb([]); return; }

    const escalas = {};
    eventos.forEach((ev) => {
      escalas[ev.id] = { pessoas: [], liderEscala: null };
      pararEscalas.push(
        onSnapshot(cEscala(ev.id), (esc) => {
          escalas[ev.id] = esc.exists() ? esc.data() : { pessoas: [], liderEscala: null };
          cb(eventos.map((e) => ({ ...e, escala: escalas[e.id] })));
        })
      );
    });
  });

  return () => { pararEventos(); pararEscalas.forEach((p) => p()); };
}

/** Passa pela Cloud Function (antes era setDoc direto) — só assim dá
 *  para validar no servidor que quem serve em mais do que uma base
 *  não fica escalado nas duas no mesmo culto. */
export const guardarEscala = (eventoId, { pessoas, liderEscala }) =>
  chamar("guardarEscalaApoio")({ eventoId, pessoas, liderEscala }).then((r) => r.data);

/** uid → Set(domingoId) para quem está escalado/indisponível noutra
 *  base nesses domingos — mesmo formato de construirIndisponibilidades
 *  (sugestor.js), para fundir com `mesclarIndisponibilidades`. Leitura
 *  pública (eventos/{e}/indisponibilidades permite a qualquer base
 *  autenticada, ver firestore.rules) — não precisa de Cloud Function. */
export async function obterIndisponibilidadesCrossBase(domingoIds) {
  const mapa = {};
  await Promise.all(domingoIds.map(async (domingoId) => {
    const snap = await getDocs(collection(db, `eventos/${domingoId}/indisponibilidades`));
    snap.forEach((d) => {
      const outraBase = Object.keys(d.data().origens || {}).find((b) => b !== BASE_ID);
      if (!outraBase) return;
      (mapa[d.id] ??= new Set()).add(domingoId);
    });
  }));
  return mapa;
}

export const criarCultoEspecial = (dados) => chamar("criarCultoEspecial")(dados).then((r) => r.data);

/** "Esta base não serve neste evento" — tira o evento global do
 *  calendário/enquete desta base (ver visivelParaBase). Reversível. */
export const dispensarBaseDeEvento = (eventoId) => chamar("dispensarBaseDeEvento")({ eventoId }).then((r) => r.data);
export const reincluirBaseEmEvento = (eventoId) => chamar("reincluirBaseEmEvento")({ eventoId }).then((r) => r.data);

/** Não apaga — desativa (ver CLAUDE.md). Só cultos especiais; a Cloud
 *  Function recusa domingos. */
export const excluirCultoEspecial = (eventoId) => chamar("excluirCultoEspecial")({ eventoId }).then((r) => r.data);

/** Os domingos de um ano só existem depois disto ser chamado (não há
 *  nada automático) — usar perto do fim do ano para o ano seguinte já
 *  ter cultos quando alguém abrir a Escala em janeiro. */
export const gerarDomingos = (ano) => chamar("gerarDomingos")({ ano }).then((r) => r.data);
