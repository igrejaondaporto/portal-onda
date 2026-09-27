import { useEffect, useState } from "react";
import { ouvirMeusRelatos } from "../lib/relatos.js";
import { useTorrada } from "../lib/TorradaContext.jsx";
import SheetReportarProblema from "./SheetReportarProblema.jsx";
import SheetAbrirRelato from "./SheetAbrirRelato.jsx";
import SheetDetalheRelato from "./SheetDetalheRelato.jsx";

/** "Reportar problema", pronto a inserir em "A base" — ao contrário de
 *  "Solicitar BG" (que precisa de `souLiderBase`/`minhasSolicitacoes`
 *  já vivos no Início de cada app), isto não depende de papel nenhum
 *  nem de nada que a app à volta já tenha: qualquer voluntário
 *  reporta. Por isso é um bloco só, com o próprio estado lá dentro —
 *  cada app só precisa de importar e pôr dentro do `sect` de "A base",
 *  a seguir ao `.map()` dos outros itens. Uma linha por app.
 *
 *  `paginaAtual` é opcional — passa o que a app já tiver no seu
 *  próprio state de navegação, só como contexto pra quem for triar. */
export default function BlocoReportarProblema({ uid, paginaAtual = null }) {
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
      <div className="linha" style={{ cursor: "pointer" }} onClick={() => setSheet({ tipo: "lista" })}>
        <div style={{ flex: 1 }}>
          <p className="nmt">Reportar problema</p>
          <p className="ds">Bugs, erros ou melhorias que encontrares</p>
        </div>
        {emAberto ? <span className="tag" style={{ marginLeft: "auto" }}>{emAberto} em aberto</span>
          : <span className="seta">›</span>}
      </div>
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
