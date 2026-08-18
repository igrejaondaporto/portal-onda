/**
 * Dados e ações do Painel do líder.
 *
 * Escala e catálogo de funções escrevem-se diretamente no Firestore —
 * as regras já só deixam o líder da base fazê-lo (ver firestore.rules).
 * Criar/editar/remover pessoas e criar cultos especiais passam sempre
 * pelas Cloud Functions: o papel e a existência de um culto são coisas
 * que o cliente não pode decidir sozinho.
 */
import {
  query, where, orderBy, onSnapshot, getDocs, getDoc,
  doc, setDoc, updateDoc, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { ref as refStorage, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, chamar, BASE_ID } from "@portal/shared/lib/firebase.js";
import { cPessoas, cFuncoes, cEventos, cEscala, cBase, cMinisterios, cEquipamentos, cHistoricoEquipamento } from "./modelo";
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

/* ── catálogo de funções ──────────────────────────────────── */
export function ouvirFuncoes(cb) {
  const q = query(cFuncoes(), where("ativa", "==", true), orderBy("ordem"), orderBy("nome"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** O líder arrasta (botões ↑/↓) — grava a ordem final de toda a fase
 *  de uma vez, para nunca ficar ordem empatada por reordenar só duas. */
export async function reordenarFuncoes(lista) {
  const lote = writeBatch(db);
  lista.forEach((f, i) => {
    lote.update(doc(db, `bases/${BASE_ID}/funcoes/${f.id}`), { ordem: i });
  });
  await lote.commit();
}

/** Id gerado no cliente — precisamos dele antes de gravar, para a foto
 *  (em Storage) e o documento (no Firestore) apontarem ao mesmo sítio. */
export const novoFuncaoId = () => doc(cFuncoes()).id;

export async function criarFuncao(id, dados) {
  await setDoc(doc(db, `bases/${BASE_ID}/funcoes/${id}`), {
    ...dados, ativa: true, ordem: 0, criadoEm: serverTimestamp(),
  });
  return id;
}

export const guardarFuncao = (funcaoId, dados) =>
  updateDoc(doc(db, `bases/${BASE_ID}/funcoes/${funcaoId}`), dados);

export const desativarFuncao = (funcaoId) =>
  updateDoc(doc(db, `bases/${BASE_ID}/funcoes/${funcaoId}`), { ativa: false });

/** Só o líder da base pode escrever aqui (ver storage.rules) — a foto de
 *  uma função só um culto ainda não tem forma de o líder de escala subir. */
export async function enviarFotoFuncao(funcaoId, ficheiro) {
  const comprimida = await comprimirImagem(ficheiro);
  const destino = refStorage(storage, `bases/${BASE_ID}/funcoes/${funcaoId}`);
  await uploadBytes(destino, comprimida, { contentType: comprimida.type });
  return getDownloadURL(destino);
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
 *  não fica escalado nas duas no mesmo culto. `lugares`: como na
 *  Técnica, titular/aprendiz por ministério — ver modelo.js. */
export const guardarEscala = (eventoId, { liderEscala, lugares }) =>
  chamar("guardarEscalaComunicacao")({ eventoId, liderEscala, lugares }).then((r) => r.data);

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

/* ── ministérios ──────────────────────────────────────────── */
export function ouvirMinisterios(cb) {
  const q = query(cMinisterios(), where("ativo", "==", true), orderBy("ordem"), orderBy("nome"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export const novoMinisterioId = () => doc(cMinisterios()).id;

export async function criarMinisterio(id, dados) {
  await setDoc(doc(db, `bases/${BASE_ID}/ministerios/${id}`), {
    ...dados, ativo: true, criadoEm: serverTimestamp(),
  });
  return id;
}

export const guardarMinisterio = (id, dados) =>
  updateDoc(doc(db, `bases/${BASE_ID}/ministerios/${id}`), dados);

export const desativarMinisterio = (id) =>
  updateDoc(doc(db, `bases/${BASE_ID}/ministerios/${id}`), { ativo: false });

/* ── equipamentos (custódia — dois itens, quem está com cada um e
 *  desde quando; ver CLAUDE.md desta base). Sempre por Cloud Function:
 *  passar um equipamento tem de gravar o histórico junto, na mesma
 *  escrita, e isso não dá para garantir com regras. ── */
export function ouvirEquipamentos(cb) {
  const q = query(cEquipamentos(), where("ativo", "==", true), orderBy("nome"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export const novoEquipamentoId = () => doc(cEquipamentos()).id;
export const criarEquipamento = (dados) => chamar("criarEquipamentoComunicacao")(dados).then((r) => r.data);
export const passarEquipamento = (itemId, paraId) =>
  chamar("passarEquipamento")({ itemId, paraId }).then((r) => r.data);

export async function obterHistoricoEquipamento(itemId) {
  const q = query(cHistoricoEquipamento(itemId), orderBy("em", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
