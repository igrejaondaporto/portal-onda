/** Toggle de vários ministérios ao mesmo tempo — a Wiki não é
 *  "de um ministério só" como a checklist, um artigo pode servir a
 *  mais do que um. Nenhum selecionado = geral, aparece para todos. */
export default function SeletorMinisterios({ ministerios, selecionados, onToggle }) {
  if (!ministerios?.length) return null;
  return (
    <div className="subtabs">
      {ministerios.map((m) => (
        <button key={m.id} data-on={selecionados.includes(m.id) ? 1 : 0} onClick={() => onToggle(m.id)}>
          {m.nome}
        </button>
      ))}
    </div>
  );
}
