import { useEffect, useState } from "react";

/**
 * Distritos → concelhos ("cidades") → freguesias de Portugal inteiro, para
 * o Publicar e o Editar (2026-10, pedido: "na lista de cidades, a lista
 * completa: primeiro o distrito, depois as cidades desse distrito e depois
 * as freguesias"). Antes eram só os 12 concelhos onde há GDs.
 *
 * Os dados vivem em `portugal.json` (308 concelhos, 3259 freguesias, já
 * com a desagregação de 2025), gerado por `scripts/gerarLocaisMural.mjs`
 * a partir da CAOP. Carrega-se à parte (`import()` dinâmico) e só quando
 * se abre o Publicar/Editar: quem só vê o mural não descarrega a lista.
 *
 * O anúncio continua a gravar só `cidade` e `freguesia` (e a `regiao`
 * antiga, que `criarAnuncio` ainda exige). O distrito é só o primeiro
 * passo da escolha: deduz-se da cidade (nomes de concelho são únicos).
 * O filtro "Onde" do mural continua a sair dos anúncios, não desta lista.
 */
let aCaminho = null;
export function carregarLocais() {
  aCaminho ??= import("./portugal.json").then(({ default: distritos }) => {
    const concelhos = {};
    for (const d of distritos) for (const c of d.concelhos) concelhos[c.nome] = { distrito: d.nome, freguesias: c.freguesias };
    return { distritos, concelhos };
  });
  return aCaminho;
}

/** A lista, ou null enquanto carrega. */
export function useLocais() {
  const [locais, setLocais] = useState(null);
  useEffect(() => {
    let vivo = true;
    carregarLocais().then((l) => vivo && setLocais(l));
    return () => { vivo = false; };
  }, []);
  return locais;
}

/** Região antiga (norte/lisboa/sines) a partir do lugar escolhido — só
 *  porque functions/mural.js ainda a exige; os anúncios novos filtram-se
 *  pela cidade. */
export function regiaoDe(distrito, cidade) {
  if (cidade === "Sines") return "sines";
  if (distrito === "Lisboa" || distrito === "Setúbal") return "lisboa";
  return "norte";
}
