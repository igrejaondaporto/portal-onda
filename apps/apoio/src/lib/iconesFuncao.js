/** Ícones das funções — os mesmos traços do protótipo, aqui como módulo. */
export const ICF = {
  porta: '<path d="M5 21h14"/><path d="M7 21V4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5V21"/><circle cx="14" cy="12.5" r=".9"/>',
  gota: '<path d="M12 3.2c3.1 3.7 5.6 6.5 5.6 9.5a5.6 5.6 0 1 1-11.2 0c0-3 2.5-5.8 5.6-9.5z"/>',
  mopa: '<path d="M12 3v8"/><path d="M8 11h8l-1 6.6a2 2 0 0 1-2 1.7h-2a2 2 0 0 1-2-1.7z"/><path d="M9.6 19.3V21M14.4 19.3V21"/>',
  cadeiras: '<rect x="3" y="9.2" width="18" height="6.8" rx="2"/><path d="M5.6 9.2V6.6A2.6 2.6 0 0 1 8.2 4h7.6a2.6 2.6 0 0 1 2.6 2.6v2.6"/><path d="M6 16v3.4M18 16v3.4"/>',
  coracao: '<path d="M12 20.2S3.8 15.4 3.8 9.7A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.2 2.7c0 5.7-8.2 10.5-8.2 10.5z"/>',
  chavena: '<path d="M4 8.2h13v5.9a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 9.7h1.8a2.7 2.7 0 0 1 0 5.4H17"/><path d="M7.5 2.6v2.8M11.5 2.6v2.8"/>',
  spray: '<rect x="6.8" y="8.4" width="7.6" height="12.4" rx="2"/><path d="M9 8.4V5.9A1.5 1.5 0 0 1 10.5 4.4h1.4"/><path d="M18 5.4h.01M20.6 7.9h.01M18 10.4h.01M20.6 12.9h.01"/>',
  ronda: '<path d="M20.4 12a8.4 8.4 0 1 1-2.5-6"/><path d="M20.4 4.6v5.5h-5.5"/>',
  pessoas: '<circle cx="9" cy="8" r="3.2"/><path d="M2.9 20a6.1 6.1 0 0 1 12.2 0"/><path d="M16.4 5.3a3.2 3.2 0 0 1 0 5.8"/><path d="M17.9 14.4a6.1 6.1 0 0 1 3.2 5.6"/>',
  caixa: '<path d="M21 8.5 12 3.5 3 8.5v7L12 20.5l9-5z"/><path d="M3 8.5 12 13.5l9-5M12 13.5v7"/>',
  lixo: '<path d="M4 6.5h16"/><path d="M9.6 6.5V4.9a1.3 1.3 0 0 1 1.3-1.3h2.2a1.3 1.3 0 0 1 1.3 1.3v1.6"/><path d="M6.3 6.5 7.1 19.3a1.8 1.8 0 0 0 1.8 1.7h6.2a1.8 1.8 0 0 0 1.8-1.7l.8-12.8"/><path d="M10.5 10.4v6.2M13.5 10.4v6.2"/>',
  arrumar: '<path d="M20.5 11.4V19a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9.6"/><path d="M8 11.6l3.2 3.2L21 5"/>',
  brilho: '<path d="M12 3.2l1.9 5.2 5.2 1.9-5.2 1.9L12 17.4l-1.9-5.2L4.9 10.3l5.2-1.9z"/><path d="M18.4 15.6l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  janela: '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="2.2"/><path d="M12 3.4v17.2M3.4 12h17.2"/>',
  som: '<path d="M11 5.5 6.5 9.2H3.4v5.6h3.1L11 18.5z"/><path d="M15.2 9a4.2 4.2 0 0 1 0 6"/><path d="M18 6.2a8 8 0 0 1 0 11.6"/>',
  relogio: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2"/>',
};

export const ICF_NOMES = {
  porta: "Porta", gota: "Água", mopa: "Mopa", cadeiras: "Cadeiras", coracao: "Coração",
  chavena: "Chávena", spray: "Spray", ronda: "Ronda", pessoas: "Pessoas", caixa: "Caixa",
  lixo: "Lixo", arrumar: "Arrumar", brilho: "Brilho", janela: "Janela", som: "Som", relogio: "Relógio",
};

export function svgFn(chave, tamanho = 20) {
  return `<svg viewBox="0 0 24 24" width="${tamanho}" height="${tamanho}" fill="none"
 stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICF[chave] || ICF.brilho}</svg>`;
}
