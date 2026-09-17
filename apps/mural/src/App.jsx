import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, onAuthStateChanged } from "@portal/shared/lib/firebase.js";
import { souAdminMuralAgora } from "./lib/anuncios.js";
import Entrada from "./pages/Entrada.jsx";
import Sessao from "./pages/Sessao.jsx";

export default function App() {
  const [aCarregar, setACarregar] = useState(true);
  const [eu, setEu] = useState(null);

  useEffect(() => {
    const parar = onAuthStateChanged(auth, async (utilizador) => {
      setACarregar(true);
      if (utilizador) {
        const [pSnap, admin] = await Promise.all([
          getDoc(doc(db, "pessoas", utilizador.uid)),
          souAdminMuralAgora().catch(() => false),
        ]);
        const p = pSnap.exists() ? pSnap.data() : {};
        setEu({ uid: utilizador.uid, nome: p.nome || "Alguém da igreja", foto: p.foto ?? null, admin });
      } else {
        setEu(null);
      }
      setACarregar(false);
    });
    return () => parar();
  }, []);

  if (aCarregar) {
    return (
      <div className="acarregar">
        <span className="logo">
          <i>mural</i>
          <b>onda</b>
        </span>
      </div>
    );
  }

  if (!eu) return <Entrada />;
  return <Sessao eu={eu} />;
}
