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
export const CANAIS_CHAMADAS = [
  { id: "baby", oid: "c7ec7b48c05", rotulo: "Baby", overlay: "BABY", variavel: "baby", prefixo: "BABY: ", campo: "Nome da criança", exemplo: "Eloa", maiusculas: false, cor: "var(--violeta)" },
  { id: "fun", oid: "8dfa868047d", rotulo: "Fun", overlay: "Z_FUN", variavel: "fun", prefixo: "FUN: ", campo: "Nome da criança", exemplo: "Débora", maiusculas: false, cor: "var(--ciano)" },
  { id: "junior", oid: "b239c603705", rotulo: "Júnior", overlay: "Z_JUNIOR", variavel: "junior", prefixo: "JÚNIOR: ", campo: "Nome da criança", exemplo: "Arthur", maiusculas: false, cor: "var(--verde)" },
  { id: "carro", oid: "bc2dfa6c39e", rotulo: "Carro", overlay: "Z_CARRO", variavel: "carro", prefixo: "CARRO: ", campo: "Carro e matrícula", exemplo: "VW Taigo AO96GD", maiusculas: true, cor: "var(--laranja)" },
];
export const PADRAO_FREESHOW = "https://fs.painelonda.pt";
export const INTERVALO_SONDA_MS = 1500; // de quanto em quanto tempo perguntar ao FreeShow
