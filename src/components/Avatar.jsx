export default function Avatar({ pessoa, tamanho = 42, fonte = 16 }) {
  if (!pessoa) return null;
  const estilo = pessoa.foto
    ? { width: tamanho, height: tamanho, fontSize: fonte, backgroundImage: `url(${pessoa.foto})` }
    : { width: tamanho, height: tamanho, fontSize: fonte, background: pessoa.cor || "#0019BE" };
  return (
    <span className={`av${pessoa.foto ? " avfoto" : ""}`} style={estilo}>
      {pessoa.foto ? "" : pessoa.nome?.[0]}
    </span>
  );
}
