import { useState } from "react";
import { TorradaProvider } from "@portal/shared/lib/TorradaContext.jsx";
import { CANAIS_CHAMADAS } from "@portal/shared/lib/chamadas.js";
import PainelChamadas from "@portal/shared/components/PainelChamadas.jsx";

const CHAVE_ESTACAO = "kinder-estacao";

/**
 * As bases que aparecem NESTE painel.
 *
 * O "carro" (chamar uma matrícula) continua a existir no FreeShow e na
 * Técnica, que vê todos os canais — o que muda é que deixou de ser uma
 * base do Kinder: quem está aqui chama crianças, não carros. Por isso
 * filtra-se aqui e não se apaga de CANAIS_CHAMADAS, que é partilhado e
 * mexer nele mudava também a Técnica.
 */
const BASES = CANAIS_CHAMADAS.filter((c) => ["baby", "fun", "junior"].includes(c.id));

/* O logo é o mesmo nas duas versões do cabeçalho (div na escolha,
 * botão dentro de uma base) — em escopo de módulo para não ser um
 * componente novo a cada render. */
const Logo = () => (
  <>
    <i>igreja</i>
    <b>onda</b>
  </>
);

/**
 * kinder.igrejaonda.pt — kiosk sem login (pedido explícito: "não
 * precisa login por pessoa"). Em vez de PIN, cada aparelho escolhe a
 * sua base (Baby/Fun/Júnior) — guardada no localStorage DESSE aparelho
 * — e só chama por ela: quem está no Baby não vê o campo do Fun.
 *
 * A escolha é a página inicial, e volta-se lá pelo cabeçalho: o botão
 * "Início" ou o próprio logo, como na Técnica. Antes a única saída era
 * um botão de texto no fundo da página, a seguir ao histórico.
 */
export default function App() {
  const [estacaoId, setEstacaoId] = useState(() => {
    const guardado = localStorage.getItem(CHAVE_ESTACAO);
    // Um aparelho que tenha ficado no "carro" volta à escolha, em vez de
    // ficar preso numa base que já não existe aqui.
    return BASES.some((c) => c.id === guardado) ? guardado : null;
  });
  const [aTrocar, setATrocar] = useState(false);

  function escolher(id) {
    localStorage.setItem(CHAVE_ESTACAO, id);
    setEstacaoId(id);
    setATrocar(false);
  }

  const canal = BASES.find((c) => c.id === estacaoId);
  const mostrarEscolha = !canal || aTrocar;

  return (
    <TorradaProvider>
      <header className="crista">
        <div className="lin">
          {mostrarEscolha ? (
            <div className="logo"><Logo /></div>
          ) : (
            <button
              className="logo kin-logo-botao"
              onClick={() => setATrocar(true)}
              aria-label="Voltar ao início"
            >
              <Logo />
            </button>
          )}
          {!mostrarEscolha && (
            <button className="kin-voltar" onClick={() => setATrocar(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Início
            </button>
          )}
        </div>
        <h1 style={{ marginTop: 22 }}>Chamadas <em>Kinder</em></h1>
        <p className="sob">Escreve o nome e aparece na projeção.</p>
        <svg className="curva" viewBox="0 0 400 46" preserveAspectRatio="none">
          <path d="M0,46 C110,4 290,4 400,46 L400,46 L0,46 Z" fill="#fff" />
        </svg>
      </header>
      <main className="folha">
        {mostrarEscolha ? (
          <div style={{ marginTop: 16 }}>
            <span className="cap">Qual é a tua base?</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {BASES.map((c) => (
                <button
                  key={c.id} className="btn full" style={{ background: c.cor }}
                  onClick={() => escolher(c.id)}
                >
                  {c.rotulo}
                </button>
              ))}
            </div>
            {canal && aTrocar && (
              <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setATrocar(false)}>
                Voltar ao {canal.rotulo}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="tit" style={{ marginTop: 16 }}><h2>{canal.rotulo}</h2></div>
            <PainelChamadas canaisPermitidos={[estacaoId]} />
          </>
        )}
      </main>
    </TorradaProvider>
  );
}
