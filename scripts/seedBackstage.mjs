/**
 * Cria bases/backstage — sem pessoas, sem funções: essa base ainda
 * não tem equipa real, isto só liga a configuração para as abas da
 * app nascerem certas e as capacidades (veEscalas, culto.podePublicar,
 * eventos.podeCriarGlobal) ficarem ativas.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedBackstage.mjs
 *
 * Repetir não duplica (usa merge).
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

async function main() {
  await db.doc("bases/backstage").set({
    nome: "Backstage", slug: "backstage", cor: "#0019BE",
    horaChegada: null, horaCulto: "10:30",
    local: "Casa do Povo de Vermoim, Maia", ativa: true,
    ministeriosAtivos: false,
    inventario: { rotulo: "Inventário", tipo: "consumivel" },
    veEscalas: "todas",
    culto: { podePublicar: true },
    eventos: { podeCriarGlobal: true },
    escala: { maxPorMesRecomendado: 2, aprendizContaParaLimite: true },
  }, { merge: true });

  console.log("bases/backstage criada/atualizada");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
