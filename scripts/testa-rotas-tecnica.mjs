/**
 * Testa chaveDoPath/PATH_POR_CHAVE (apps/tecnica/src/lib/rotas.js) —
 * sem Firestore, sem React, sem rede.
 *
 *   npm run teste:rotas
 */
import { chaveDoPath, PATH_POR_CHAVE } from "../apps/tecnica/src/lib/rotas.js";

let falhas = 0;
function conferir(nome, obtido, esperado) {
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado);
  if (a === b) { console.log(`  ✓ ${nome}`); return; }
  falhas++;
  console.log(`  ✗ ${nome}\n      esperado ${b}\n      obtido   ${a}`);
}

console.log("\nchaveDoPath");
conferir("cada caminho do menu volta à chave certa",
  Object.entries(PATH_POR_CHAVE).map(([chave, path]) => chaveDoPath(path) === chave).every(Boolean),
  true);
conferir("o path de Equipamentos usa o nome que a pessoa vê, não a chave interna",
  PATH_POR_CHAVE.inventario, "/equipamentos");
conferir("o endereço principal (\"/\") cai no Início",
  chaveDoPath("/"), "inicio");
conferir("um caminho desconhecido cai no Início, nunca em ecrã em branco",
  chaveDoPath("/isto-nao-existe"), "inicio");
conferir("caminho vazio também cai no Início",
  chaveDoPath(""), "inicio");

console.log(falhas ? `\n${falhas} falha(s)\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
