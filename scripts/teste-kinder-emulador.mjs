/**
 * Teste da Base Kinder contra os EMULADORES (nunca produção): registo
 * de família pelos pais (sem sessão), link da família, check-in,
 * código de levantamento, saída, papel "auxiliar", a foto da criança/
 * responsável/autorizado, e as regras que guardam os dados das
 * crianças.
 *
 * IMPORTANTE desde que existe foto: `registarFamiliaKinder`/
 * `editarFamiliaKinder` sobem a foto pelo Admin SDK (`admin.storage()`
 * — guardarFotoPessoa, functions/kinder.js). SEM o emulador de Storage
 * no ar, essa chamada escreve na Storage A SÉRIO (produção) mesmo a
 * correr contra os outros emuladores — nunca esquecer `storage` no
 * `--only`.
 *
 * Uso (dois terminais — ver memória "Gotchas do Firebase local": os
 * emuladores precisam de JDK 21+):
 *   JAVA_HOME=/opt/homebrew/opt/openjdk@21 firebase emulators:start --only firestore,auth,functions,storage --project painel-onda
 *   node scripts/teste-kinder-emulador.mjs
 */
// Portas por omissão = firebase.json. Se já houver outros emuladores
// no ar (outra sessão), arrancar com outra config e passar as portas:
//   PORTA_FIRESTORE=8180 PORTA_AUTH=9199 PORTA_FUNCTIONS=5101 PORTA_STORAGE=9299 node scripts/teste-kinder-emulador.mjs
const PORTA_FIRESTORE = Number(process.env.PORTA_FIRESTORE || 8080);
const PORTA_AUTH = Number(process.env.PORTA_AUTH || 9099);
const PORTA_FUNCTIONS = Number(process.env.PORTA_FUNCTIONS || 5001);
const PORTA_STORAGE = Number(process.env.PORTA_STORAGE || 9199);
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${PORTA_FIRESTORE}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${PORTA_AUTH}`;

import admin from "firebase-admin";
import { randomBytes, scryptSync } from "node:crypto";
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInWithCustomToken, signInAnonymously, signOut } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, addDoc, collection } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";

const PROJETO = "painel-onda";
admin.initializeApp({ projectId: PROJETO });
const adb = admin.firestore();

const app = initializeApp({ apiKey: "demo", projectId: PROJETO, authDomain: `${PROJETO}.firebaseapp.com` });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://127.0.0.1:${PORTA_AUTH}`, { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", PORTA_FIRESTORE);
const fns = getFunctions(app, "europe-west1");
connectFunctionsEmulator(fns, "127.0.0.1", PORTA_FUNCTIONS);
const chamar = (nome, dados) => httpsCallable(fns, nome)(dados).then((r) => r.data);

// 1×1 PNG válido (constante conhecida) — só para testar o pipeline de
// foto (comprime/converte no cliente de verdade; aqui já vai pronto).
const PNG_TESTE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
/** O url devolvido é sempre o de produção (firebasestorage.googleapis.
 *  com) — troca para o emulador local antes de ir buscar os bytes a
 *  sério, para confirmar que a foto ficou mesmo lá (e não em produção). */
async function descarregarFoto(url) {
  const local = url.replace("https://firebasestorage.googleapis.com", `http://127.0.0.1:${PORTA_STORAGE}`);
  const r = await fetch(local);
  return { status: r.status, bytes: r.ok ? (await r.arrayBuffer()).byteLength : 0 };
}

let passou = 0, falhou = 0;
async function teste(nome, fn) {
  try { await fn(); console.log(`✔ ${nome}`); passou++; }
  catch (e) { console.error(`✘ ${nome} — ${e.message}`); falhou++; }
}
const afirmar = (cond, msg) => { if (!cond) throw new Error(msg); };
async function falha(promessa, codigo) {
  try { await promessa; } catch (e) {
    if (codigo && !String(e.code).includes(codigo)) throw new Error(`esperava ${codigo}, veio ${e.code}: ${e.message}`);
    return;
  }
  throw new Error(`esperava falhar${codigo ? ` com ${codigo}` : ""}, mas passou`);
}
async function como(uid, claims) {
  await signOut(auth);
  await signInWithCustomToken(auth, await admin.auth().createCustomToken(uid, claims));
}

function hojeEmLisboa() {
  const p = new Intl.DateTimeFormat("en", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const v = (t) => p.find((x) => x.type === t)?.value;
  return `${v("year")}-${v("month")}-${v("day")}`;
}
/** Data de nascimento para uma criança com `anos` completos hoje. */
function nascidaHa(anos) {
  const [a, m, d] = hojeEmLisboa().split("-");
  return `${Number(a) - anos}-${m}-${d}`;
}

// espera pelos emuladores (arrancam em segundo plano)
for (let i = 0; ; i++) {
  try { await fetch(`http://127.0.0.1:${PORTA_FUNCTIONS}/`); await fetch(`http://127.0.0.1:${PORTA_FIRESTORE}/`); break; }
  catch { if (i > 90) throw new Error("Emuladores não arrancaram."); await new Promise((r) => setTimeout(r, 1000)); }
}

// ── cenário ──────────────────────────────────────────────────────
const HOJE = hojeEmLisboa();
await adb.doc("bases/kinder").set({ nome: "Kinder", ativa: true, horaChegada: "09:00", horaCulto: "10:30" });
await adb.doc("bases/apoio").set({ nome: "Apoio", ativa: true });
await adb.doc(`eventos/${HOJE}`).set({ data: HOJE, tipo: null, horaCulto: "10:30" });
const salPin = randomBytes(16).toString("hex");
await adb.doc("bases/kinder/pessoas/aux-teste").set({ nome: "Aux Teste", papel: "auxiliar", ativo: true, categoria: "baby" });
await adb.doc("pessoas/aux-teste").set({ nome: "Aux Teste", bases: { kinder: true } });
await adb.doc("pessoas/aux-teste/privado/auth").set({ pinHash: `${salPin}:${scryptSync("135790", salPin, 64).toString("hex")}`, pinDigitos: 6 });

const VOL = { baseId: "kinder", papel: "voluntario" };
const AUX = { baseId: "kinder", papel: "auxiliar" };
const APOIO = { baseId: "apoio", papel: "lider_base" };

let token, familiaId, criancaId, codigo;

await teste("dadosRegistoKinder sem sessão devolve consentimento e faixas", async () => {
  await signOut(auth);
  const r = await chamar("dadosRegistoKinder", {});
  afirmar(r.consentimento?.texto?.length > 50, "sem texto de consentimento");
  afirmar(r.faixas.fun.min === 4, "faixas por omissão erradas");
});

await teste("registo sem consentimento é recusado", () =>
  falha(chamar("registarFamiliaKinder", { responsaveis: [{ nome: "Ana", telefone: "912345678" }], criancas: [{ nome: "Rui", dataNascimento: nascidaHa(5) }] }), "invalid-argument"));

await teste("registo pelos pais (sem sessão) fica logo confirmada e sugere a sala pela idade", async () => {
  const r = await chamar("registarFamiliaKinder", {
    responsaveis: [{ nome: "Ana Teste", telefone: "912 345 678", parentesco: "Mãe" }],
    autorizados: [{ nome: "Avó Teste", parentesco: "Avó" }],
    criancas: [{ nome: "Rui Teste", dataNascimento: nascidaHa(5), alergias: "Amendoim", categoria: "baby" }],
    fotoAutorizada: true, visitante: true,
    consentimento: { aceite: true, versao: "rascunho-1" },
  });
  token = r.token; familiaId = r.familiaId;
  const f = (await adb.doc(`bases/kinder/familias/${familiaId}`).get()).data();
  afirmar(f.estado === "confirmada", `estado=${f.estado} — registo pelo QR não devia ficar pendente`);
  afirmar(f.tokenHash && f.tokenHash !== token, "token guardado em claro");
  afirmar(f.consentimento.origem === "qr", "origem do consentimento errada");
  const cs = await adb.collection("bases/kinder/criancas").where("familiaId", "==", familiaId).get();
  criancaId = cs.docs[0].id;
  afirmar(cs.docs[0].data().categoria === "fun", `pais escolheram a sala: ${cs.docs[0].data().categoria}`);
  afirmar(f.membro === false, `membro por omissão devia ser false, veio ${f.membro}`);
});

// ── Grupo dos pais do Kinder: sem link nenhum por omissão; a líder
// define, dadosRegistoKinder passa a devolver; quem se disser membro
// fica com `membro:true` na família.
await teste("dadosRegistoKinder sem link do grupo definido devolve vazio", async () => {
  const r = await chamar("dadosRegistoKinder", {});
  afirmar(r.grupoPais?.link === "", `esperava vazio, veio "${r.grupoPais?.link}"`);
});
await teste("líder define o link do grupo; dadosRegistoKinder passa a devolvê-lo", async () => {
  await como("aux-teste", AUX);
  await setDoc(doc(db, "bases/kinder/definicoes/grupoPais"), { link: "https://chat.whatsapp.com/exemplo" });
  await signOut(auth);
  const r = await chamar("dadosRegistoKinder", {});
  afirmar(r.grupoPais?.link === "https://chat.whatsapp.com/exemplo", `link=${r.grupoPais?.link}`);
});
await teste("registo de família membro grava membro:true", async () => {
  const r = await chamar("registarFamiliaKinder", {
    responsaveis: [{ nome: "Membro Teste", telefone: "913 000 000" }],
    criancas: [{ nome: "Filho Membro", dataNascimento: nascidaHa(4) }],
    membro: true,
    consentimento: { aceite: true, versao: "rascunho-1" },
  });
  const f = (await adb.doc(`bases/kinder/familias/${r.familiaId}`).get()).data();
  afirmar(f.membro === true, `membro=${f.membro}`);
});

// ── Foto da criança e de cada responsável/autorizado — os pais não
// têm sessão nenhuma, por isso viaja em base64 e é a função (Admin
// SDK) que sobe ao Storage (guardarFotoPessoa). Sem tocar, mantém-se;
// removerFoto:true tira.
let familiaFotoId, familiaFotoToken, criancaFotoId;
await teste("registo com foto: sobe a foto da criança e do responsável a sério", async () => {
  const r = await chamar("registarFamiliaKinder", {
    responsaveis: [{ id: "resp-foto-teste", nome: "Foto Responsavel", telefone: "914000000", fotoBase64: PNG_TESTE }],
    criancas: [{ nome: "Foto Crianca", dataNascimento: nascidaHa(3), fotoBase64: PNG_TESTE }],
    consentimento: { aceite: true, versao: "rascunho-1" },
  });
  familiaFotoId = r.familiaId; familiaFotoToken = r.token;
  const f = (await adb.doc(`bases/kinder/familias/${familiaFotoId}`).get()).data();
  const cs = await adb.collection("bases/kinder/criancas").where("familiaId", "==", familiaFotoId).get();
  criancaFotoId = cs.docs[0].id;
  afirmar(!!f.responsaveis[0].foto?.url, "responsável sem foto.url");
  afirmar(!!cs.docs[0].data().foto?.url, "criança sem foto.url");
  const [rd, cd] = await Promise.all([descarregarFoto(f.responsaveis[0].foto.url), descarregarFoto(cs.docs[0].data().foto.url)]);
  afirmar(rd.status === 200 && rd.bytes > 0, `foto do responsável não descarregou (status=${rd.status})`);
  afirmar(cd.status === 200 && cd.bytes > 0, `foto da criança não descarregou (status=${cd.status})`);
});
await teste("editar sem tocar na foto mantém a mesma foto", async () => {
  const antes = (await adb.doc(`bases/kinder/familias/${familiaFotoId}`).get()).data();
  await chamar("editarFamiliaKinder", {
    token: familiaFotoToken,
    responsaveis: [{ id: "resp-foto-teste", nome: "Foto Responsavel Editado", telefone: "914000000" }],
    autorizados: [],
    criancas: [{ id: criancaFotoId, nome: "Foto Crianca Editada", dataNascimento: nascidaHa(3) }],
  });
  const depois = (await adb.doc(`bases/kinder/familias/${familiaFotoId}`).get()).data();
  const criancaDepois = (await adb.doc(`bases/kinder/criancas/${criancaFotoId}`).get()).data();
  afirmar(depois.responsaveis[0].foto.url === antes.responsaveis[0].foto.url, "foto do responsável mudou sem ninguém tocar");
  afirmar(depois.responsaveis[0].nome === "Foto Responsavel Editado", "nome não atualizou");
  afirmar(criancaDepois.foto.url, "foto da criança desapareceu sem ninguém tocar");
});
await teste("removerFoto tira a foto do responsável e da criança", async () => {
  await chamar("editarFamiliaKinder", {
    token: familiaFotoToken,
    responsaveis: [{ id: "resp-foto-teste", nome: "Foto Responsavel Editado", telefone: "914000000", removerFoto: true }],
    autorizados: [],
    criancas: [{ id: criancaFotoId, nome: "Foto Crianca Editada", dataNascimento: nascidaHa(3), removerFoto: true }],
  });
  const f = (await adb.doc(`bases/kinder/familias/${familiaFotoId}`).get()).data();
  const c = (await adb.doc(`bases/kinder/criancas/${criancaFotoId}`).get()).data();
  afirmar(f.responsaveis[0].foto === null, `responsável.foto=${JSON.stringify(f.responsaveis[0].foto)}`);
  afirmar(c.foto === null, `criança.foto=${JSON.stringify(c.foto)}`);
});

await teste("regras: sem sessão não lê crianças", () => falha(getDoc(doc(db, `bases/kinder/criancas/${criancaId}`)), "permission-denied"));
await teste("regras: sessão anónima (kiosk) não lê crianças", async () => {
  await signOut(auth); await signInAnonymously(auth);
  await falha(getDoc(doc(db, `bases/kinder/criancas/${criancaId}`)), "permission-denied");
});
await teste("regras: outra base não lê famílias", async () => {
  await como("lider-apoio", APOIO);
  await falha(getDoc(doc(db, `bases/kinder/familias/${familiaId}`)), "permission-denied");
});
await teste("regras: voluntário da Kinder lê a criança", async () => {
  await como("vol-a", VOL);
  afirmar((await getDoc(doc(db, `bases/kinder/criancas/${criancaId}`))).exists(), "não leu");
});
await teste("regras: ninguém escreve crianças direto", async () => {
  await como("aux-teste", AUX);
  await falha(setDoc(doc(db, `bases/kinder/criancas/${criancaId}`), { nome: "x" }, { merge: true }), "permission-denied");
});

await teste("link da família devolve só esta família", async () => {
  await signOut(auth);
  const r = await chamar("dadosFamiliaKinder", { token });
  afirmar(r.criancas.length === 1 && r.criancas[0].alergias === "Amendoim", "crianças erradas");
  afirmar(r.hoje.codigo === null, "já tinha código antes do check-in");
});
await teste("link com token errado não abre nada", () =>
  falha(chamar("dadosFamiliaKinder", { token: "x".repeat(24) }), "not-found"));

await teste("pais editam pelo link: juntam um irmão, não mudam a sala", async () => {
  await chamar("editarFamiliaKinder", {
    token,
    responsaveis: [{ nome: "Ana Teste", telefone: "912345678", parentesco: "Mãe" }],
    autorizados: [],
    criancas: [
      { id: criancaId, nome: "Rui Teste", dataNascimento: nascidaHa(5), alergias: "Amendoim", categoria: "junior" },
      { nome: "Bia Teste", dataNascimento: nascidaHa(1) },
    ],
  });
  const r = await chamar("dadosFamiliaKinder", { token });
  afirmar(r.criancas.length === 2, `crianças=${r.criancas.length}`);
  afirmar(r.criancas.find((c) => c.id === criancaId).categoria === "fun", "pais mudaram a sala");
  afirmar(r.criancas.find((c) => c.nome === "Bia Teste").categoria === "baby", "irmã sem sala certa");
});

await teste("outra base não consegue fazer check-in", async () => {
  await como("lider-apoio", APOIO);
  await falha(chamar("checkinKinder", { criancaIds: [criancaId] }), "permission-denied");
});

await teste("check-in dos dois irmãos: um código por família, família confirmada", async () => {
  await como("vol-a", VOL);
  const irmaos = (await adb.collection("bases/kinder/criancas").where("familiaId", "==", familiaId).get()).docs.map((d) => d.id);
  const r = await chamar("checkinKinder", { criancaIds: irmaos });
  codigo = r.codigos[familiaId];
  afirmar(/^[A-Z2-9]{4}$/.test(codigo), `código=${codigo}`);
  const cs = await Promise.all(irmaos.map((id) => adb.doc(`eventos/${HOJE}/checkinKinder/${id}`).get()));
  afirmar(cs.every((c) => c.data().codigo === codigo), "irmãos com códigos diferentes");
  afirmar((await adb.doc(`bases/kinder/familias/${familiaId}`).get()).data().estado === "confirmada", "família continua pendente");
});
await teste("confirmarFamiliaKinder já não existe — registo não passa mais por confirmação", () =>
  falha(chamar("confirmarFamiliaKinder", { familiaId })));
await teste("check-in confirma sozinho uma família antiga que ainda estivesse pendente", async () => {
  await adb.doc("bases/kinder/familias/fam-legado-pendente").set({
    responsaveis: [{ nome: "Legado Teste", telefone: "919000000" }], autorizados: [], ativo: true, estado: "pendente",
  });
  await adb.doc("bases/kinder/criancas/crianca-legado-pendente").set({ nome: "Legado Jr", familiaId: "fam-legado-pendente", categoria: "fun", ativo: true });
  await chamar("checkinKinder", { criancaIds: ["crianca-legado-pendente"] });
  afirmar((await adb.doc("bases/kinder/familias/fam-legado-pendente").get()).data().estado === "confirmada", "família antiga não confirmou sozinha no check-in");
});
await teste("check-in repetido é idempotente (mesmo código)", async () => {
  const r = await chamar("checkinKinder", { criancaIds: [criancaId] });
  afirmar(r.codigos[familiaId] === codigo, "código mudou");
});
await teste("pais veem o código no link", async () => {
  await signOut(auth);
  const r = await chamar("dadosFamiliaKinder", { token });
  afirmar(r.hoje.codigo === codigo, `código no link=${r.hoje.codigo}`);
  afirmar(r.hoje.checkins[criancaId]?.entradaEm, "sem hora de entrada");
});

await teste("saída com código errado é recusada", async () => {
  await como("vol-a", VOL);
  await falha(chamar("checkoutKinder", { criancaIds: [criancaId], codigo: "ZZZZ", levantadoPor: "Ana Teste" }), "permission-denied");
});
await teste("saída sem código: voluntário não pode", () =>
  falha(chamar("checkoutKinder", { criancaIds: [criancaId], levantadoPor: "Avó Teste", motivo: "sem telemóvel" }), "permission-denied"));
await teste("saída com o código certo", async () => {
  const r = await chamar("checkoutKinder", { criancaIds: [criancaId], codigo: codigo.toLowerCase(), levantadoPor: "Ana Teste" });
  afirmar(r.saidas === 1, `saidas=${r.saidas}`);
  const c = (await adb.doc(`eventos/${HOJE}/checkinKinder/${criancaId}`).get()).data();
  afirmar(c.saidaEm && c.levantadoPor === "Ana Teste", "saída não gravada");
});
await teste("auxiliar dá saída sem código, com motivo registado", async () => {
  await como("aux-teste", AUX);
  const irma = (await adb.collection("bases/kinder/criancas").where("nome", "==", "Bia Teste").get()).docs[0].id;
  await chamar("checkoutKinder", { criancaIds: [irma], levantadoPor: "Avó Teste", motivo: "Mãe sem bateria" });
  const c = (await adb.doc(`eventos/${HOJE}/checkinKinder/${irma}`).get()).data();
  afirmar(c.saidaForcada?.motivo === "Mãe sem bateria", "motivo não registado");
});

// ── Mestra: mesma permissão da líder, só na própria sala e só neste
// culto (eventos/{HOJE}/escalas/kinder.mestras.fun) — nunca um papel.
await adb.doc("bases/kinder/familias/fam-mestra-teste").set({
  responsaveis: [{ nome: "Rita Teste", telefone: "911111111" }], autorizados: [], ativo: true, estado: "confirmada",
});
await adb.doc("bases/kinder/criancas/crianca-fun-teste").set({ nome: "Fun Teste", familiaId: "fam-mestra-teste", categoria: "fun", ativo: true });
await adb.doc("bases/kinder/criancas/crianca-baby-teste").set({ nome: "Baby Teste", familiaId: "fam-mestra-teste", categoria: "baby", ativo: true });
await como("vol-a", VOL);
await chamar("checkinKinder", { criancaIds: ["crianca-fun-teste", "crianca-baby-teste"] });
await adb.doc(`eventos/${HOJE}/escalas/kinder`).set({ pessoas: [], mestras: { fun: "mestra-fun-teste" } }, { merge: true });

await teste("mestra da sala força saída sem código — só na própria sala", async () => {
  await como("mestra-fun-teste", VOL);
  await falha(chamar("checkoutKinder", { criancaIds: ["crianca-baby-teste"], levantadoPor: "Avó Teste", motivo: "teste" }), "permission-denied");
  const r = await chamar("checkoutKinder", { criancaIds: ["crianca-fun-teste"], levantadoPor: "Avó Teste", motivo: "teste" });
  afirmar(r.saidas === 1, `saidas=${r.saidas}`);
  const c = (await adb.doc(`eventos/${HOJE}/checkinKinder/crianca-fun-teste`).get()).data();
  afirmar(c.saidaForcada?.motivo === "teste", "motivo não gravado (mestra)");
});
await teste("voluntário comum (não mestra) não força saída de ninguém", async () => {
  await como("vol-b", VOL);
  await falha(chamar("checkoutKinder", { criancaIds: ["crianca-baby-teste"], levantadoPor: "Avó Teste", motivo: "teste" }), "permission-denied");
});

// ── Mestra publica/edita/remove a lição — mesma permissão da líder,
// confirmada contra a Escala do culto (guardarLicaoKinder/desativarLicaoKinder).
const LICAO_BASE = { atividades: [], licao: { url: "https://example.com/a.pdf", nome: "a.pdf" }, recurso: null, eventoId: HOJE };
await teste("mestra publica a lição da própria sala", async () => {
  await como("mestra-fun-teste", VOL);
  const r = await chamar("guardarLicaoKinder", { id: "licao-teste-fun", novo: true, dados: { ...LICAO_BASE, titulo: "Teste Fun", categorias: ["fun"] } });
  afirmar(r.ok, "não guardou");
  const d = (await adb.doc("bases/kinder/licoes/licao-teste-fun").get()).data();
  afirmar(d.enviadoPor === "mestra-fun-teste", "enviadoPor errado");
});
await teste("mestra não publica lição de outra sala", () =>
  falha(chamar("guardarLicaoKinder", { id: "licao-teste-baby", novo: true, dados: { ...LICAO_BASE, titulo: "Teste Baby", categorias: ["baby"] } }), "permission-denied"));
await teste("voluntário comum não publica lição nenhuma", async () => {
  await como("vol-b", VOL);
  await falha(chamar("guardarLicaoKinder", { id: "licao-teste-x", novo: true, dados: { ...LICAO_BASE, titulo: "Teste X", categorias: ["fun"] } }), "permission-denied");
});
await teste("líder (auxiliar) publica lição de qualquer sala", async () => {
  await como("aux-teste", AUX);
  const r = await chamar("guardarLicaoKinder", { id: "licao-teste-lider", novo: true, dados: { ...LICAO_BASE, titulo: "Teste Líder", categorias: ["junior"] } });
  afirmar(r.ok, "líder não conseguiu publicar");
});
await teste("mestra remove a própria lição; não remove a de outra sala", async () => {
  await como("mestra-fun-teste", VOL);
  await chamar("desativarLicaoKinder", { id: "licao-teste-fun" });
  const d = (await adb.doc("bases/kinder/licoes/licao-teste-fun").get()).data();
  afirmar(d.ativo === false, "não desativou");
  await falha(chamar("desativarLicaoKinder", { id: "licao-teste-lider" }), "permission-denied");
});

await teste("auxiliar da Kinder entra por PIN com papel auxiliar no token", async () => {
  await signOut(auth);
  const r = await chamar("entrar", { baseId: "kinder", pessoaId: "aux-teste", pin: "135790" });
  await signInWithCustomToken(auth, r.token);
  const t = await auth.currentUser.getIdTokenResult();
  afirmar(t.claims.papel === "auxiliar", `papel=${t.claims.papel}`);
});
await teste("auxiliar cria voluntário com categoria; categoria inválida recusada", async () => {
  const r = await chamar("criarVoluntario", { nome: "Vol Baby Teste", telefone: "", papel: "voluntario", categoria: "baby" });
  const p = (await adb.doc(`bases/kinder/pessoas/${r.pessoaId}`).get()).data();
  afirmar(p.categoria === "baby", `categoria=${p.categoria}`);
  await falha(chamar("criarVoluntario", { nome: "X", papel: "voluntario", categoria: "kinder" }), "invalid-argument");
});
await teste("auxiliar continua recusado fora de Louvor/Kinder", async () => {
  await como("lider-apoio", APOIO);
  await falha(chamar("criarVoluntario", { nome: "Y", papel: "auxiliar" }), "invalid-argument");
});

await teste("ocorrências: voluntário regista a sua, não lê a de outro; líder lê todas", async () => {
  await como("vol-a", VOL);
  const ref = await addDoc(collection(db, "bases/kinder/ocorrencias"), { registadoPor: "vol-a", eventoId: HOJE, categoria: "fun", tipo: "queda", descricao: "joelho", paisAvisados: false });
  await falha(addDoc(collection(db, "bases/kinder/ocorrencias"), { registadoPor: "outra", tipo: "x" }), "permission-denied");
  await como("vol-b", VOL);
  await falha(getDoc(ref), "permission-denied");
  await como("aux-teste", AUX);
  afirmar((await getDoc(ref)).exists(), "líder não leu");
});
await teste("checklist de sala: Kinder escreve, outra base não", async () => {
  await como("vol-a", VOL);
  await setDoc(doc(db, `eventos/${HOJE}/checklistKinder/fun`), { itens: { a: { por: "vol-a" } } }, { merge: true });
  await como("lider-apoio", APOIO);
  await falha(setDoc(doc(db, `eventos/${HOJE}/checklistKinder/fun`), { itens: {} }), "permission-denied");
});
await teste("capacitações: cada um marca a sua, não a de outro", async () => {
  await como("vol-a", VOL);
  await setDoc(doc(db, "bases/kinder/pessoas/vol-a/capacitacoes/primeiros-socorros"), { feitaEm: "2026-09-01" });
  await falha(setDoc(doc(db, "bases/kinder/pessoas/vol-b/capacitacoes/primeiros-socorros"), { feitaEm: "2026-09-01" }), "permission-denied");
});

console.log(`\n${passou} passaram, ${falhou} falharam.`);
process.exit(falhou ? 1 : 0);
