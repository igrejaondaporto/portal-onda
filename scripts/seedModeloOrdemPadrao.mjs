/**
 * Semeia o "Domingo típico" — o modelo padrão da ordem do culto, em
 * `bases/pastoral/modelosOrdem/domingo-tipico`, com `padrao: true`
 * para `Ordem.jsx` o distinguir de modelos que o pastor venha a criar
 * (esses nunca têm este campo).
 *
 * O conteúdo é a espinha de uma ordem real (ONDA PORTO, 06/09) — hora,
 * momento, duração, projeção e detalhe; o `responsável` fica sempre
 * `null`, mesma regra de qualquer modelo (`guardarModelo` em
 * lib/ordem.js): quem prega muda de semana para semana, e um modelo
 * com o nome da semana passada publicava o pregador errado.
 *
 * Os avisos ("CONF26", "STORE"…) da mesma ordem ficam de fora de
 * propósito — são específicos daquele domingo, não da espinha; um
 * modelo nunca guarda avisos (confirma `guardarModelo`, só grava
 * `momentos`).
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedModeloOrdemPadrao.mjs
 *
 * Corre uma vez para criar; correr de novo só atualiza o mesmo
 * documento (id fixo, `set` sem merge — é a espinha inteira de cada vez).
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const MOMENTOS = [
  { hora: "09:30", momento: "Pré-culto com ceia", minutos: 30, projecao: "PAD", detalhe: "Todos os voluntários", responsavel: null },
  { hora: "10:00", momento: "Café dos voluntários", minutos: 10, projecao: null, detalhe: "Todos os voluntários", responsavel: null },
  { hora: "10:10", momento: "Contagem", minutos: 20, projecao: "Vídeo Contagem", detalhe: "Iluminação: black total", responsavel: null },
  { hora: "10:30", momento: "Louvor #1", minutos: 5, projecao: "BG's Louvor", detalhe: "Iluminação: baixa", responsavel: null },
  { hora: "10:35", momento: "Ceia", minutos: 10, projecao: "Slides Relat. Contribua", detalhe: "Iluminação: média", responsavel: null },
  { hora: "10:45", momento: "Louvor #2", minutos: 20, projecao: "BG's Louvor", detalhe: "Iluminação: baixa", responsavel: null },
  { hora: "11:05", momento: "Contribua", minutos: 5, projecao: "Slides Relat. Contribua", detalhe: "Iluminação: alta", responsavel: null },
  { hora: "11:10", momento: "Vídeo \"Onda News\"", minutos: 6, projecao: "Vídeo Avisos Globais", detalhe: "Iluminação: black total", responsavel: null },
  { hora: "11:17", momento: "Visitantes + Avisos locais", minutos: 8, projecao: "BG Visitantes + Avisos", detalhe: "Iluminação: alta", responsavel: null },
  { hora: "11:25", momento: "Mensagem", minutos: 40, projecao: "Slides Mensagem", detalhe: "Iluminação: alta", responsavel: null },
  { hora: "12:05", momento: "Apelo", minutos: 10, projecao: "BG Apelo", detalhe: "Iluminação: média", responsavel: null },
  { hora: "12:15", momento: "Oração final", minutos: 5, projecao: "BG Final", detalhe: "Iluminação: alta", responsavel: null },
];

await db.doc("bases/pastoral/modelosOrdem/domingo-tipico").set({
  nome: "Domingo típico",
  momentos: MOMENTOS,
  padrao: true,
  ativo: true,
  atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
});

console.log(`✓ "Domingo típico" semeado — ${MOMENTOS.length} momentos.`);
process.exit(0);
