/**
 * Semeia o Mural Onda com anúncios de exemplo, para haver algo para
 * ver no primeiro deploy (mural nenhum convence vazio).
 *
 * Pessoas claramente fictícias, de propósito — é a convenção já
 * escrita em apps/pessoal/CLAUDE.md ("Dados de exemplo claramente
 * fictícios em seeds/demos, nunca nomes reais") e vale ainda mais
 * aqui: um anúncio inventado ("vendo o meu carro") atribuído a um
 * voluntário real e identificável, sem ele saber, é o tipo de coisa
 * que confunde ou constrange se alguém tropeçar nisso antes de saber
 * que é só demonstração. Cada pessoa fica marcada `exemploSeed:true`
 * — fácil de encontrar e apagar antes de o Mural abrir a sério à
 * igreja (ver a query no fim deste ficheiro).
 *
 *   1. Firebase → Definições → Contas de serviço → Gerar chave privada
 *   2. guardar como service-account.json na raiz (está no .gitignore)
 *   3. node scripts/seedMural.mjs
 *
 * Corre uma vez. Repetir não duplica (ids fixos, merge:true).
 */
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

const chave = JSON.parse(readFileSync("./service-account.json", "utf8"));
admin.initializeApp({ credential: admin.credential.cert(chave) });
const db = admin.firestore();

// id determinístico "tel_" — a mesma família de id de quem regista
// pelo Mural a sério (ver idParaTelefone em functions/mural.js), só
// que com um telefone que nunca vai bater com ninguém real.
const PESSOAS = [
  { id: "tel_000000001", nome: "Ricardo Matos (exemplo)", local: "Base Técnica" },
  { id: "tel_000000002", nome: "Sofia Andrade (exemplo)", local: "Base Kinder" },
  { id: "tel_000000003", nome: "Paulo Carvalho (exemplo)", local: "Base de Apoio" },
  { id: "tel_000000004", nome: "Marta Ferreira (exemplo)", local: "Base New" },
  { id: "tel_000000005", nome: "Vítor Nunes (exemplo)", local: "Base de Apoio" },
  { id: "tel_000000006", nome: "Inês Bettencourt (exemplo)", local: "GD Lisboa" },
  { id: "tel_000000007", nome: "Hugo Trindade (exemplo)", local: "GD Lisboa" },
  { id: "tel_000000008", nome: "Bruno Lopes (exemplo)", local: "GD Santo André — Sines" },
  { id: "tel_000000009", nome: "Tiago Palma (exemplo)", local: "GD Piscina — Sines" },
  { id: "tel_000000010", nome: "Joana Pinheiro (exemplo)", local: "GD Fânzeres" },
  { id: "tel_000000011", nome: "Nuno Resende (exemplo)", local: "Base Backstage" },
  { id: "tel_000000012", nome: "Alzira Santos (exemplo)", local: "GD Gaia" },
  { id: "tel_000000013", nome: "Elsa Maia (exemplo)", local: "Base de Apoio" },
  { id: "tel_000000014", nome: "Carla Bastos (exemplo)", local: "GD Lisboa" },
  { id: "tel_000000015", nome: "Rute Aleixo (exemplo)", local: "GD New — Sines" },
];

const DIA = 24 * 60 * 60 * 1000;
const ANUNCIOS = [
  { tipo: "ofereco", categoria: "venda", regiao: "norte", titulo: "Golf 1.6 TDI de 2014", preco: "7.400 €", diasAtras: 2,
    descricao: "168 mil km, revisões em dia, dois donos. Inspeção válida até 2028. Aceito ver na Maia ao sábado de manhã.", autor: 0 },
  { tipo: "ofereco", categoria: "doacao", regiao: "norte", titulo: "Berço com colchão", gratis: true, diasAtras: 3,
    descricao: "A minha filha já passou para a cama grande. Impecável, só precisa de uma lavagem no resguardo.", autor: 1 },
  { tipo: "ofereco", categoria: "arrendamento", regiao: "norte", titulo: "T2 na Maia, junto ao metro", preco: "650 €/mês", diasAtras: 4, estado: "reservado",
    descricao: "Segundo andar sem elevador, mobilado, aquecimento central. Cinco minutos a pé da estação.", autor: 2 },
  { tipo: "ofereco", categoria: "emprego", regiao: "norte", titulo: "Ajudante de cozinha", preco: "A combinar", diasAtras: 5,
    descricao: "Restaurante na Senhora da Hora, part-time ao almoço, terça a sábado. Não é preciso experiência.", autor: 3 },
  { tipo: "ofereco", categoria: "venda", regiao: "norte", titulo: "Sofá de 3 lugares, cinzento", preco: "120 €", diasAtras: 7,
    descricao: "Bom estado, sem rasgões. Entrega na Maia, é só combinar.", autor: 4 },
  { tipo: "ofereco", categoria: "doacao", regiao: "lisboa", titulo: "Roupa de menino, 4 a 6 anos", gratis: true, diasAtras: 2,
    descricao: "Dois sacos, tudo lavado e dobrado. Levanta-se em Benfica.", autor: 5 },
  { tipo: "ofereco", categoria: "venda", regiao: "lisboa", titulo: "Secretária e cadeira de escritório", preco: "80 €", diasAtras: 6,
    descricao: "Mudei de casa e já não tenho espaço. A cadeira tem um braço a precisar de aperto.", autor: 6 },
  { tipo: "ofereco", categoria: "arrendamento", regiao: "sines", titulo: "Quarto em Santo André", preco: "280 €/mês", diasAtras: 7,
    descricao: "Casa partilhada com mais duas pessoas, despesas incluídas. Prefiro alguém da igreja.", autor: 7 },
  { tipo: "ofereco", categoria: "emprego", regiao: "sines", titulo: "Precisa-se de eletricista", preco: "A combinar", diasAtras: 4,
    descricao: "Obra pequena, uns quinze dias de trabalho. Pago à semana.", autor: 8 },
  { tipo: "ofereco", categoria: "venda", regiao: "norte", titulo: "Bicicleta de criança, 20 polegadas", preco: "45 €", diasAtras: 21, estado: "vendido",
    descricao: "Já foi vendida — fica no histórico, não no mural.", autor: 4 },
  { tipo: "procuro", categoria: "objetos", regiao: "norte", titulo: "Preciso de uma cama de grades", preco: "Até 60 €", diasAtras: 1,
    descricao: "Estamos à espera do segundo bebé para novembro e a cama que temos já não dá.", autor: 9 },
  { tipo: "procuro", categoria: "servicos", regiao: "norte", titulo: "Explicações de matemática, 9.º ano", preco: "Pago", diasAtras: 2,
    descricao: "Para o meu filho, duas vezes por semana, ao fim da tarde. Na Maia ou por vídeo.", autor: 10 },
  { tipo: "procuro", categoria: "boleias", regiao: "norte", titulo: "Boleia para o culto, de Gondomar", preco: "Domingos", diasAtras: 4,
    descricao: "Perdi o carro e o metro ao domingo de manhã é complicado. Somos duas.", autor: 11 },
  { tipo: "procuro", categoria: "emprego", regiao: "norte", titulo: "Procuro trabalho em limpezas", preco: "Disponível já", diasAtras: 7,
    descricao: "Experiência em escritórios e casas particulares, com referências.", autor: 12 },
  { tipo: "procuro", categoria: "servicos", regiao: "lisboa", titulo: "Alguém que arranje máquinas de lavar", preco: "Pago", diasAtras: 3,
    descricao: "Deixou de centrifugar. Antes de deitar fora, queria uma opinião de confiança.", autor: 13 },
  { tipo: "procuro", categoria: "objetos", regiao: "sines", titulo: "Preciso de uma mesa de cozinha", preco: "Até 40 €", diasAtras: 5,
    descricao: "Pequena, para duas ou três pessoas. Mudámos de casa e ficámos sem.", autor: 14 },
];

async function main() {
  console.log("A semear pessoas de exemplo…");
  for (const p of PESSOAS) {
    await db.doc(`pessoas/${p.id}`).set({
      nome: p.nome, telefone: p.id.replace("tel_", ""), gdId: null, ativo: true, bases: {},
      origemMural: true, exemploSeed: true, criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  console.log("A semear anúncios de exemplo…");
  for (const a of ANUNCIOS) {
    const pessoa = PESSOAS[a.autor];
    const agora = Date.now() - a.diasAtras * DIA;
    await db.collection("anuncios").add({
      tipo: a.tipo, categoria: a.categoria, titulo: a.titulo, descricao: a.descricao,
      regiao: a.regiao, preco: a.gratis ? "" : a.preco, gratis: !!a.gratis,
      estado: a.estado || "disponivel", ativo: true, fotos: [],
      autorId: pessoa.id, autorNome: pessoa.nome, autorFoto: null, autorLocal: pessoa.local,
      numReports: 0, reportadoPor: [], ultimosReports: [], lembreteEnviado: false, pedirConfirmacao: false,
      exemploSeed: true,
      criadoEm: admin.firestore.Timestamp.fromMillis(agora),
      atualizadoEm: admin.firestore.Timestamp.fromMillis(agora),
      expiraEm: admin.firestore.Timestamp.fromMillis(agora + 30 * DIA),
    });
  }
  console.log(`${PESSOAS.length} pessoas e ${ANUNCIOS.length} anúncios de exemplo semeados.`);
  console.log("Para limpar mais tarde: apagar tudo em `anuncios` e `pessoas` com exemploSeed==true.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
