import { useState } from "react";
import { corPara, ESTADOS, nomeCategoria, relativo, linkWhatsApp } from "../lib/util.js";
import { pedirContactoAnuncio, reportarAnuncio } from "../lib/anuncios.js";

/** Folha de detalhe — mesmo padrão de SheetPin (veu + folha fixa em
 *  baixo). "Reportar" e "Falar no WhatsApp" só aparecem em anúncios
 *  de outra pessoa; o dono gere o seu em "Os meus". */
export default function DetalheAnuncio({ anuncio, meuUid, onFechar }) {
  const [aPedirContacto, setAPedirContacto] = useState(false);
  const [aReportar, setAReportar] = useState(false);
  const [reportado, setReportado] = useState(false);
  const [erro, setErro] = useState("");

  const ehMeu = anuncio.autorId === meuUid;
  const est = ESTADOS[anuncio.estado] || ESTADOS.disponivel;

  async function falarNoWhatsapp() {
    setAPedirContacto(true);
    setErro("");
    try {
      const telefone = await pedirContactoAnuncio(anuncio.id);
      window.open(linkWhatsApp(telefone), "_blank", "noreferrer");
    } catch {
      setErro("Sem contacto disponível para este anúncio.");
    }
    setAPedirContacto(false);
  }

  async function reportar() {
    const motivo = window.prompt("O que é que não está bem neste anúncio? (opcional)") ?? "";
    setAReportar(true);
    await reportarAnuncio(anuncio.id, motivo).catch(() => {});
    setReportado(true);
    setAReportar(false);
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-label={anuncio.titulo}>
        <div className="pux" />
        {anuncio.fotos?.length ? (
          <div className="fotoscolagem" style={{ marginTop: 0 }}>
            {anuncio.fotos.map((f, i) => <img key={i} src={f} alt="" />)}
          </div>
        ) : (
          <div
            className="cara"
            style={{ width: 84, height: 84, fontSize: 30, background: corPara(anuncio.titulo) }}
          >
            {anuncio.titulo[0]}
          </div>
        )}
        <span className="tag" style={{ marginTop: 14, display: "inline-block" }}>
          {nomeCategoria(anuncio.tipo, anuncio.categoria)}
        </span>{" "}
        <span className={`tag ${est.classe === "disp" ? "verd" : est.classe === "vend" ? "cinz" : ""}`}>
          {est.nome}
        </span>
        <h2 style={{ marginTop: 10 }}>{anuncio.titulo}</h2>
        <p className="sb2" style={{ fontSize: 20, fontWeight: 800, color: "var(--tinta)", textAlign: "left" }}>
          {anuncio.gratis ? "Grátis" : anuncio.preco || "A combinar"}
        </p>
        {anuncio.descricao && <p className="ds" style={{ fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>{anuncio.descricao}</p>}
        <div className="linha" style={{ marginTop: 6 }}>
          <span className="bola" style={anuncio.autorFoto ? { backgroundImage: `url(${anuncio.autorFoto})` } : { background: corPara(anuncio.autorNome) }}>
            {anuncio.autorFoto ? "" : anuncio.autorNome?.[0]}
          </span>
          <span>
            <span className="nmt" style={{ fontSize: 15 }}>{anuncio.autorNome}</span>
            <span className="ds">{anuncio.autorLocal || "Igreja Onda"} · publicou {relativo(anuncio.criadoEm)}</span>
          </span>
        </div>

        {!ehMeu && anuncio.estado !== "vendido" && (
          <button className="btn zap" disabled={aPedirContacto} onClick={falarNoWhatsapp} style={{ marginTop: 12 }}>
            Falar com {anuncio.autorNome?.split(" ")[0]} no WhatsApp
          </button>
        )}
        {erro && <p className="aviso">{erro}</p>}
        {!ehMeu && (
          <button
            className="sair" style={{ width: "100%", textAlign: "center", color: "var(--cinza)" }}
            disabled={aReportar || reportado} onClick={reportar}
          >
            {reportado ? "Reportado — obrigado" : "Reportar anúncio à moderação"}
          </button>
        )}
      </div>
    </>
  );
}
