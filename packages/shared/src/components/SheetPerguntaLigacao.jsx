/**
 * Primeiro ecrã de "Novo voluntário": só a pergunta, nada de formulário
 * a distrair. "Não" segue para o formulário normal; "Sim" abre a
 * escolha de base + pessoa (SheetLigarPessoa) antes de chegar lá.
 */
export default function SheetPerguntaLigacao({ onFechar, onSim, onNao }) {
  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Novo voluntário</h2>
        <p className="sb2">Esta pessoa já é voluntária noutra base?</p>
        <button className="btn full" style={{ marginTop: 20 }} onClick={onSim}>
          Sim, já tem perfil
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onNao}>
          Não, é nova
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
