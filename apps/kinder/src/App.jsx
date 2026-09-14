import { useEffect, useState } from "react";
import { auth, onAuthStateChanged } from "@portal/shared/lib/firebase.js";
import { meuPapel, entrarComTokenDaUrl } from "@portal/shared/lib/auth.js";
import { precisaTour } from "@portal/shared/lib/tour.js";
import KioskChamadas, { CHAVE_ESTACAO, CHAVE_PORTAL } from "./kiosk/KioskChamadas";
import RegistoFamilia from "./publico/RegistoFamilia";
import LinkFamilia from "./publico/LinkFamilia";
import ImprimirRegisto from "./publico/ImprimirRegisto";
import Entrada from "./pages/Entrada";
import Sessao from "./pages/Sessao";
import TrocarPin from "./pages/TrocarPin";

/**
 * kinder.igrejaonda.pt serve cinco coisas diferentes, escolhidas pelo
 * caminho (o wrangler.toml já devolve o index.html para qualquer um):
 *   /chamadas          → kiosk de chamadas, sem login (era a raiz até
 *                        a Base Kinder existir — ver KioskChamadas)
 *   /registo           → os pais registam a família (QR na porta)
 *   /registo/imprimir  → o cartaz desse QR, para a líder imprimir
 *   /familia/<token>   → o link da família: código do dia, dados
 *   o resto            → o Portal do voluntário, com PIN
 */
function rotaAtual() {
  const caminho = window.location.pathname.replace(/\/+$/, "");
  if (caminho === "/chamadas") return { tipo: "chamadas" };
  if (caminho === "/registo/imprimir") return { tipo: "imprimir" };
  if (caminho === "/registo") return { tipo: "registo" };
  const m = /^\/familia\/([A-Za-z0-9_-]{16,})$/.exec(caminho);
  if (m) return { tipo: "familia", token: m[1] };
  return { tipo: "portal" };
}

const ler = (chave) => { try { return localStorage.getItem(chave); } catch { return null; } };

export default function App() {
  const [rota] = useState(rotaAtual);
  if (rota.tipo === "chamadas") return <KioskChamadas />;
  if (rota.tipo === "registo") return <RegistoFamilia />;
  if (rota.tipo === "imprimir") return <ImprimirRegisto />;
  if (rota.tipo === "familia") return <LinkFamilia token={rota.token} />;
  return <Portal />;
}

function Portal() {
  const [aCarregar, setACarregar] = useState(true);
  const [sessao, setSessao] = useState(null);
  const [codigoProvisorio, setCodigoProvisorio] = useState(null);
  const [mostrarTourAoEntrar, setMostrarTourAoEntrar] = useState(false);

  useEffect(() => {
    let parar;
    entrarComTokenDaUrl().then(() => {
      parar = onAuthStateChanged(auth, async (utilizador) => {
        setACarregar(true);
        // A sessão anónima é a do kiosk de chamadas (mesmo domínio,
        // mesmo Firebase) — não é ninguém, conta como "sem sessão".
        if (utilizador && !utilizador.isAnonymous) {
          const { papel, baseId, podePublicarCulto } = await meuPapel();
          setSessao({ uid: utilizador.uid, papel, baseId, podePublicarCulto });
          setMostrarTourAoEntrar(await precisaTour(utilizador.uid, baseId));
        } else {
          // Os aparelhos das salas tinham o kiosk na raiz. Um aparelho
          // que já escolheu a sua sala (e que ninguém usou para entrar no
          // Portal) continua a abrir nas chamadas, sem ficar parado num
          // ecrã de PIN à espera de alguém que não vai digitar nada.
          if (utilizador?.isAnonymous && ler(CHAVE_ESTACAO) && !ler(CHAVE_PORTAL)) {
            window.location.replace("/chamadas");
            return;
          }
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
