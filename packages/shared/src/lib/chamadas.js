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
import { collection, addDoc, onSnapshot, query, orderBy, limit } from "firebase/firestore";
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
  // Cores das três salas = as da Base Kinder (Baby roxo, Fun amarelo,
  // Júnior azul — pedido do Kinder, 2026-09; ver apps/kinder/src/styles/
  // kinder.css). `corTexto` só onde o branco não se lê por cima.
  { id: "fun", oid: "62628c23d38", rotulo: "Fun", overlay: "Z_FUN", variavel: "fun", prefixo: "FUN: ", campo: "Nome da criança", exemplo: "Débora", maiusculas: false, cor: "#f5c400", corTexto: "#1c1c1c" },
  { id: "junior", oid: "160e1f2472f", rotulo: "Júnior", overlay: "Z_JUNIOR", variavel: "junior", prefixo: "JÚNIOR: ", campo: "Nome da criança", exemplo: "Arthur", maiusculas: false, cor: "#1e7bf0" },
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
 * Uma SUBCOLEÇÃO por canal, por dia (`chamadas/{AAAA-MM-DD}/canais/
 * {canalId}/itens/{auto-id}`) — reinicia sozinha a cada dia, sem
 * precisar de limpar nada. Leitura pública (é um telão, não tem dado
 * sensível nenhum); escrita exige sessão — PIN normal na Técnica,
 * sessão anónima no Kinder (kiosk sem login, ver
 * apps/kinder/src/App.jsx) — mesmo padrão de `progressoBases` no
 * firestore.rules.
 *
 * Uma chamada = um documento novo (`addDoc`), não uma entrada dentro
 * de um array de um documento só — passou por duas versões antes
 * desta: primeiro `runTransaction` (lia o documento inteiro, cortava
 * para os últimos N, reescrevia), depois `arrayUnion` (escrevia
 * direto, sem ler primeiro). Testei as duas ao vivo com chamadas
 * seguidas rápidas e a demora entre uma chamada e a seguinte
 * aparecer no histórico era sempre ~1s, crescendo por chamada — a
 * mesma demora com as duas formas, incluindo esta (subcoleção,
 * escritas em paralelo, sem fila nenhuma entre documentos
 * diferentes). Ou seja, **não era o array vs. transação** — é o
 * tempo real de ida e volta ao Firestore (mais visível em wifi mais
 * lenta, como a da igreja, do que na rede de quem testa a
 * programar). Fica esta versão de qualquer forma, por ser a correta
 * (sem fila entre documentos diferentes, sem ler antes de escrever,
 * `limit` a fazer o corte em vez de cortar à mão) — mas quem resolve
 * a demora *sentida* é o estado otimista em PainelChamadas.jsx
 * (`chamar`), que mostra a chamada na hora, sem esperar pelo
 * Firestore confirmar. Só mostra os últimos 20 (pedido do líder). */
export const HISTORICO_LIMITE = 20;
const cItensCanal = (canalId) => collection(db, `chamadas/${hojeISO()}/canais/${canalId}/itens`);

/** Ouve um ou vários canais ao mesmo tempo (a Técnica mistura todos
 *  num histórico só; o Kinder tranca cada aparelho num canal, mas
 *  ouve todos — ver canaisHistorico em PainelChamadas.jsx) e devolve
 *  a lista já combinada, ordenada por mais recente e cortada nos
 *  últimos 20. */
export function ouvirHistoricoChamadas(canaisIds, cb) {
  const porCanal = {};
  function emitir() {
    const combinado = Object.values(porCanal).flat()
      .sort((a, b) => b.quando - a.quando)
      .slice(0, HISTORICO_LIMITE);
    cb(combinado);
  }
  const paragens = canaisIds.map((id) => {
    const q = query(cItensCanal(id), orderBy("quando", "desc"), limit(HISTORICO_LIMITE));
    return onSnapshot(q, (snap) => {
      porCanal[id] = snap.docs.map((d) => d.data());
      emitir();
    });
  });
  return () => paragens.forEach((p) => p());
}

/** Regista uma chamada — um documento novo na subcoleção do canal,
 *  ver comentário grande acima do porquê disto em vez de um array
 *  num documento só. */
export function registarChamada(canalId, txt, quando) {
  return addDoc(cItensCanal(canalId), { canalId, txt, quando });
}
