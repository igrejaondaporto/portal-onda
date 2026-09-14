import { useEffect, useState } from "react";
import { TorradaProvider, useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import AvisoOffline from "@portal/shared/components/AvisoOffline.jsx";
import FormFamilia from "../components/FormFamilia";
import { dadosRegisto, registarFamilia, linkFamilia } from "../lib/kinder";

export const CHAVE_TOKEN_FAMILIA = "kinder-familia-token";

/** Cabeçalho das duas páginas dos pais — o mesmo azul de sempre, sem
 *  casca de app (não há menu: os pais não têm conta). */
export function CabecalhoPublico({ titulo, subtitulo }) {
  return (
    <header className="crista">
      <div className="lin">
        <span className="logo"><i>igreja</i><b>onda</b></span>
        <span className="cap" style={{ color: "rgba(255,255,255,.8)" }}>Kinder</span>
      </div>
      <h1 style={{ marginTop: 22 }}>{titulo}</h1>
      {subtitulo && <p className="sob">{subtitulo}</p>}
      <svg className="curva" viewBox="0 0 400 46" preserveAspectRatio="none">
        <path d="M0,46 C110,4 290,4 400,46 L400,46 L0,46 Z" fill="#fff" />
      </svg>
    </header>
  );
}

/**
 * /registo — o QR na porta do Kinder abre isto. Os pais registam a
 * família sem conta nenhuma; o cadastro já fica pronto na hora, sem
 * passo de confirmação nenhum (ver `registarFamiliaKinder` em
 * functions/kinder.js). No fim recebem o link da família — é por ele
 * que veem o código de levantamento de cada domingo.
 */
export default function RegistoFamilia() {
  return (
    <TorradaProvider>
      <div className="kin-publico">
        <Conteudo />
      </div>
    </TorradaProvider>
  );
}

function Conteudo() {
  const torrada = useTorrada();
  const [config, setConfig] = useState(null);
  const [erro, setErro] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [token, setToken] = useState(null);
  const [foiMembro, setFoiMembro] = useState(false);
  const [jaRegistado] = useState(() => { try { return localStorage.getItem(CHAVE_TOKEN_FAMILIA); } catch { return null; } });

  useEffect(() => {
    dadosRegisto().then(setConfig).catch(() => setErro("Não foi possível abrir o registo. Verifica a ligação e tenta outra vez."));
  }, []);

  async function submeter(dados) {
    setAEnviar(true);
    try {
      const r = await registarFamilia(dados);
      try { localStorage.setItem(CHAVE_TOKEN_FAMILIA, r.token); } catch { /* sem armazenamento */ }
      setFoiMembro(dados.membro === true);
      setToken(r.token);
      window.scrollTo({ top: 0 });
    } catch (e) {
      torrada(e.message || "Não foi possível registar. Tenta outra vez.", true);
    } finally {
      setAEnviar(false);
    }
  }

  async function partilhar(link) {
    try {
      if (navigator.share) await navigator.share({ title: "Kinder — o nosso link", url: link });
      else { await navigator.clipboard.writeText(link); torrada("Link copiado"); }
    } catch { /* partilha cancelada */ }
  }

  if (token) {
    const link = linkFamilia(token);
    return (
      <>
        <CabecalhoPublico titulo={<>Registo <em>feito</em></>} subtitulo="Obrigado — até domingo!" />
        <main className="folha">
          <div className="caixa" style={{ marginTop: 16 }}>
            <p className="nmt">Guarda este link</p>
            <p className="ds" style={{ marginTop: 4 }}>
              É o link da vossa família: mostra o QR para entrar mais depressa e o código para ir buscar as crianças.
              Adiciona-o ao ecrã principal do telemóvel.
            </p>
            <p style={{ fontSize: 12.5, wordBreak: "break-all", marginTop: 10, color: "var(--azul)" }}>{link}</p>
          </div>
          <a className="btn full" style={{ marginTop: 14, display: "block", textAlign: "center" }} href={link}>Abrir o nosso link</a>
          <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => partilhar(link)}>Partilhar / copiar</button>
          {foiMembro && config?.grupoPais?.link && (
            <a className="btn sec full" style={{ marginTop: 9, display: "block", textAlign: "center" }} href={config.grupoPais.link} target="_blank" rel="noreferrer">
              Entrar no grupo dos pais do Kinder
            </a>
          )}
          <p className="nota">No primeiro domingo, um voluntário confirma o registo na receção do Kinder.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <AvisoOffline />
      <CabecalhoPublico titulo={<>Registo da <em>família</em></>} subtitulo="Uma vez só — depois é só mostrar o QR à entrada." />
      <main className="folha">
        {jaRegistado && (
          <div className="destaque" style={{ marginTop: 14 }} onClick={() => window.location.assign(`/familia/${jaRegistado}`)}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>Neste telemóvel já há um registo</p>
              <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5 }}>Abrir o link da família</p>
            </div>
            <span style={{ fontSize: 24 }}>›</span>
          </div>
        )}
        {erro && <p className="aviso" style={{ marginTop: 16 }}>{erro}</p>}
        {!config && !erro && <div className="vaz" style={{ marginTop: 16 }}>A carregar…</div>}
        {config && (
          <FormFamilia
            consentimento={config.consentimento}
            mostrarVisitante
            aEnviar={aEnviar}
            textoBotao="Registar a família"
            onSubmeter={submeter}
            avisar={(m) => torrada(m, true)}
          />
        )}
      </main>
    </>
  );
}
