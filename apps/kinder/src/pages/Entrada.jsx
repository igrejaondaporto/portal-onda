import { useEffect, useState } from "react";
import { obterDadosEntrada } from "@portal/shared/lib/pessoas.js";
import { BASE_ID } from "@portal/shared/lib/firebase.js";
import SheetPin from "@portal/shared/components/SheetPin.jsx";
import GatilhoDev from "@portal/shared/components/GatilhoDev.jsx";
import AvisoOffline from "@portal/shared/components/AvisoOffline.jsx";
import AvisoInstalarPWA from "@portal/shared/components/AvisoInstalarPWA.jsx";

function TituloBase({ nome }) {
  if (!nome) return <h1>Base</h1>;
  const partes = nome.trim().split(" ");
  const ultima = partes.pop();
  return (
    <h1>
      {partes.length ? `${partes.join(" ")} ` : ""}
      <em>{ultima}</em>
    </h1>
  );
}

function subtitulo(local) {
  const hoje = new Date();
  const dia = new Intl.DateTimeFormat("pt-PT", { weekday: "long" }).format(hoje);
  const data = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long" }).format(hoje);
  return `Hoje, ${dia} ${data}${local ? ` · ${local}` : ""}`;
}

export default function Entrada({ onDeveTrocarPin }) {
  const [pessoas, setPessoas] = useState([]);
  const [base, setBase] = useState(null);
  const [alvo, setAlvo] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    obterDadosEntrada(BASE_ID)
      .then(({ base, pessoas }) => {
        setBase(base);
        setPessoas(pessoas);
      })
      .catch(() => setErro("Não foi possível carregar a base. Verifica a ligação e tenta outra vez."));
  }, []);

  const nomeLider = pessoas.find((p) => p.papel === "lider_base")?.nome ?? "líder do Kinder";

  return (
    <div className="login">
      <AvisoOffline />
      <AvisoInstalarPWA />
      <div className="crista entrada">
        <div>
          <div className="lin">
            <GatilhoDev>
              <span className="logo">
                <i>igreja</i>
                <b>onda</b>
              </span>
            </GatilhoDev>
            <span className="cap" style={{ color: "rgba(255,255,255,.8)" }}>
              Porto · Maia
            </span>
          </div>
          <TituloBase nome={base?.nome} />
          <p className="sob">{subtitulo(base?.local)}</p>
          <div className="chips">
            {base?.horaChegada && <span className="chip">Chegada {base.horaChegada}</span>}
            {base?.horaCulto && <span className="chip">Culto {base.horaCulto}</span>}
          </div>
        </div>
        <svg className="curva" viewBox="0 0 400 46" preserveAspectRatio="none">
          <path d="M0,46 C110,4 290,4 400,46 L400,46 L0,46 Z" fill="#fff" />
        </svg>
      </div>
      <div className="folha">
        <div className="tit">
          <h2>Toca no teu nome</h2>
          <span className="cap">{pessoas.length ? `${pessoas.length} pessoas` : ""}</span>
        </div>
        {erro && <p className="aviso" style={{ textAlign: "left", paddingTop: 0 }}>{erro}</p>}
        <div className="g">
          {pessoas.length === 0 && !erro
            ? Array.from({ length: 10 }).map((_, i) => (
                <div className="p skel" key={i} aria-hidden="true">
                  <span className="av" />
                  <b>·</b>
                </div>
              ))
            : pessoas.map((p, i) => (
                <button key={p.id} className="p" style={{ animationDelay: `${i * 20}ms` }} onClick={() => setAlvo(p)}>
                  <span className="av" style={p.foto ? { backgroundImage: `url(${p.foto})` } : { background: p.cor }}>
                    {p.foto ? "" : p.nome[0]}
                    {(p.papel === "lider_base" || p.papel === "auxiliar") && <s aria-label="Líder">★</s>}
                  </span>
                  <b>{p.nome}</b>
                </button>
              ))}
        </div>
        <p className="nota">
          O teu nome e a tua foto ficam visíveis para as pessoas da tua base. Mais nada é partilhado.
        </p>
        <p className="assinatura">
          Feito por <a href="https://instagram.com/geniai.pt" target="_blank" rel="noreferrer">@geniai.pt</a>
        </p>
      </div>
      {alvo && (
        <SheetPin
          pessoa={alvo}
          nomeLider={nomeLider}
          onFechar={() => setAlvo(null)}
          onDeveTrocarPin={onDeveTrocarPin}
        />
      )}
    </div>
  );
}
