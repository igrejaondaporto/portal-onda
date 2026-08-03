// Nem pessoas nem funções guardam uma cor própria — deriva-se da posição,
// só para a grelha não ficar toda azul.
export const CORES = ["#0019BE", "#FF2E88", "#7B5CFF", "#00A88F", "#F5A300", "#0092D4"];
export const corPara = (i) => CORES[i % CORES.length];
