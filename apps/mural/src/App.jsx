import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, onAuthStateChanged } from "@portal/shared/lib/firebase.js";
import { souAdminMuralAgora } from "./lib/anuncios.js";
import Entrada from "./pages/Entrada.jsx";
import Sessao from "./pages/Sessao.jsx";

/**
 * O Mural é público (2026-09, pedido explícito): ver os anúncios e
 * falar no WhatsApp NUNCA pede conta — só publicar pede. Por isso o
 * ecrã de Entrada deixou de ser a porta de entrada da app: é um
 * overlay que só aparece quando alguém pede para entrar (botão
 * "Entrar" no cabeçalho, ou ao tentar Publicar/Os meus/Painel sem
 * sessão — ver `onPedirEntrar` em Sessao.jsx).
 */
export default function App() {
  const [pronto, setPronto] = useState(false);
  const [eu, setEu] = useState(null);
  const [aEntrar, setAEntrar] = useState(false);

  useEffect(() => {
    const parar = onAuthStateChanged(auth, async (utilizador) => {
      if (utilizador) {
        const [pSnap, admin] = await Promise.all([
          getDoc(doc(db, "pessoas", utilizador.uid)),
          souAdminMuralAgora().catch(() => false),
        ]);
        const p = pSnap.exists() ? pSnap.data() : {};
        setEu({ uid: utilizador.uid, nome: p.nome || "Alguém da igreja", foto: p.foto ?? null, admin });
        setAEntrar(false); // entrou — fecha o overlay sozinho
      } else {
        setEu(null);
      }
      setPronto(true);
    });
    return () => parar();
  }, []);

  if (!pronto) {
    return (
      <div className="acarregar">
        <span className="logo">
          <i>mural</i>
          <b>onda</b>
        </span>
      </div>
    );
  }

  return (
    <>
      <Sessao eu={eu} onPedirEntrar={() => setAEntrar(true)} />
      {aEntrar && (
        <div
          className="entradaModal"
          onClick={(e) => e.target === e.currentTarget && setAEntrar(false)}
        >
          <div className="entradaModalCartao">
            <button className="fecharEntradaModal" aria-label="Fechar" onClick={() => setAEntrar(false)}>×</button>
            <Entrada />
          </div>
        </div>
      )}
    </>
  );
}
