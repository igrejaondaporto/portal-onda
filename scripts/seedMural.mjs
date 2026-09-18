/**
 * Semeia o Mural Onda com anúncios de exemplo, para haver algo para
 * ver no primeiro deploy (mural nenhum convence vazio) — e, a pedido
 * explícito do dono do produto (2026-09, "isso é só teste para ver
 * como fica"), com nomes e fotos REAIS de voluntários, copiados de
 * `bases/{baseId}/pessoas` — de qualquer base que já tenha gente
 * semeada, nunca só da Apoio — para o painel aparecer totalmente
 * preenchido, como ficaria a sério, e para a "base" ao lado do nome
 * ser sempre a base real da pessoa (ver `pessoasReais()` abaixo).
 *
 * O que NÃO fica ligado ao voluntário real, mesmo assim: o "autor"
 * de cada anúncio de exemplo continua a ser uma identidade só de
 * teste (`pessoas/tel_...`, nunca o pessoaId real). Só o nome e a
 * foto são copiados — nunca o telefone. Sem isto, o botão "Falar no
 * WhatsApp" de um anúncio inventado abriria o número verdadeiro de
 * alguém que nunca publicou nada, e mandava uma pessoa real e
 * inconsciente receber mensagens sobre um sofá que não existe. Por
 * isso a identidade de teste NÃO leva telefone nenhum gravado (nem
 * sequer o fictício do id `tel_000000001`) — `telefoneDoAutor`
 * (functions/mural.js) só devolve `p.telefone` se existir, por isso
 * sem o campo o botão falha de forma segura ("Sem contacto
 * disponível"), em vez de abrir o WhatsApp com um número fictício
 * tipo +351000000001 (bug real, apanhado 2026-09 — o campo estava lá
 * preenchido com os dígitos do id, e o botão encontrava "contacto").
 *
 * As fotos dos ANÚNCIOS em si (picsum.photos, semente fixa por
 * anúncio) são só para testar o layout com fotos a sério — não são
 * fotos do produto de verdade nenhum.
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedMural.mjs
 *
 * Idempotente: ids fixos (pessoas `tel_...`, anúncios `exemplo-NN`),
 * merge:true — corre outra vez sem duplicar, e atualiza o que mudar
 * aqui (nomes, textos…) nos documentos já semeados.
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

const NUM_PESSOAS = 15;

function nomeBase(nome) {
  const n = String(nome || "").trim();
  return /^base\b/i.test(n) ? n : `Base ${n}`;
}

/** Vai buscar voluntários reais (nome + foto), de QUALQUER base que já
 *  tenha gente semeada — nunca só da Apoio — para a "base" ao lado do
 *  nome, em cada anúncio de exemplo, ser sempre a base a que a pessoa
 *  pertence a sério. Antes disto o `local` de cada anúncio vinha fixo
 *  no array ANUNCIOS (ex.: "Base Técnica", "Base Kinder"), sem ligação
 *  nenhuma a quem calhava a ser o autor — como só a Apoio tinha gente
 *  semeada, isso pôs voluntários reais da Apoio a aparecer etiquetados
 *  com bases onde nunca serviram (reportado 2026-09). Agora o `local`
 *  de cada anúncio nasce da própria pessoa escolhida, nunca do array.
 *  Se nenhuma base tiver gente semeada, cai para nomes claramente
 *  fictícios em vez de rebentar. */
async function pessoasReais() {
  const basesSnap = await db.collection("bases").get();
  const pessoas = [];
  for (const baseDoc of basesSnap.docs) {
    const local = nomeBase(baseDoc.data().nome || baseDoc.id);
    let snap;
    try {
      snap = await db.collection(`bases/${baseDoc.id}/pessoas`).where("ativo", "==", true).orderBy("nome").get();
    } catch {
      continue; // base sem essa subcoleção, ou sem índice — não é o essencial aqui
    }
    for (const d of snap.docs) {
      pessoas.push({ nome: d.data().nome, foto: d.data().foto ?? null, local });
    }
  }
  if (!pessoas.length) {
    console.log("Nenhuma base tem gente semeada — a usar nomes fictícios (corre `npm run seed` primeiro para nomes/fotos/bases reais).");
    return Array.from({ length: NUM_PESSOAS }, (_, i) => ({ nome: `Pessoa de Exemplo ${i + 1}`, foto: null, local: "Igreja Onda" }));
  }
  // repete a lista se houver menos de NUM_PESSOAS voluntários semeados no total
  return Array.from({ length: NUM_PESSOAS }, (_, i) => pessoas[i % pessoas.length]);
}

const DIA = 24 * 60 * 60 * 1000;
// `local` não vem daqui — nasce da própria pessoa escolhida em
// `pessoasReais()`, para nunca poder mentir sobre a base de alguém
// (ver o aviso em `pessoasReais`). `regiao` continua livre aqui: é
// onde o anúncio está, não a base de quem o publica.
const ANUNCIOS = [
  { tipo: "ofereco", categoria: "venda", regiao: "norte", titulo: "Golf 1.6 TDI de 2014", preco: "7.400 €", diasAtras: 2, foto: "carro-1",
    descricao: "168 mil km, revisões em dia, dois donos. Inspeção válida até 2028. Aceito ver na Maia ao sábado de manhã.", autor: 0 },
  { tipo: "ofereco", categoria: "doacao", regiao: "norte", titulo: "Berço com colchão", gratis: true, diasAtras: 3, foto: "berco-1",
    descricao: "A minha filha já passou para a cama grande. Impecável, só precisa de uma lavagem no resguardo.", autor: 1 },
  { tipo: "ofereco", categoria: "arrendamento", regiao: "norte", titulo: "T2 na Maia, junto ao metro", preco: "650 €/mês", diasAtras: 4, estado: "reservado", foto: "casa-1",
    descricao: "Segundo andar sem elevador, mobilado, aquecimento central. Cinco minutos a pé da estação.", autor: 2 },
  { tipo: "ofereco", categoria: "emprego", regiao: "norte", titulo: "Ajudante de cozinha", preco: "A combinar", diasAtras: 5, foto: "cozinha-1",
    descricao: "Restaurante na Senhora da Hora, part-time ao almoço, terça a sábado. Não é preciso experiência.", autor: 3 },
  { tipo: "ofereco", categoria: "venda", regiao: "norte", titulo: "Sofá de 3 lugares, cinzento", preco: "120 €", diasAtras: 7, foto: "sofa-1",
    descricao: "Bom estado, sem rasgões. Entrega na Maia, é só combinar.", autor: 4 },
  { tipo: "ofereco", categoria: "doacao", regiao: "lisboa", titulo: "Roupa de menino, 4 a 6 anos", gratis: true, diasAtras: 2, foto: "roupa-1",
    descricao: "Dois sacos, tudo lavado e dobrado. Levanta-se em Benfica.", autor: 5 },
  { tipo: "ofereco", categoria: "venda", regiao: "lisboa", titulo: "Secretária e cadeira de escritório", preco: "80 €", diasAtras: 6, foto: "secretaria-1",
    descricao: "Mudei de casa e já não tenho espaço. A cadeira tem um braço a precisar de aperto.", autor: 6 },
  { tipo: "ofereco", categoria: "arrendamento", regiao: "sines", titulo: "Quarto em Santo André", preco: "280 €/mês", diasAtras: 7, foto: "quarto-1",
    descricao: "Casa partilhada com mais duas pessoas, despesas incluídas. Prefiro alguém da igreja.", autor: 7 },
  { tipo: "ofereco", categoria: "emprego", regiao: "sines", titulo: "Precisa-se de eletricista", preco: "A combinar", diasAtras: 4, foto: "eletricista-1",
    descricao: "Obra pequena, uns quinze dias de trabalho. Pago à semana.", autor: 8 },
  { tipo: "ofereco", categoria: "venda", regiao: "norte", titulo: "Bicicleta de criança, 20 polegadas", preco: "45 €", diasAtras: 21, estado: "vendido", foto: "bicicleta-1",
    descricao: "Já foi vendida — fica no histórico, não no mural.", autor: 4 },
  { tipo: "procuro", categoria: "objetos", regiao: "norte", titulo: "Preciso de uma cama de grades", preco: "Até 60 €", diasAtras: 1, foto: "cama-grades-1",
    descricao: "Uma parecida com esta, para o segundo bebé que chega em novembro — a que temos já não dá.", autor: 9 },
  { tipo: "procuro", categoria: "servicos", regiao: "norte", titulo: "Explicações de matemática, 9.º ano", preco: "Pago", diasAtras: 2,
    descricao: "Para o meu filho, duas vezes por semana, ao fim da tarde. Na Maia ou por vídeo.", autor: 10 },
  { tipo: "procuro", categoria: "boleias", regiao: "norte", titulo: "Boleia para o culto, de Gondomar", preco: "Domingos", diasAtras: 4, foto: "boleia-1",
    descricao: "Perdi o carro e o metro ao domingo de manhã é complicado. Somos duas.", autor: 11 },
  { tipo: "procuro", categoria: "emprego", regiao: "norte", titulo: "Procuro trabalho em limpezas", preco: "Disponível já", diasAtras: 7,
    descricao: "Experiência em escritórios e casas particulares, com referências.", autor: 12 },
  { tipo: "procuro", categoria: "servicos", regiao: "lisboa", titulo: "Alguém que arranje máquinas de lavar", preco: "Pago", diasAtras: 3,
    descricao: "Deixou de centrifugar. Antes de deitar fora, queria uma opinião de confiança.", autor: 13 },
  { tipo: "procuro", categoria: "objetos", regiao: "sines", titulo: "Preciso de uma mesa de cozinha", preco: "Até 40 €", diasAtras: 5,
    descricao: "Pequena, para duas ou três pessoas. Mudámos de casa e ficámos sem.", autor: 14 },
];

async function main() {
  const pessoas = await pessoasReais();

  console.log("A semear identidades de teste (nome/foto/base reais, sem telefone nenhum — ver aviso no topo do ficheiro)…");
  for (const [i, p] of pessoas.entries()) {
    const id = `tel_${String(i + 1).padStart(9, "0")}`;
    await db.doc(`pessoas/${id}`).set({
      nome: p.nome, foto: p.foto, telefone: "", gdId: null, ativo: true, bases: {},
      origemMural: true, exemploSeed: true, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  console.log("A semear anúncios de exemplo…");
  for (const [i, a] of ANUNCIOS.entries()) {
    const pessoa = pessoas[a.autor];
    const autorId = `tel_${String(a.autor + 1).padStart(9, "0")}`;
    const agora = Date.now() - a.diasAtras * DIA;
    const id = `exemplo-${String(i + 1).padStart(2, "0")}`;
    await db.doc(`anuncios/${id}`).set({
      tipo: a.tipo, categoria: a.categoria, titulo: a.titulo, descricao: a.descricao,
      regiao: a.regiao, preco: a.gratis ? "" : a.preco, gratis: !!a.gratis,
      estado: a.estado || "disponivel", ativo: true,
      fotos: a.foto ? [`https://picsum.photos/seed/${a.foto}/700/700`] : [],
      autorId, autorNome: pessoa.nome, autorFoto: pessoa.foto, autorLocal: pessoa.local,
      numReports: 0, reportadoPor: [], ultimosReports: [], lembreteEnviado: false, pedirConfirmacao: false,
      exemploSeed: true,
      criadoEm: admin.firestore.Timestamp.fromMillis(agora),
      atualizadoEm: admin.firestore.Timestamp.fromMillis(agora),
      expiraEm: admin.firestore.Timestamp.fromMillis(agora + 30 * DIA),
    }, { merge: true });
  }

  // limpa anúncios de exemplo de uma versão anterior deste script,
  // de quando os ids ainda eram gerados automaticamente (add(), não
  // set(id)) — sem isto ficavam duplicados ao lado dos novos, ids
  // determinísticos, para sempre.
  const idsAtuais = new Set(ANUNCIOS.map((_, i) => `exemplo-${String(i + 1).padStart(2, "0")}`));
  const antigos = await db.collection("anuncios").where("exemploSeed", "==", true).get();
  const paraApagar = antigos.docs.filter((d) => !idsAtuais.has(d.id));
  await Promise.all(paraApagar.map((d) => d.ref.delete()));
  if (paraApagar.length) console.log(`${paraApagar.length} anúncios de exemplo antigos (ids automáticos) removidos.`);

  console.log(`${pessoasReais.length} identidades de teste e ${ANUNCIOS.length} anúncios de exemplo semeados.`);
  console.log("Para limpar tudo mais tarde: apagar em `anuncios` e `pessoas` onde exemploSeed==true.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
