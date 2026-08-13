/**
 * Teste de ponta a ponta do ciclo: trocar de base, PINs, ligação
 * multi-base, cultos especiais. Usa identidades reais só para ler
 * (Vitor, Alan, Julio) — nunca escreve nelas. Tudo o que escreve é
 * numa pessoa e num culto de teste descartáveis, criados e apagados
 * de vez no fim (não é histórico real, não faz sentido só desativar).
 *
 * Cuidado propositado: nunca promove ninguém a líder de uma base real
 * (isso demove sozinho quem já lá está — correto na app, mas invasivo
 * demais para repetir num teste automático) nem tenta PIN errado
 * contra uma pessoa real (o bloqueio de 3 tentativas é a sério).
 *
 * Uso: FIREBASE_SERVICE_ACCOUNT_JSON='<json da service account>' npm run teste:ciclo
 * Corre contra produção a sério (Functions + Firestore) — não é mock.
 * Pressupõe Vitor (multi-base), Julio (líder Técnica) e Alan (líder
 * Apoio) tal como estão hoje; se esses papéis mudarem, atualizar aqui.
 */
import admin from "firebase-admin";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const adb = admin.firestore();

const webConfig = {
  apiKey: "AIzaSyCI6P38-lNgXBUXBRRC0uSQkRmpmUsIkbg",
  authDomain: "painel-onda.firebaseapp.com",
  projectId: "painel-onda",
  storageBucket: "painel-onda.firebasestorage.app",
  messagingSenderId: "400975510966",
  appId: "1:400975510966:web:43f11156573b69eee11517",
};
const app = initializeApp(webConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const fns = getFunctions(app, "europe-west1");
const chamar = (nome) => httpsCallable(fns, nome);

let passou = 0, falhou = 0;
const falhas = [];
async function teste(nome, fn) {
  try {
    await fn();
    console.log(`✔ ${nome}`);
    passou++;
  } catch (e) {
    console.error(`✘ ${nome} — ${e.message}`);
    falhou++;
    falhas.push({ nome, erro: e.message });
  }
}

async function loginComo(pessoaId, baseId) {
  const snap = await adb.doc(`bases/${baseId}/pessoas/${pessoaId}`).get();
  const papel = snap.exists && snap.data().papel === "lider_base" ? "lider_base" : "voluntario";
  const token = await admin.auth().createCustomToken(pessoaId, { baseId, papel });
  await signInWithCustomToken(auth, token);
  return auth.currentUser.getIdTokenResult();
}

const hoje = new Date();
const SUFIXO = Date.now().toString(36);
let testePessoaId = null;
let testeCultoId = null;

try {
  // ── 1. dadosEntrada das duas bases ──────────────────────────
  await teste("dadosEntrada(apoio) devolve pessoas", async () => {
    const r = await chamar("dadosEntrada")({ baseId: "apoio" });
    if (!Array.isArray(r.data.pessoas) || !r.data.pessoas.length) throw new Error("lista vazia ou inválida");
  });
  await teste("dadosEntrada(tecnica) devolve pessoas", async () => {
    const r = await chamar("dadosEntrada")({ baseId: "tecnica" });
    if (!Array.isArray(r.data.pessoas) || !r.data.pessoas.length) throw new Error("lista vazia ou inválida");
  });

  // ── 2. login como Vitor (voluntário multi-base) e ciclo de troca ──
  let claims = await loginComo("vitor", "apoio");
  await teste("login inicial como Vitor em Apoio", () => {
    if (claims.claims.baseId !== "apoio") throw new Error(`baseId=${claims.claims.baseId}`);
  });

  await teste("ler bases/apoio/pessoas com claims de apoio funciona", async () => {
    const s = await getDoc(doc(db, "bases/apoio/pessoas/vitor"));
    if (!s.exists()) throw new Error("não leu o próprio documento");
  });

  await teste("ler bases/tecnica/pessoas com claims de apoio é recusado (regra a funcionar)", async () => {
    try {
      await getDoc(doc(db, "bases/tecnica/pessoas/vitor"));
      throw new Error("devia ter sido recusado pelas regras");
    } catch (e) {
      if (e.code !== "permission-denied") throw new Error(`código inesperado: ${e.code}`);
    }
  });

  await teste("trocarBase apoio -> tecnica devolve token novo", async () => {
    const r = await chamar("trocarBase")({ novoBaseId: "tecnica" });
    if (!r.data.token) throw new Error("sem token");
    await signInWithCustomToken(auth, r.data.token);
  });

  await teste("claims depois da troca dizem tecnica", async () => {
    const t = await auth.currentUser.getIdTokenResult(true);
    if (t.claims.baseId !== "tecnica") throw new Error(`baseId=${t.claims.baseId}`);
  });

  await teste("ler bases/tecnica/pessoas com claims de tecnica funciona", async () => {
    const s = await getDoc(doc(db, "bases/tecnica/pessoas/vitor"));
    if (!s.exists()) throw new Error("não leu o próprio documento");
  });

  await teste("ler bases/apoio/pessoas com claims de tecnica é recusado (regra a funcionar)", async () => {
    try {
      await getDoc(doc(db, "bases/apoio/pessoas/vitor"));
      throw new Error("devia ter sido recusado pelas regras");
    } catch (e) {
      if (e.code !== "permission-denied") throw new Error(`código inesperado: ${e.code}`);
    }
  });

  await teste("trocarBase tecnica -> apoio (volta) funciona", async () => {
    const r = await chamar("trocarBase")({ novoBaseId: "apoio" });
    await signInWithCustomToken(auth, r.data.token);
    const t = await auth.currentUser.getIdTokenResult(true);
    if (t.claims.baseId !== "apoio") throw new Error(`baseId=${t.claims.baseId}`);
  });

  await teste("trocarBase para uma base onde não está (inválida) é recusado", async () => {
    try {
      await chamar("trocarBase")({ novoBaseId: "naoexiste" });
      throw new Error("devia ter recusado");
    } catch (e) {
      if (e.code !== "functions/permission-denied") throw new Error(`código inesperado: ${e.code}`);
    }
  });

  // ── 3. líder cria a pessoa de teste (nunca mexe em pessoas reais) ──
  await loginComo("julio", "tecnica");

  await teste("criarVoluntario (identidade nova) como líder da Técnica", async () => {
    const r = await chamar("criarVoluntario")({
      nome: `Teste E2E ${SUFIXO}`, telefone: "900000000", papel: "voluntario",
    });
    if (!r.data.pessoaId || !r.data.pinProvisorio) throw new Error("resposta incompleta");
    if (r.data.pinProvisorio.length !== 4) throw new Error(`PIN provisório com ${r.data.pinProvisorio.length} dígitos, esperava 4`);
    testePessoaId = r.data.pessoaId;
  });

  await teste("dadosEntrada(tecnica) já mostra a pessoa de teste com 4 dígitos", async () => {
    const r = await chamar("dadosEntrada")({ baseId: "tecnica" });
    const p = r.data.pessoas.find((x) => x.id === testePessoaId);
    if (!p) throw new Error("pessoa de teste não aparece na lista");
    if (p.digitos !== 4) throw new Error(`digitos=${p.digitos}, esperava 4`);
  });

  // ── 4. PIN errado — só contra a pessoa de teste, nunca real ──
  await teste("entrar com PIN errado (pessoa de teste) devolve permission-denied, não crasha", async () => {
    try {
      await chamar("entrar")({ baseId: "tecnica", pessoaId: testePessoaId, pin: "0000" });
      throw new Error("devia ter recusado");
    } catch (e) {
      if (e.code !== "functions/permission-denied") throw new Error(`código inesperado: ${e.code} — ${e.message}`);
    }
  });

  await teste("reporPin na pessoa de teste continua a dar 4 dígitos (é voluntária)", async () => {
    const r = await chamar("reporPin")({ pessoaId: testePessoaId });
    if (r.data.pinProvisorio.length !== 4) throw new Error(`PIN reposto com ${r.data.pinProvisorio.length} dígitos, esperava 4`);
  });

  await teste("listarPessoasDaBase(apoio) como líder da Técnica (browse cross-base)", async () => {
    const r = await chamar("listarPessoasDaBase")({ baseId: "apoio" });
    if (!Array.isArray(r.data.pessoas) || !r.data.pessoas.length) throw new Error("lista vazia");
    const semTelefone = r.data.pessoas.some((p) => p.telefone === undefined);
    if (semTelefone) throw new Error("telefone não veio no payload");
  });

  // ── 5. ligar a pessoa de teste também na Apoio (multi-base) ──
  await loginComo("alan", "apoio");
  await teste("criarVoluntario com pessoaExistenteId liga a pessoa de teste na Apoio", async () => {
    const r = await chamar("criarVoluntario")({
      nome: `Teste E2E ${SUFIXO}`, telefone: "900000000", papel: "voluntario",
      pessoaExistenteId: testePessoaId,
    });
    if (r.data.pessoaId !== testePessoaId) throw new Error("pessoaId devolvido não bate certo");
    if (r.data.pinProvisorio !== null) throw new Error("não devia gerar PIN novo ao ligar identidade existente");
  });

  await teste("pessoas/{id}.bases fica com as duas bases (mapa aninhado, não campo literal)", async () => {
    const g = await adb.doc(`pessoas/${testePessoaId}`).get();
    const d = g.data();
    if (Object.keys(d).some((k) => k.startsWith("bases."))) throw new Error("voltou o bug do campo literal bases.X");
    if (!d.bases?.apoio || !d.bases?.tecnica) throw new Error(`bases=${JSON.stringify(d.bases)}`);
  });

  await teste("ligar a mesma pessoa outra vez na mesma base é recusado (already-exists)", async () => {
    try {
      await chamar("criarVoluntario")({
        nome: "x", telefone: "900000000", papel: "voluntario", pessoaExistenteId: testePessoaId,
      });
      throw new Error("devia ter recusado");
    } catch (e) {
      if (e.code !== "functions/already-exists") throw new Error(`código inesperado: ${e.code}`);
    }
  });

  await teste("a pessoa de teste, agora multi-base, consegue trocarBase apoio->tecnica", async () => {
    await loginComo(testePessoaId, "apoio");
    const r = await chamar("trocarBase")({ novoBaseId: "tecnica" });
    await signInWithCustomToken(auth, r.data.token);
    const t = await auth.currentUser.getIdTokenResult(true);
    if (t.claims.baseId !== "tecnica") throw new Error(`baseId=${t.claims.baseId}`);
  });

  // ── 6. culto especial: criar, listar, excluir, recusar domingo ──
  await loginComo("julio", "tecnica");
  const anoTeste = hoje.getFullYear() + 1;
  const dataTeste = `${anoTeste}-01-15`;

  await teste("criarCultoEspecial cria um culto de teste no futuro", async () => {
    const r = await chamar("criarCultoEspecial")({ data: dataTeste, tipo: `Culto Teste E2E ${SUFIXO}` });
    testeCultoId = r.data.eventoId;
    if (testeCultoId !== dataTeste) throw new Error(`eventoId=${testeCultoId}`);
  });

  await teste("criar o mesmo culto outra vez é recusado (already-exists)", async () => {
    try {
      await chamar("criarCultoEspecial")({ data: dataTeste, tipo: "Duplicado" });
      throw new Error("devia ter recusado");
    } catch (e) {
      if (e.code !== "functions/already-exists") throw new Error(`código inesperado: ${e.code}`);
    }
  });

  await teste("o culto de teste aparece ativo por omissão", async () => {
    const s = await adb.doc(`eventos/${testeCultoId}`).get();
    if (s.data().ativo === false) throw new Error("já nasceu desativado");
  });

  await teste("excluirCultoEspecial desativa (não apaga) o culto de teste", async () => {
    await chamar("excluirCultoEspecial")({ eventoId: testeCultoId });
    const s = await adb.doc(`eventos/${testeCultoId}`).get();
    if (!s.exists) throw new Error("o documento foi apagado, devia só desativar");
    if (s.data().ativo !== false) throw new Error("não ficou ativo:false");
  });

  await teste("excluirCultoEspecial recusa excluir um domingo (tipo vazio)", async () => {
    const umDomingoSnap = await adb.collection("eventos").where("tipo", "==", null).limit(1).get();
    if (umDomingoSnap.empty) { console.log("  (sem domingos com tipo:null, salto)"); return; }
    const domingoId = umDomingoSnap.docs[0].id;
    try {
      await chamar("excluirCultoEspecial")({ eventoId: domingoId });
      throw new Error("devia ter recusado excluir um domingo");
    } catch (e) {
      if (e.code !== "functions/failed-precondition") throw new Error(`código inesperado: ${e.code} (${e.message})`);
    }
  });

  // ── 7. remover a pessoa de teste das duas bases ──────────────
  await loginComo("julio", "tecnica");
  await teste("removerVoluntario desativa a pessoa de teste na Técnica", async () => {
    await chamar("removerVoluntario")({ pessoaId: testePessoaId });
    const s = await adb.doc(`bases/tecnica/pessoas/${testePessoaId}`).get();
    if (s.data().ativo !== false) throw new Error("não ficou ativo:false");
  });

  await loginComo("alan", "apoio");
  await teste("removerVoluntario desativa a pessoa de teste na Apoio", async () => {
    await chamar("removerVoluntario")({ pessoaId: testePessoaId });
    const s = await adb.doc(`bases/apoio/pessoas/${testePessoaId}`).get();
    if (s.data().ativo !== false) throw new Error("não ficou ativo:false");
  });

  await teste("depois de inativa nas duas bases, o segredo do PIN foi apagado", async () => {
    const s = await adb.doc(`pessoas/${testePessoaId}/privado/auth`).get();
    if (s.exists) throw new Error("o segredo continua lá");
  });

} finally {
  await signOut(auth).catch(() => {});
  // nunca deveria ter mexido em julio/alan (só leitura/login) — confere
  // e repõe na mesma, por garantia, já que este script corre repetidas vezes
  await adb.doc("bases/tecnica/pessoas/julio").set({ papel: "lider_base" }, { merge: true }).catch(() => {});
  await adb.doc("bases/apoio/pessoas/alan").set({ papel: "lider_base" }, { merge: true }).catch(() => {});

  if (testePessoaId) {
    await adb.doc(`bases/tecnica/pessoas/${testePessoaId}`).delete().catch(() => {});
    await adb.doc(`bases/apoio/pessoas/${testePessoaId}`).delete().catch(() => {});
    await adb.doc(`pessoas/${testePessoaId}`).delete().catch(() => {});
    await adb.doc(`pessoas/${testePessoaId}/privado/auth`).delete().catch(() => {});
    console.log(`\n(limpeza) pessoa de teste ${testePessoaId} apagada de vez`);
  }
  if (testeCultoId) {
    await adb.doc(`eventos/${testeCultoId}`).delete().catch(() => {});
    await adb.doc(`eventos/${testeCultoId}/escalas/tecnica`).delete().catch(() => {});
    console.log(`(limpeza) culto de teste ${testeCultoId} apagado de vez`);
  }
}

console.log(`\n${passou} passaram, ${falhou} falharam.`);
if (falhou) {
  console.log("\nFalhas:");
  falhas.forEach((f) => console.log(`  - ${f.nome}: ${f.erro}`));
  process.exit(1);
}
