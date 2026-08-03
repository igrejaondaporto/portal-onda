import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { TorradaProvider } from "../lib/TorradaContext";
import MenuEu from "../components/MenuEu";
import NavBar from "../components/NavBar";
import PainelLider from "./PainelLider";
import Inicio from "./Inicio";
import Escala from "./Escala";
import Funcoes from "./Funcoes";

/**
 * Casca da app depois de entrar: cabeçalho + corpo + navegação.
 * Cada página (Início, Escala, Painel) define o próprio cabeçalho via
 * definirCabecalho — o mesmo padrão do cabeca() do protótipo, só que
 * como estado em vez de mexer direto no DOM.
 */
export default function Sessao({ uid, papel, baseId }) {
  const [pessoa, setPessoa] = useState(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [pagina, setPagina] = useState("inicio");
  const [cab, setCab] = useState({ titulo: "", subtitulo: "", chips: [] });
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano] = useState(hoje.getFullYear());
  const [focoEvento, setFocoEvento] = useState(null);

  useEffect(() => {
    getDoc(doc(db, `bases/${baseId}/pessoas/${uid}`)).then((s) => setPessoa(s.exists() ? s.data() : null));
  }, [uid, baseId]);

  const lider = papel === "lider_base";

  function irPara(p) {
    setPagina(p);
    setMenuAberto(false);
    if (p === "funcoes") setFocoEvento(null);
  }

  function irParaFuncoes(eventoId) {
    setFocoEvento(eventoId ?? null);
    setPagina("funcoes");
    setMenuAberto(false);
  }

  return (
    <TorradaProvider>
      <div className="app">
        <div className="crista topo" style={{ paddingBottom: 20 }}>
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
          <h1 style={{ marginTop: 22 }}>{cab.titulo}</h1>
          {cab.subtitulo && <p className="sob">{cab.subtitulo}</p>}
          {cab.chips?.length > 0 && (
            <div className="chips">
              {cab.chips.map((c, i) => (
                <span className="chip" key={i}>{c}</span>
              ))}
            </div>
          )}
        </div>
        <div className="corpo">
          {pagina === "inicio" && (
            <Inicio
              uid={uid} papel={papel} pessoa={pessoa} mes={mes} ano={ano} definirMes={setMes}
              definirCabecalho={setCab} onIrEscala={() => irPara("escala")} onVerFuncoes={irParaFuncoes}
            />
          )}
          {pagina === "escala" && (
            <Escala
              uid={uid} mes={mes} ano={ano} definirMes={setMes} definirCabecalho={setCab}
              onVerFuncoes={irParaFuncoes}
            />
          )}
          {pagina === "funcoes" && (
            <Funcoes uid={uid} papel={papel} eventoIdFoco={focoEvento} definirCabecalho={setCab} />
          )}
          {pagina === "painel" && (
            <PainelLider baseId={baseId} definirCabecalho={setCab} aoVoltar={() => irPara("inicio")} />
          )}
        </div>
      </div>
      <NavBar pagina={pagina} onIr={irPara} />
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
