const ICO = {
  inicio: '<path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  escala: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  funcoes: '<path d="M10 6h11M10 12h11M10 18h11"/><path d="M3 6.2 4.3 7.5 6.8 4.8M3 12.2 4.3 13.5 6.8 10.8M3 18.2 4.3 19.5 6.8 16.8"/>',
  culto: '<path d="M12 3v6M9 6h6M5 21V11l7-5 7 5v10"/><path d="M9 21v-6h6v6"/>',
  inventario: '<path d="M21 8.5 12 3.5 3 8.5v7L12 20.5l9-5z"/><path d="M3 8.5 12 13.5l9-5M12 13.5v7"/>',
  // papel com caneta — Formulário (hoje só a Pessoal, disponível para
  // qualquer base futura com o mesmo separador)
  formulario: '<path d="m18 5-2.414-2.414A2 2 0 0 0 14.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2"/><path d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/><path d="M8 18h1"/>',
};

// [chave, texto] — cada app passa as suas próprias abas por prop;
// isto é só o valor por omissão, que é o menu de hoje da Apoio.
const ITENS_PADRAO = [
  ["inicio", "Início"],
  ["escala", "Escala"],
  ["funcoes", "Funções"],
  ["culto", "Culto"],
  ["inventario", "Inventário"],
];

function Icone({ chave, svg }) {
  return (
    <svg
      viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: svg ?? ICO[chave] }}
    />
  );
}

/** Fica visível mesmo dentro do Painel do líder — só que sem nada
 *  aceso, porque o Painel não é um dos separadores.
 *  `itens`: [[chave, texto, svg?]] — svg opcional, para bases com
 *  ícones que não existem no ICO padrão (ex.: Equipamentos, Wiki). */
export default function NavBar({ pagina, onIr, itens = ITENS_PADRAO }) {
  return (
    <nav className="navb on" style={{ gridTemplateColumns: `repeat(${itens.length}, 1fr)` }}>
      {itens.map(([k, t, svg]) => (
        <button key={k} data-on={pagina === k ? 1 : 0} data-tour={`nav-${k}`} onClick={() => onIr(k)}>
          <Icone chave={k} svg={svg} />
          {t}
        </button>
      ))}
    </nav>
  );
}
