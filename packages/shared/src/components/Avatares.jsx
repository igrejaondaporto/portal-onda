import Avatar from "./Avatar";

export default function Avatares({ pessoas, tamanho = 30, fonte = 12 }) {
  if (!pessoas.length) return <span className="tag cinz">livre</span>;
  return (
    <span className="dupla">
      {pessoas.map((p) => (
        <Avatar key={p.id} pessoa={p} tamanho={tamanho} fonte={fonte} />
      ))}
    </span>
  );
}
