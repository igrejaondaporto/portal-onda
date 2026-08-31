import { useState } from "react";
import { TorradaProvider } from "@portal/shared/lib/TorradaContext.jsx";
import { CANAIS_CHAMADAS } from "@portal/shared/lib/chamadas.js";
import PainelChamadas from "@portal/shared/components/PainelChamadas.jsx";

const CHAVE_ESTACAO = "kinder-estacao";

/**
 * kinder.igrejaonda.pt — kiosk sem login (pedido explícito: "não
 * precisa login por pessoa"). Em vez de PIN, cada aparelho escolhe UMA
 * vez a sua base (Baby/Fun/Kinder/Carro) — guardada no localStorage
 * DESSE aparelho — e fica trancado nela: quem está no Baby não vê nem
 * consegue tocar no botão de outra categoria. "Trocar de base" existe
 * para reconfigurar o aparelho, não para o dia a dia.
 */
export default function App() {
  const [estacaoId, setEstacaoId] = useState(() => localStorage.getItem(CHAVE_ESTACAO));
  const [aTrocar, setATrocar] = useState(false);

  function escolher(id) {
    localStorage.setItem(CHAVE_ESTACAO, id);
    setEstacaoId(id);
    setATrocar(false);
  }

  const canal = CANAIS_CHAMADAS.find((c) => c.id === estacaoId);
  const mostrarEscolha = !canal || aTrocar;

  return (
    <TorradaProvider>
      <header className="crista">
        <div className="lin">
          <div className="logo"><i>igreja</i><b>onda</b></div>
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
              {CANAIS_CHAMADAS.map((c) => (
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
                Cancelar
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="tit" style={{ marginTop: 16 }}><h2>{canal.rotulo}</h2></div>
            <PainelChamadas canaisPermitidos={[estacaoId]} />
            <button className="btn sec full" style={{ marginTop: 24 }} onClick={() => setATrocar(true)}>
              Trocar de base
            </button>
          </>
        )}
      </main>
    </TorradaProvider>
  );
}
