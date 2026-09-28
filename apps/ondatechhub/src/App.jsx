import { useEffect, useState } from "react";
import { auth, onAuthStateChanged } from "@portal/shared/lib/firebase.js";
import { meuPapel, entrarComTokenDaUrl } from "@portal/shared/lib/auth.js";
import { precisaTour } from "@portal/shared/lib/tour.js";
import Entrada from "./pages/Entrada";
import Sessao from "./pages/Sessao";
import TrocarPin from "./pages/TrocarPin";

export default function App() {
  const [aCarregar, setACarregar] = useState(true);
  const [sessao, setSessao] = useState(null);
  const [codigoProvisorio, setCodigoProvisorio] = useState(null);
  const [mostrarTourAoEntrar, setMostrarTourAoEntrar] = useState(false);

  useEffect(() => {
    let parar;
    // se veio de "trocar de base" noutra base, entra com o token da
    // fragment ANTES de ligar o listener — senão o primeiro disparo
    // (sem sessão) mostra a Entrada por um instante e depois troca.
    entrarComTokenDaUrl().then(() => {
      parar = onAuthStateChanged(auth, async (utilizador) => {
        // também entra aqui a meio do login (depois do PIN, antes do papel
        // vir do token) — mostra o ecrã de carregar em vez de deixar o
        // teclado do PIN parado sem resposta visível.
        setACarregar(true);
        if (utilizador) {
          const { papel, baseId, podePublicarCulto } = await meuPapel();
          setSessao({ uid: utilizador.uid, papel, baseId, podePublicarCulto });
          // recalculado do zero a cada resolução — funciona tanto por
          // `entrar` (PIN) como por `trocarBase` (troca entre domínios),
          // sem depender de nenhum dos dois avisar o tour.
          setMostrarTourAoEntrar(await precisaTour(utilizador.uid, baseId));
        } else {
          setSessao(null);
          setCodigoProvisorio(null);
        }
        setACarregar(false);
      });
    });
    return () => parar?.();
  }, []);

  if (aCarregar) {
    return (
      <div className="acarregar">
        <span className="logo">
          <i>igreja</i>
          <b>onda</b>
        </span>
      </div>
    );
  }

  if (!sessao) return <Entrada onDeveTrocarPin={setCodigoProvisorio} />;

  if (codigoProvisorio) {
    return (
      <TrocarPin
        papel={sessao.papel}
        codigoAtual={codigoProvisorio}
        onConcluido={() => setCodigoProvisorio(null)}
      />
    );
  }

  return <Sessao {...sessao} mostrarTourAoEntrar={mostrarTourAoEntrar} />;
}
