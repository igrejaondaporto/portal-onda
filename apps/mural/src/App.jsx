import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, onAuthStateChanged } from "@portal/shared/lib/firebase.js";
import { souAdminMuralAgora } from "./lib/anuncios.js";
import { pessoaQueEntrou } from "./lib/auth.js";
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
// o último "eu" deste aparelho, para quem volta com a sessão aberta
// ver logo o nome certo (e a aba Painel, se modera) — try/catch:
// sem storage só se perde isso.
const CHAVE_EU = "mural.eu";
function lerEuGuardado(uid) {
  try {
    const e = JSON.parse(localStorage.getItem(CHAVE_EU) || "null");
    return e?.uid === uid ? e : {};
  } catch {
    return {};
  }
}
function guardarEu(eu) {
  try {
    localStorage.setItem(CHAVE_EU, JSON.stringify(eu));
  } catch { /* sem storage */ }
}

export default function App() {
  const [pronto, setPronto] = useState(false);
  const [eu, setEu] = useState(null);
  const [aEntrar, setAEntrar] = useState(false);

  // Entrar não espera por nada (2026-10 — "30, 40 s depois do código"):
  // antes, o overlay só fechava depois do perfil (Firestore) E do
  // `souAdminMuralAgora` (mais uma Cloud Function, muitas vezes fria).
  // Agora fecha assim que o token chega, com o nome que já se sabia
  // (o rosto tocado na lista, ou o da última visita), e o resto
  // completa-se em fundo.
  useEffect(() => {
    const parar = onAuthStateChanged(auth, (utilizador) => {
      if (!utilizador) {
        setEu(null);
        setPronto(true);
        return;
      }
      const uid = utilizador.uid;
      const conhecido = { ...lerEuGuardado(uid), ...pessoaQueEntrou() };
      setEu({ uid, nome: conhecido.nome || "Alguém da igreja", foto: conhecido.foto ?? null, admin: !!conhecido.admin });
      setAEntrar(false); // entrou — fecha o overlay sozinho
      setPronto(true);

      const completar = (campos) =>
        setEu((atual) => {
          if (atual?.uid !== uid) return atual; // saiu entretanto
          const novo = { ...atual, ...campos };
          guardarEu(novo);
          return novo;
        });
      getDoc(doc(db, "pessoas", uid))
        .then((pSnap) => {
          const p = pSnap.exists() ? pSnap.data() : {};
          completar({ nome: p.nome || "Alguém da igreja", foto: p.foto ?? null });
        })
        .catch(() => {});
      souAdminMuralAgora().then((admin) => completar({ admin })).catch(() => {});
    });
    return () => parar();
  }, []);

  // depois do gesto de 5 toques (GatilhoModeracao) conceder o painel
  // — souAdminMuralAgora já vê o documento nesse instante, sem
  // precisar de sair/voltar a entrar.
  async function atualizarAdmin() {
    const admin = await souAdminMuralAgora().catch(() => false);
    setEu((atual) => {
      if (!atual) return atual;
      const novo = { ...atual, admin };
      guardarEu(novo);
      return novo;
    });
  }

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
      <Sessao eu={eu} aEntrar={aEntrar} onPedirEntrar={() => setAEntrar(true)} onAdminConcedido={atualizarAdmin} />
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
