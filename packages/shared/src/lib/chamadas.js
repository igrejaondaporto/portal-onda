/**
 * Canais do Kinder — chamar uma criança ou uma matrícula para a
 * projeção via FreeShow (fs.painelonda.pt). Ligação direta do browser,
 * sem passar pelas Cloud Functions: aqui é escrita imediata no
 * FreeShow (change_variable + overlay), não leitura para o Firestore
 * (ver functions/freeshow.js, que é uma coisa diferente).
 *
 * `id` é só desta app (rótulo, estação a escolher no kinder.igrejaonda.pt).
 * `oid`/`overlay`/`variavel` são os identificadores REAIS do projeto do
 * FreeShow da igreja — não mudar sem confirmar com quem mexe lá.
 *
 * "Kinder" NÃO é uma categoria — é o nome da base/ministério inteiro
 * (o título da app, "Chamadas Kinder"). As categorias, por baixo dele,
 * são só Baby, Fun, Júnior e Carro — não há canal "kinder" nenhum.
 */
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { db } from "./firebase.js";
import { hojeISO } from "./data.js";

/* `oid` de "fun" e "junior" estavam errados desde sempre (troca/typo
 * na altura em que este catálogo foi escrito à mão) — nunca dava para
 * apanhar isso sem o túnel do FreeShow ligado a sério (fs.painelonda.pt
 * ficou fora do ar até 2026-09-07). Confirmados ao vivo, contra o
 * FreeShow real: `clear_overlays` + `name_select_overlay` por overlay,
 * lendo o id que `get_output` devolve a seguir. Baby e Carro já
 * batiam certo. */
export const CANAIS_CHAMADAS = [
  { id: "baby", oid: "c7ec7b48c05", rotulo: "Baby", overlay: "BABY", variavel: "baby", prefixo: "BABY: ", campo: "Nome da criança", exemplo: "Eloa", maiusculas: false, cor: "var(--violeta)" },
  { id: "fun", oid: "62628c23d38", rotulo: "Fun", overlay: "Z_FUN", variavel: "fun", prefixo: "FUN: ", campo: "Nome da criança", exemplo: "Débora", maiusculas: false, cor: "var(--ciano)" },
  { id: "junior", oid: "160e1f2472f", rotulo: "Júnior", overlay: "Z_JUNIOR", variavel: "junior", prefixo: "JÚNIOR: ", campo: "Nome da criança", exemplo: "Arthur", maiusculas: false, cor: "var(--verde)" },
  { id: "carro", oid: "bc2dfa6c39e", rotulo: "Carro", overlay: "Z_CARRO", variavel: "carro", prefixo: "CARRO: ", campo: "Carro e matrícula", exemplo: "VW Taigo AO96GD", maiusculas: true, cor: "var(--laranja)" },
];
export const PADRAO_FREESHOW = "https://fs.painelonda.pt";
export const INTERVALO_SONDA_MS = 1500; // de quanto em quanto tempo perguntar ao FreeShow

/**
 * Histórico do dia, no Firestore — antes vivia só em useState do
 * PainelChamadas, por isso um telemóvel diferente (ou o mesmo depois
 * de recarregar) não via nada do que já tinha sido chamado (pedido
 * do líder do Kinder, 2026-09: "em QUALQUER celular, ver todo o
 * histórico do dia"). "No ar agora" NÃO precisa disto — já é a
 * verdade partilhada: cada aparelho pergunta diretamente ao FreeShow
 * (ver `conectar`/`perguntar` em PainelChamadas.jsx), a mesma fonte
 * para todos, sem depender de nenhum aparelho em concreto.
 *
 * Um documento por canal, por dia (`chamadas/{AAAA-MM-DD}/canais/
 * {canalId}`) — reinicia sozinho a cada dia, sem precisar de limpar
 * nada. Leitura pública (é um telão, não tem dado sensível nenhum);
 * escrita exige sessão — PIN normal na Técnica, sessão anónima no
 * Kinder (kiosk sem login, ver apps/kinder/src/App.jsx) — mesmo
 * padrão de `progressoBases` no firestore.rules.
 */
const HISTORICO_MAX = 15;
const refHistoricoCanal = (canalId) => doc(db, `chamadas/${hojeISO()}/canais/${canalId}`);

/** Ouve um ou vários canais ao mesmo tempo (a Técnica mistura todos
 *  num histórico só; o Kinder tranca cada aparelho num canal) e
 *  devolve a lista já combinada e ordenada por mais recente. */
export function ouvirHistoricoChamadas(canaisIds, cb) {
  const porCanal = {};
  function emitir() {
    const combinado = Object.values(porCanal).flat()
      .sort((a, b) => b.quando - a.quando)
      .slice(0, HISTORICO_MAX);
    cb(combinado);
  }
  const paragens = canaisIds.map((id) =>
    onSnapshot(refHistoricoCanal(id), (s) => {
      porCanal[id] = (s.exists() ? s.data().historico : []) || [];
      emitir();
    }),
  );
  return () => paragens.forEach((p) => p());
}

/** Regista uma chamada no histórico partilhado — transação (não
 *  confia no `historico` já carregado no cliente, que pode estar
 *  desatualizado se outro aparelho acabou de chamar entretanto) que
 *  lê o documento fresco, tira duplicados do mesmo texto no mesmo
 *  canal e mantém só os mais recentes. */
export function registarChamada(canalId, txt, quando) {
  const ref = refHistoricoCanal(canalId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const atual = (snap.exists() ? snap.data().historico : []) || [];
    const novo = [
      { canalId, txt, quando },
      ...atual.filter((h) => !(h.canalId === canalId && h.txt === txt)),
    ].slice(0, HISTORICO_MAX);
    tx.set(ref, { historico: novo }, { merge: true });
  });
}

