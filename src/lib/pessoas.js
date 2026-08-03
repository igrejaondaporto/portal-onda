/**
 * Dados do ecrã de entrada: pessoas ativas da base + cabeçalho.
 * Vem da Cloud Function `dadosEntrada`, não de leitura direta ao
 * Firestore — antes de autenticar, as regras não deixam ler nada,
 * e é assim que tem de ser (ver firestore.rules).
 * Cor é derivada no cliente (a base não guarda "cor" por pessoa).
 */
import { chamar } from "./firebase";

const CORES = ["#0019BE", "#FF2E88", "#7B5CFF", "#00A88F", "#F5A300", "#0092D4"];

export async function obterDadosEntrada(baseId) {
  const { data } = await chamar("dadosEntrada")({ baseId });
  return {
    base: data.base,
    pessoas: data.pessoas.map((p, i) => ({ ...p, cor: CORES[i % CORES.length] })),
  };
}
