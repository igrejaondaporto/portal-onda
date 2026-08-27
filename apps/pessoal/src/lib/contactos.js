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

/** Concelhos servidos + freguesias oficiais de cada um (pós-reorganização
 *  administrativa — 2013, com a atualização de Matosinhos de 2025).
 *  Select, nunca texto livre: é o que torna possível o futuro sugestor
 *  de GD por zona. */
export const FREGUESIAS_POR_CONCELHO = {
  "Porto": [
    "Aldoar, Foz do Douro e Nevogilde", "Bonfim", "Campanhã",
    "Cedofeita, Santo Ildefonso, Sé, Miragaia, São Nicolau e Vitória",
    "Lordelo do Ouro e Massarelos", "Paranhos", "Ramalde",
  ],
  "Maia": [
    "Águas Santas", "Castêlo da Maia", "Cidade da Maia", "Folgosa",
    "Milheirós", "Moreira", "Nogueira e Silva Escura", "Pedrouços",
    "São Pedro Fins", "Vila Nova da Telha",
  ],
  "Matosinhos": [
    "Custoias", "Guifões", "Lavra", "Leça da Palmeira", "Leça do Balio",
    "Matosinhos", "Perafita", "Santa Cruz do Bispo", "São Mamede de Infesta",
    "Senhora da Hora",
  ],
  "Vila Nova de Gaia": [
    "Arcozelo", "Avintes", "Canelas", "Canidelo", "Grijó e Sermonde",
    "Gulpilhares e Valadares", "Madalena", "Mafamude e Vilar do Paraíso",
    "Oliveira do Douro", "Pedroso e Seixezelo", "Sandim, Olival, Lever e Crestuma",
    "Santa Marinha e São Pedro da Afurada", "São Félix da Marinha",
    "Serzedo e Perosinho", "Vilar de Andorinho",
  ],
  "Gondomar": [
    "Baguim do Monte", "Fânzeres e São Pedro da Cova", "Foz do Sousa e Covelo",
    "Gondomar (São Cosme), Valbom e Jovim", "Lomba", "Melres e Medas", "Rio Tinto",
  ],
  "Valongo": ["Alfena", "Campo", "Ermesinde", "Sobrado", "Valongo"],
};
export const CONCELHOS = Object.keys(FREGUESIAS_POR_CONCELHO);

export function ouvirContactosDoEvento(eventoId, cb) {
  if (!eventoId) return () => {};
  const q = query(cContactos(), where("eventoId", "==", eventoId), orderBy("criadoEm", "desc"));
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

export async function criarContacto({ nome, telemovel, concelho, freguesia, gdSugerido, eventoId, uid }) {
  const digitos = telemovel.replace(/\D/g, "");
  const ref = doc(cContactos());
  await setDoc(ref, {
    nome: nome.trim(), telemovel: telemovel.trim(), telemovelDigitos: digitos,
    concelho, freguesia, gdSugerido: gdSugerido || null,
    eventoId, baseOrigemId: "pessoal", etapa: "visita",
    criadoPor: uid, criadoEm: serverTimestamp(),
    rgpd: { aceite: true, baseLegal: "consentimento", em: serverTimestamp() },
    arquivado: false, enviadoPastorEm: null,
  });
  return ref.id;
}

export const marcarEnviadoPastor = (id) => updateDoc(cContacto(id), { enviadoPastorEm: serverTimestamp() });

/** A mensagem que a líder envia ao pastor — já com o link direto para
 *  a conversa do lead lá dentro (ver nota no topo do ficheiro). */
export function textoParaPastor(contacto, eventoId) {
  const linkLead = linkWhatsApp(contacto.telemovel);
  return [
    `Novo contacto — ${dataPorExtenso(eventoId)}`,
    `Nome: ${contacto.nome}`,
    `Telefone: ${contacto.telemovel}`,
    linkLead ? `Falar com ${contacto.nome.split(" ")[0]}: ${linkLead}` : null,
    `Concelho: ${contacto.concelho} (${contacto.freguesia})`,
    `GD sugerido: ${contacto.gdSugerido || "—"}`,
  ].filter(Boolean).join("\n");
}

export const linkParaPastor = (contacto, eventoId) =>
  linkWhatsApp(WHATSAPP_PASTOR, textoParaPastor(contacto, eventoId));
