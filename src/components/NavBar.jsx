const ICO = {
  inicio: '<path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  escala: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  funcoes: '<path d="M10 6h11M10 12h11M10 18h11"/><path d="M3 6.2 4.3 7.5 6.8 4.8M3 12.2 4.3 13.5 6.8 10.8M3 18.2 4.3 19.5 6.8 16.8"/>',
};

const ITENS = [
  ["inicio", "Início"],
  ["escala", "Escala"],
  ["funcoes", "Funções"],
];

function Icone({ chave }) {
  return (
    <svg
      viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICO[chave] }}
    />
  );
}

/** Fica visível mesmo dentro do Painel do líder — só que sem nada
 *  aceso, porque o Painel não é um dos separadores. */
export default function NavBar({ pagina, onIr }) {
  return (
    <nav className="navb on" style={{ gridTemplateColumns: `repeat(${ITENS.length}, 1fr)` }}>
      {ITENS.map(([k, t]) => (
        <button key={k} data-on={pagina === k ? 1 : 0} onClick={() => onIr(k)}>
          <Icone chave={k} />
          {t}
        </button>
      ))}
    </nav>
  );
}
