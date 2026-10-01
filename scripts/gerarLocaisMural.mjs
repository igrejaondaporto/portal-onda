#!/usr/bin/env node
/**
 * Gera apps/mural/src/lib/portugal.json — distritos → concelhos →
 * freguesias de Portugal inteiro, para o Publicar/Editar do Mural (2026-10,
 * pedido: "na lista de cidades, a lista completa: primeiro o distrito,
 * depois as cidades desse distrito e depois as freguesias").
 *
 * Fonte: geoapi.pt (dados da CAOP da DGT, já com a desagregação de
 * freguesias de 2025 — 308 concelhos, 3259 freguesias). Não corre no
 * build: o JSON fica no repositório e só se volta a gerar quando a CAOP
 * mudar. `node scripts/gerarLocaisMural.mjs`
 *
 * - O distrito sai dos 2 primeiros dígitos do código do concelho (DTMN);
 *   as ilhas juntam-se em "Região Autónoma da Madeira" (31–32) e
 *   "Região Autónoma dos Açores" (41–49).
 * - "União das freguesias de X e Y" fica só "X e Y" (como na Pessoal):
 *   numa lista de 30 opções, o prefixo repetido só atrapalha.
 * - Tudo por ordem alfabética portuguesa.
 */
import { writeFileSync } from "node:fs";

const DISTRITOS = {
  "01": "Aveiro", "02": "Beja", "03": "Braga", "04": "Bragança", "05": "Castelo Branco",
  "06": "Coimbra", "07": "Évora", "08": "Faro", "09": "Guarda", "10": "Leiria",
  "11": "Lisboa", "12": "Portalegre", "13": "Porto", "14": "Santarém", "15": "Setúbal",
  "16": "Viana do Castelo", "17": "Vila Real", "18": "Viseu",
};
const distritoDe = (dtmn) => {
  const dt = dtmn.slice(0, 2);
  if (dt.startsWith("3")) return "Região Autónoma da Madeira";
  if (dt.startsWith("4")) return "Região Autónoma dos Açores";
  return DISTRITOS[dt];
};
const curto = (f) => f.replace(/^União das freguesias (de|do|da|dos|das) /, "");
const ordem = (a, b) => a.localeCompare(b, "pt");

const r = await fetch("https://geoapi.pt/municipios/freguesias?json=1");
if (!r.ok) throw new Error(`geoapi.pt respondeu ${r.status}`);
const municipios = await r.json();

const porDistrito = {};
for (const m of municipios) {
  const d = distritoDe(m.dtmn);
  if (!d) throw new Error(`Distrito desconhecido para ${m.nome} (${m.dtmn})`);
  (porDistrito[d] ||= []).push({ nome: m.nome, freguesias: m.freguesias.map(curto).sort(ordem) });
}
const distritos = Object.keys(porDistrito).sort(ordem).map((nome) => ({
  nome,
  concelhos: porDistrito[nome].sort((a, b) => ordem(a.nome, b.nome)),
}));

const total = distritos.reduce((t, d) => t + d.concelhos.reduce((s, c) => s + c.freguesias.length, 0), 0);
const destino = new URL("../apps/mural/src/lib/portugal.json", import.meta.url);
writeFileSync(destino, JSON.stringify(distritos) + "\n");
console.log(`${distritos.length} distritos, ${municipios.length} concelhos, ${total} freguesias → ${destino.pathname}`);
