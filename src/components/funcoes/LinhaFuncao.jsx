import Bola from "../Bola";
import Avatares from "../Avatares";

export default function LinhaFuncao({ f, ids, voluntarios, feita, aberta, pode, souLiderBase, uid, nomeLiderBase, onAbrir, onEscolher, onEditar }) {
  const pessoas = ids.map((id) => voluntarios.find((p) => p.id === id)).filter(Boolean);
  const nomes = pessoas.map((p) => p.nome).join(" e ");

  return (
    <div
      className={`linha${feita ? " feita" : ""}`}
      style={{ alignItems: "flex-start", cursor: "pointer" }}
      onClick={onAbrir}
    >
      <Bola funcao={f} />
      <div style={{ flex: 1 }}>
        <p className="nmt">{f.nome}</p>
        <p className="ds">
          {nomes ? (
            <>
              <b style={{ color: "var(--azul)" }}>{nomes}</b>
              {ids.includes(uid) ? " · tu" : ""}
            </>
          ) : (
            "Por atribuir"
          )}
        </p>
        {aberta && (
          <div className="aberto">
            {f.foto && <img src={f.foto} className="fotofn" alt="" />}
            <p style={{ marginTop: f.foto ? 8 : 2 }}>
              {f.descricao || `Sem descrição. O ${nomeLiderBase} preenche isto no Painel.`}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              {pode && (
                <button className="btn" style={{ padding: "10px 17px", fontSize: 13 }} onClick={(e) => { e.stopPropagation(); onEscolher(); }}>
                  Quem faz
                </button>
              )}
              {souLiderBase && (
                <button className="btn sec" style={{ padding: "10px 17px", fontSize: 13 }} onClick={(e) => { e.stopPropagation(); onEditar(); }}>
                  Editar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <Avatares pessoas={pessoas} tamanho={32} fonte={13} />
      <span className="seta">{aberta ? "⌃" : "⌄"}</span>
    </div>
  );
}
