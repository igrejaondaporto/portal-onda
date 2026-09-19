/**
 * Recados do Painel Pastoral para esta base.
 *
 * Partilhado porque é literalmente igual nas dez bases: nenhuma tem
 * regra de negócio própria sobre isto — chega um recado, o líder lê,
 * dispensa. Pôr uma cópia em cada `apps/*` seria dez sítios para
 * corrigir a mesma coisa.
 *
 * De ida, sem resposta e sem estado (decisão do dono do produto,
 * 2026-09). O pastor escreve no painel, aparece aqui, e acaba. Não é
 * uma `solicitacao` — essa tem prazo, atribuição, transferência e
 * histórico de estados, e nada disso se aplica a "no próximo domingo
 * chegamos às 9h".
 *
 * Desde 2026-09 o recado também chega por push a quem a tiver ligado
 * (`notificarRecado`, functions/notificacoes.js). Este cartão continua
 * a ser o caminho garantido: nem toda a gente ativa notificações, e no
 * iPhone só funcionam com a app instalada no ecrã principal.
 */
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db, BASE_ID } from "./firebase.js";

/**
 * Os recados por dispensar desta base, ao vivo.
 *
 * A query filtra só por `baseId` — `dispensado` fica filtrado no
 * cliente de propósito: dois campos na query exigiriam um índice
 * composto novo em `firestore.indexes.json` (ficheiro partilhado, com
 * deploy próprio) para poupar a leitura de meia dúzia de documentos.
 * Mesmo padrão do `ouvirAvisos` da Louvor, e pelo mesmo motivo.
 *
 * Urgentes primeiro, depois os mais recentes. A ordenação é no cliente
 * pela mesma razão.
 */
export function ouvirRecados(cb) {
  const q = query(collection(db, "recados"), where("baseId", "==", BASE_ID));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.dispensado !== true)
        .sort((a, b) => {
          if (!!a.urgente !== !!b.urgente) return a.urgente ? -1 : 1;
          return (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0);
        }));
    },
    // uma base cuja sessão ainda não tem a claim (ou um erro de rede)
    // não pode partir o Início inteiro — sem recados é o estado normal
    // na esmagadora maioria dos dias
    () => cb([]),
  );
}

/** Dispensar é escrita direta — as regras só deixam o líder da base, e
 *  só mexer nestes dois campos (um líder não pode reescrever o texto
 *  do recado que recebeu). Não vale uma ida ao servidor para pôr um
 *  booleano. Nunca se apaga: o recado fica gravado, é o painel que
 *  deixa de o contar como "por ler". */
export const dispensarRecado = (id) =>
  updateDoc(doc(db, "recados", id), { dispensado: true, dispensadoEm: serverTimestamp() });
