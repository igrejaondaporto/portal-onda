/**
 * Formulário de contacto — substitui o Google Forms atual.
 *
 * Fica gravado em `contactos/{id}`, coleção GLOBAL (ver comentário em
 * firestore.rules) — o painel do pastor (ainda não existe) vai um dia
 * ler isto por cima de todas as bases. Por agora só a Base Pessoal
 * escreve, com `etapa: "visita"` sempre — o funil das etapas
 * seguintes (contactado → gd → membro → voluntário → servindo) é
 * só do painel do pastor (ver apps/pessoal/CLAUDE.md).
 *
 * Enquanto esse painel não existe, a líder "entrega" os contactos à
 * mão: um botão por lead abre o WhatsApp dela já com a mensagem para
 * o pastor pronta, incluindo um link direto para a conversa com o
 * próprio lead (wa.me) — não é um "cartão de contacto" nativo do
 * WhatsApp (isso só existe partilhando um contacto a sério da
 * agenda, uma app não consegue acionar isso à distância), mas
 * cumpre o mesmo objetivo: um toque abre a conversa certa.
 */
import { addDoc, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { dataPorExtenso, linkWhatsApp } from "@portal/shared/lib/data.js";
import { cContactos, cContacto, cGDs } from "./modelo";

// Número da líder para o pastor Jonathas — débito consciente: fixo no
// código por agora, não editável pela líder. Ver "Débitos conscientes"
// no CLAUDE.md desta base. Mudar aqui (e fazer deploy) se o número mudar.
export const WHATSAPP_PASTOR = "911969268";

/**
 * Geografia dos concelhos servidos — freguesias oficiais (pós-
 * reorganização de 2013, com a atualização de Matosinhos de 2025) e
 * coordenadas aproximadas, para o sugestor de GD ordenar por
 * distância (ver `gdMaisProximo` abaixo). Nunca texto livre no
 * select: é o que torna a distância calculável.
 *
 * Dois grupos, tratados de propósito com precisão diferente:
 *
 * - **Área metropolitana do Porto** (Porto/Maia/Matosinhos/VNG/
 *   Gondomar/Valongo): é onde ficam quase todos os GDs, por isso é
 *   onde a freguesia importa a sério — dentro do mesmo concelho, GDs
 *   diferentes podem estar a 2km ou a 8km (ex.: São Mamede de
 *   Infesta, em Matosinhos, fica mesmo ao lado do GD "São Mamede",
 *   bem mais perto do que o GD "Brito Capelo", que é noutra ponta do
 *   mesmo concelho — por isso cada freguesia tem a sua própria
 *   coordenada, não a do concelho).
 * - **Concelhos "remotos"** (Póvoa de Varzim, Vila do Conde,
 *   Barcelos, São João da Madeira, Lisboa, Sines): cada um destes
 *   concelhos já tem o "seu" GD lá mesmo, e o GD alternativo mais
 *   próximo fica sempre a dezenas ou centenas de km de distância —
 *   a diferença entre as freguesias do MESMO concelho (no máximo
 *   uma dezena de km) nunca muda qual GD é o mais perto. Por isso
 *   todas as freguesias de um concelho remoto partilham a coordenada
 *   do centro do concelho, em vez de 61 coordenadas só para Barcelos.
 */
const AREA_METROPOLITANA = {
  "Porto": [
    ["Aldoar, Foz do Douro e Nevogilde", 41.1571, -8.6667],
    ["Bonfim", 41.1516, -8.5975],
    ["Campanhã", 41.1490, -8.5780],
    ["Cedofeita, Santo Ildefonso, Sé, Miragaia, São Nicolau e Vitória", 41.1456, -8.6109],
    ["Lordelo do Ouro e Massarelos", 41.1502, -8.6425],
    ["Paranhos", 41.1699, -8.6106],
    ["Ramalde", 41.1706, -8.6427],
  ],
  "Maia": [
    ["Águas Santas", 41.2087, -8.5900],
    ["Castêlo da Maia", 41.2626, -8.6231],
    ["Cidade da Maia", 41.2370, -8.6150],
    ["Folgosa", 41.2280, -8.5650],
    ["Milheirós", 41.2680, -8.5950],
    ["Moreira", 41.2480, -8.6550],
    ["Nogueira e Silva Escura", 41.2150, -8.5800],
    ["Pedrouços", 41.2380, -8.6800],
    ["São Pedro Fins", 41.2650, -8.5700],
    ["Vila Nova da Telha", 41.2450, -8.6700],
  ],
  "Matosinhos": [
    ["Custoias", 41.2050, -8.6450],
    ["Guifões", 41.2050, -8.6700],
    ["Lavra", 41.2350, -8.7100],
    ["Leça da Palmeira", 41.2010, -8.7010],
    ["Leça do Balio", 41.2110, -8.6250],
    ["Matosinhos", 41.1830, -8.6930],
    ["Perafita", 41.2180, -8.6900],
    ["Santa Cruz do Bispo", 41.2250, -8.6350],
    ["São Mamede de Infesta", 41.1892, -8.6103],
    ["Senhora da Hora", 41.1780, -8.6420],
  ],
  "Vila Nova de Gaia": [
    ["Arcozelo", 41.0550, -8.6650],
    ["Avintes", 41.1100, -8.5650],
    ["Canelas", 41.0950, -8.6100],
    ["Canidelo", 41.1350, -8.6650],
    ["Grijó e Sermonde", 41.0450, -8.5950],
    ["Gulpilhares e Valadares", 41.0750, -8.6650],
    ["Madalena", 41.1150, -8.6250],
    ["Mafamude e Vilar do Paraíso", 41.1280, -8.6100],
    ["Oliveira do Douro", 41.1200, -8.5950],
    ["Pedroso e Seixezelo", 41.0700, -8.5550],
    ["Sandim, Olival, Lever e Crestuma", 41.0850, -8.5100],
    ["Santa Marinha e São Pedro da Afurada", 41.1290, -8.6280],
    ["São Félix da Marinha", 41.0350, -8.6450],
    ["Serzedo e Perosinho", 41.0600, -8.6350],
    ["Vilar de Andorinho", 41.1100, -8.5950],
  ],
  "Gondomar": [
    ["Baguim do Monte", 41.1650, -8.5550],
    ["Fânzeres e São Pedro da Cova", 41.1662, -8.5325],
    ["Foz do Sousa e Covelo", 41.1150, -8.5450],
    ["Gondomar (São Cosme), Valbom e Jovim", 41.1428, -8.5342],
    ["Lomba", 41.1250, -8.5100],
    ["Melres e Medas", 41.0850, -8.4950],
    ["Rio Tinto", 41.1800, -8.5700],
  ],
  "Valongo": [
    ["Alfena", 41.2280, -8.5100],
    ["Campo", 41.1900, -8.4850],
    ["Ermesinde", 41.1930, -8.5480],
    ["Sobrado", 41.2350, -8.4800],
    ["Valongo", 41.1875, -8.4993],
  ],
};

const CONCELHOS_REMOTOS = {
  "Póvoa de Varzim": {
    centro: [41.3818, -8.7658],
    freguesias: [
      "Aguçadoura", "Amorim", "Argivai", "Aver-o-Mar", "Balazar", "Beiriz",
      "Estela", "Laúndos", "Navais", "Póvoa de Varzim", "São Pedro de Rates", "Terroso",
    ],
  },
  "Vila do Conde": {
    centro: [41.3515, -8.7436],
    freguesias: [
      "Árvore", "Aveleda", "Azurara", "Bagunte, Ferreiró, Outeiro Maior e Parada",
      "Fajozes", "Fornelo e Vairão", "Gião", "Guilhabreu", "Junqueira", "Labruge",
      "Macieira da Maia", "Malta e Canidelo", "Mindelo", "Modivas", "Retorta e Tougues",
      "Rio Mau e Arcos", "Touguinha e Touguinhó", "Vila Chã", "Vila do Conde",
      "Vilar e Mosteiró", "Vilar do Pinheiro",
    ],
  },
  "Barcelos": {
    centro: [41.5388, -8.6151],
    freguesias: [
      "Abade de Neiva", "Aborim", "Adães", "Airó", "Aldreu", "Alheira e Igreja Nova",
      "Alvelos", "Alvito (São Pedro e São Martinho) e Couto", "Arcozelo", "Areias",
      "Areias de Vilar e Encourados", "Balugães", "Barcelinhos",
      "Barcelos, Vila Boa e Vila Frescainha (São Martinho e São Pedro)", "Barqueiros",
      "Cambeses", "Campo e Tamel (São Pedro Fins)", "Carapeços", "Carreira e Fonte Coberta",
      "Carvalhal", "Carvalhas", "Chorente, Góios, Courel, Pedra Furada e Gueral",
      "Cossourado", "Creixomil e Mariz", "Cristelo", "Durrães e Tregosa", "Fornelos",
      "Fragoso", "Galegos (Santa Maria)", "Galegos (São Martinho)", "Gamil e Midões",
      "Gilmonde", "Lama", "Lijó", "Macieira de Rates", "Manhente",
      "Martim", "Milhazes, Vilar de Figos e Faria", "Moure", "Negreiros e Chavão",
      "Oliveira", "Palme", "Panque", "Paradela", "Pereira", "Perelhal", "Pousa",
      "Quintiães e Aguiar", "Remelhe", "Roriz", "Santa Eugénia de Rio Covo",
      "Sequeade e Bastuço (São João e Santo Estêvão)", "Silva",
      "Silveiros e Rio Covo (Santa Eulália)", "Tamel (Santa Leocádia) e Vilar do Monte",
      "Tamel (São Veríssimo)", "Ucha", "Várzea",
      "Viatodos, Grimancelos e Minhotães e Monte de Fralães", "Vila Cova e Feitos", "Vila Seca",
    ],
  },
  "São João da Madeira": { centro: [40.8907, -8.4864], freguesias: ["São João da Madeira"] },
  "Lisboa": {
    centro: [38.7223, -9.1393],
    freguesias: [
      "Ajuda", "Alcântara", "Alvalade", "Areeiro", "Arroios", "Avenidas Novas", "Beato",
      "Belém", "Benfica", "Campo de Ourique", "Campolide", "Carnide", "Estrela", "Lumiar",
      "Marvila", "Misericórdia", "Olivais", "Parque das Nações", "Penha de França",
      "Santa Clara", "Santa Maria Maior", "Santo António", "São Domingos de Benfica", "São Vicente",
    ],
  },
  "Sines": { centro: [37.9564, -8.8647], freguesias: ["Sines", "Porto Covo"] },
};

export const FREGUESIAS_POR_CONCELHO = Object.fromEntries([
  ...Object.entries(AREA_METROPOLITANA).map(([concelho, lista]) => [concelho, lista.map(([f]) => f)]),
  ...Object.entries(CONCELHOS_REMOTOS).map(([concelho, { freguesias }]) => [concelho, freguesias]),
]);
export const CONCELHOS = Object.keys(FREGUESIAS_POR_CONCELHO);

/** `"concelho||freguesia"` → {lat,lng}. Ver o comentário grande acima
 *  sobre os dois níveis de precisão. */
export const COORDENADAS_FREGUESIA = Object.fromEntries([
  ...Object.entries(AREA_METROPOLITANA).flatMap(([concelho, lista]) =>
    lista.map(([freguesia, lat, lng]) => [`${concelho}||${freguesia}`, { lat, lng }])),
  ...Object.entries(CONCELHOS_REMOTOS).flatMap(([concelho, { centro: [lat, lng], freguesias }]) =>
    freguesias.map((freguesia) => [`${concelho}||${freguesia}`, { lat, lng }])),
]);

/** Haversine — distância em km entre dois pontos lat/lng. */
function distanciaKm(a, b) {
  const R = 6371;
  const paraRad = (g) => (g * Math.PI) / 180;
  const dLat = paraRad(b.lat - a.lat), dLng = paraRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(paraRad(a.lat)) * Math.cos(paraRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** O GD mais perto da freguesia, em linha reta — só entre os GDs que
 *  têm coordenadas gravadas (`lat`/`lng`); um GD criado à mão pela
 *  líder sem essa informação simplesmente não entra na conta, mas
 *  continua escolhível manualmente no select. null se a freguesia
 *  não tiver coordenada conhecida (concelho "Outro", ou freguesia
 *  ainda vazia) ou não houver nenhum GD com coordenadas. */
export function gdMaisProximo(concelho, freguesia, gds) {
  const origem = COORDENADAS_FREGUESIA[`${concelho}||${freguesia}`];
  if (!origem) return null;
  let escolhido = null, menor = Infinity;
  for (const g of gds) {
    if (g.lat == null || g.lng == null) continue;
    const d = distanciaKm(origem, { lat: g.lat, lng: g.lng });
    if (d < menor) { menor = d; escolhido = g; }
  }
  return escolhido;
}

/** Todos os contactos de um mês (`ano`/`mesIndex` como em
 *  `obterEventosDoMes`) — o filtro por culto específico é só cortar
 *  esta lista do lado do cliente pelo `eventoId` (ver Formulario.jsx),
 *  não vale a pena outra query só para isso. Mesmo truque de
 *  intervalo de `painel.js` (`>= 1º dia`, `< 1º dia do mês seguinte`),
 *  porque `eventoId` já é a data em "AAAA-MM-DD". */
export function ouvirContactosDoMes(ano, mesIndex, cb) {
  const inicio = `${ano}-${String(mesIndex + 1).padStart(2, "0")}-01`;
  const fim = new Date(Date.UTC(ano, mesIndex + 1, 1)).toISOString().slice(0, 10);
  const q = query(
    cContactos(),
    where("eventoId", ">=", inicio), where("eventoId", "<", fim),
    orderBy("eventoId"), orderBy("criadoEm", "desc"),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export function ouvirGDs(cb) {
  return onSnapshot(query(cGDs(), orderBy("nome")), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export const criarGD = (nome, regiao) => addDoc(cGDs(), { nome: nome.trim(), regiao: regiao.trim() });

/** Só avisa — nunca bloqueia o registo. Compara pelo mesmo formato
 *  normalizado que se grava (só dígitos), para "912 345 678" e
 *  "912345678" apanharem o mesmo duplicado. */
export async function verificarTelefoneDuplicado(telemovel) {
  const digitos = String(telemovel || "").replace(/\D/g, "");
  if (digitos.length < 9) return null;
  const snap = await getDocs(query(cContactos(), where("telemovelDigitos", "==", digitos), limit(1)));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function criarContacto({ nome, telemovel, email, concelho, freguesia, gdSugerido, eventoId, uid }) {
  const digitos = telemovel.replace(/\D/g, "");
  const ref = doc(cContactos());
  await setDoc(ref, {
    nome: nome.trim(), telemovel: telemovel.trim(), telemovelDigitos: digitos,
    email: email?.trim() || null,
    concelho, freguesia, gdSugerido: gdSugerido || null,
    eventoId, baseOrigemId: "pessoal", etapa: "visita",
    criadoPor: uid, criadoEm: serverTimestamp(),
    rgpd: { aceite: true, baseLegal: "consentimento", em: serverTimestamp() },
    arquivado: false, enviadoPastorEm: null,
  });
  return ref.id;
}

export const marcarEnviadoPastor = (id) => updateDoc(cContacto(id), { enviadoPastorEm: serverTimestamp() });

/** Corrige um contacto já guardado — mesmos campos do formulário de
 *  criação, exceto os automáticos (eventoId, etapa, RGPD…), que as
 *  regras nem deixam tocar. */
export async function atualizarContacto(id, { nome, telemovel, email, concelho, freguesia, gdSugerido }) {
  await updateDoc(cContacto(id), {
    nome: nome.trim(), telemovel: telemovel.trim(), telemovelDigitos: telemovel.replace(/\D/g, ""),
    email: email?.trim() || null,
    concelho, freguesia, gdSugerido: gdSugerido || null,
  });
}

/** "Excluir" é sempre arquivado:true, nunca um delete a sério —
 *  "nada é apagado, é desativado" (regra do repositório). As regras
 *  nem deixam apagar `contactos` pelo cliente. Sem UI para reverter
 *  por agora — reativar é mudar o campo direto no Firestore. */
export const arquivarContacto = (id) => updateDoc(cContacto(id), { arquivado: true });

/** A mensagem que a líder envia ao pastor — já com o link direto para
 *  a conversa do lead lá dentro (ver nota no topo do ficheiro). */
export function textoParaPastor(contacto, eventoId) {
  const linkLead = linkWhatsApp(contacto.telemovel);
  return [
    `Novo contacto — ${dataPorExtenso(eventoId)}`,
    `Nome: ${contacto.nome}`,
    `Telefone: ${contacto.telemovel}`,
    contacto.email ? `Email: ${contacto.email}` : null,
    linkLead ? `Falar com ${contacto.nome.split(" ")[0]}: ${linkLead}` : null,
    `Concelho: ${contacto.concelho} (${contacto.freguesia})`,
    `GD sugerido: ${contacto.gdSugerido || "—"}`,
  ].filter(Boolean).join("\n");
}

export const linkParaPastor = (contacto, eventoId) =>
  linkWhatsApp(WHATSAPP_PASTOR, textoParaPastor(contacto, eventoId));
