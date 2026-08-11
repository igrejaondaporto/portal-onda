import { useEffect, useState } from "react";
import { auth, onAuthStateChanged } from "./lib/firebase";
import { meuPapel } from "./lib/auth";
import Entrada from "./pages/Entrada";
import Sessao from "./pages/Sessao";
import TrocarPin from "./pages/TrocarPin";

export default function App() {
  const [aCarregar, setACarregar] = useState(true);
  const [sessao, setSessao] = useState(null);
  const [codigoProvisorio, setCodigoProvisorio] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (utilizador) => {
      // também entra aqui a meio do login (depois do PIN, antes do papel
      // vir do token) — mostra o ecrã de carregar em vez de deixar o
      // teclado do PIN parado sem resposta visível.
      setACarregar(true);
      if (utilizador) {
        const { papel, baseId } = await meuPapel();
        setSessao({ uid: utilizador.uid, papel, baseId });
      } else {
        setSessao(null);
        setCodigoProvisorio(null);
      }
      setACarregar(false);
    });
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

  return <Sessao {...sessao} />;
}
