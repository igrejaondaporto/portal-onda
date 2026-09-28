import { useEffect, useState } from "react";
import { ouvirMeusRelatos } from "../lib/relatos.js";
import { useTorrada } from "../lib/TorradaContext.jsx";
import SheetReportarProblema from "./SheetReportarProblema.jsx";
import SheetAbrirRelato from "./SheetAbrirRelato.jsx";
import SheetDetalheRelato from "./SheetDetalheRelato.jsx";

/** Sempre visível, em qualquer ecrã — pedido do líder depois de já ter
 *  estado escondido dentro do menu (MenuEu) e continuar sem ser
 *  achado: "não quero que fique escondido [...] quero que fique de
 *  fácil acesso, porque é onde as pessoas vão ter onde reportar."
 *  Canto inferior direito, acima da NavBar (`.botao-flutuante`, ver
 *  global.css) — mesmo em cima do Painel do líder ou de qualquer
 *  sheet aberta, porque um bug pode acontecer em qualquer ecrã.
 *
 *  Ícone em SVG cru, não lucide-react — packages/shared não tem essa
 *  dependência (ver o mesmo comentário em NavBar.jsx). */
export default function BotaoReportarFlutuante({ uid, paginaAtual = null }) {
  const torrada = useTorrada();
  const [meusRelatos, setMeusRelatos] = useState([]);
  const [sheet, setSheet] = useState(null); // null | {tipo:"lista"|"abrir"|"detalhe", relato?}

  useEffect(() => {
    if (!uid) return;
    return ouvirMeusRelatos(uid, setMeusRelatos);
  }, [uid]);

  const emAberto = meusRelatos.filter((r) => r.status !== "resolvido" && r.status !== "recusado").length;

  return (
    <>
      <button className="botao-flutuante" onClick={() => setSheet({ tipo: "lista" })} aria-label="Reportar problema">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 21V3" />
          <path d="M4 4h13l-2.5 4L17 12H4" />
        </svg>
        {emAberto > 0 && <span className="botao-flutuante-conta">{emAberto}</span>}
      </button>
      {sheet?.tipo === "lista" && (
        <SheetReportarProblema
          relatos={meusRelatos}
          onFechar={() => setSheet(null)}
          onNovoRelato={() => setSheet({ tipo: "abrir" })}
          onVerDetalhe={(r) => setSheet({ tipo: "detalhe", relato: r })}
        />
      )}
      {sheet?.tipo === "abrir" && (
        <SheetAbrirRelato
          paginaAtual={paginaAtual}
          onFechar={() => setSheet({ tipo: "lista" })}
          onGuardado={(msg) => { setSheet({ tipo: "lista" }); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "detalhe" && (
        <SheetDetalheRelato
          relato={meusRelatos.find((r) => r.id === sheet.relato.id) ?? sheet.relato}
          onFechar={() => setSheet({ tipo: "lista" })}
          onExcluido={() => setSheet({ tipo: "lista" })}
        />
      )}
    </>
  );
}
