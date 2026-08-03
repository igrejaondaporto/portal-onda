import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { TorradaProvider } from "../lib/TorradaContext";
import MenuEu from "../components/MenuEu";
import PainelLider from "./PainelLider";

/**
 * Casca da app depois de entrar. Início, Escala, Funções, Culto e
 * Inventário ainda não existem (passos 3 a 5) — por agora só há o
 * Painel do líder, alcançável pelo menu do avatar.
 */
export default function Sessao({ uid, papel, baseId }) {
  const [pessoa, setPessoa] = useState(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [pagina, setPagina] = useState("inicio");
  const [cabPainel, setCabPainel] = useState(null);

  useEffect(() => {
    getDoc(doc(db, `bases/${baseId}/pessoas/${uid}`)).then((s) => setPessoa(s.exists() ? s.data() : null));
  }, [uid, baseId]);

  const lider = papel === "lider_base";

  function irPara(p) {
    setPagina(p);
    setMenuAberto(false);
    if (p === "inicio") setCabPainel(null);
  }

  return (
    <TorradaProvider>
      <div className="app">
        <div className="crista topo" style={{ paddingBottom: pagina === "inicio" ? 32 : 20 }}>
          <div className="lin">
            <span className="logo">
              <i>igreja</i>
              <b>onda</b>
            </span>
            <div className="eu">
              <div style={{ textAlign: "right" }}>
                <b>{pessoa?.nome ?? "…"}</b>
                <p>{lider ? "Líder da base" : "Voluntário"}</p>
              </div>
              <span
                className="av"
                style={{
                  width: 40, height: 40, fontSize: 16, cursor: "pointer",
                  ...(pessoa?.foto ? { backgroundImage: `url(${pessoa.foto})` } : { background: pessoa?.cor || "#0019BE" }),
                }}
                onClick={() => setMenuAberto(true)}
              >
                {pessoa?.foto ? "" : pessoa?.nome?.[0]}
              </span>
            </div>
          </div>
          {pagina === "inicio" ? (
            <>
              <h1 style={{ marginTop: 22 }}>
                Olá,
                <br />
                <em>{pessoa?.nome ?? "…"}</em>
              </h1>
              <p className="sob">O resto do portal ainda não existe nesta versão.</p>
            </>
          ) : (
            cabPainel && (
              <>
                <h1 style={{ marginTop: 22 }}>{cabPainel.titulo}</h1>
                <p className="sob">{cabPainel.subtitulo}</p>
                {cabPainel.chips?.length > 0 && (
                  <div className="chips">
                    {cabPainel.chips.map((c, i) => (
                      <span className="chip" key={i}>{c}</span>
                    ))}
                  </div>
                )}
              </>
            )
          )}
        </div>
        <div className="corpo">
          {pagina === "painel" && (
            <PainelLider baseId={baseId} definirCabecalho={setCabPainel} aoVoltar={() => irPara("inicio")} />
          )}
        </div>
      </div>
      {menuAberto && (
        <MenuEu
          pessoa={pessoa}
          papel={papel}
          onFechar={() => setMenuAberto(false)}
          onAbrirPainel={() => irPara("painel")}
        />
      )}
    </TorradaProvider>
  );
}
