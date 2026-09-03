import { diasAte, dataCurtaAniversario, fraseDiasAte } from "../../lib/aniversarios";

/** Lista completa, só para o líder — ordenada por quanto falta a
 *  partir de hoje. Quem não tem data no perfil não aparece aqui. */
export default function SheetAniversarios({ voluntarios, onFechar }) {
  const comData = voluntarios
    .filter((p) => p.aniversario)
    .map((p) => ({ pessoa: p, dias: diasAte(p.aniversario) }))
    .sort((a, b) => a.dias - b.dias);

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Aniversários</h2>
        {comData.length === 0 ? (
          <div className="vaz" style={{ marginTop: 12 }}>Ainda ninguém pôs a data no perfil.</div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {comData.map(({ pessoa, dias }) => (
              <div className="linha" key={pessoa.id}>
                <div style={{ flex: 1 }}>
                  <p className="nmt">{pessoa.nome}</p>
                  <p className="ds">{dataCurtaAniversario(pessoa.aniversario)}</p>
                </div>
                <span className={`tag ${dias === 0 ? "lim" : "cinz"}`}>{fraseDiasAte(dias)}</span>
              </div>
            ))}
          </div>
        )}
        <button className="btn sec full" style={{ marginTop: 18 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
