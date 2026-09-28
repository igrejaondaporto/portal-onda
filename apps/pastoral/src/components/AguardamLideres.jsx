import { useEffect, useMemo, useState } from "react";
import { DIAS_PARADO, aguardandoLideres, ouvirContactos } from "../lib/contactos";
import SheetContacto from "./SheetContacto";

const curto = (nome) => String(nome ?? "").replace(/^Base (de |da |do )?/, "");

/**
 * "6 pessoas querem servir e aguardam os líderes" — no topo do Domingo.
 *
 * Pedido do dono do produto: o pastor manda alguém do funil às bases, e
 * quer ver no Início quem ainda está à espera de um líder, para ir atrás
 * dele. Sai sozinho quando um líder aprova ou diz "agora não"
 * (`contactos/{id}.servir`, escrito por functions/candidaturas.js) —
 * não há nada para dispensar.
 *
 * Laranja, o mesmo tom de "parado" no funil: é gente à espera, não um
 * alarme. Quem está à espera há mais de `DIAS_PARADO` dias aparece
 * contado à parte, por extenso.
 */
export default function AguardamLideres() {
  const [contactos, setContactos] = useState([]);
  const [lista, setLista] = useState(false);
  const [aberto, setAberto] = useState(null);

  useEffect(() => ouvirContactos(setContactos), []);
  const aguardam = useMemo(() => aguardandoLideres(contactos), [contactos]);

  if (!aguardam.length && !lista && !aberto) return null;

  const antigos = aguardam.filter((c) => c.diasEspera >= DIAS_PARADO).length;
  // quantos à espera em cada base — para saber a que líder ligar
  const porBase = new Map();
  for (const c of aguardam) {
    for (const b of c.servir.bases ?? []) {
      if (b.estado === "pendente") porBase.set(curto(b.nome), (porBase.get(curto(b.nome)) ?? 0) + 1);
    }
  }
  const resumoBases = [...porBase].sort((a, b) => b[1] - a[1]).map(([n, q]) => (q > 1 ? `${n} (${q})` : n)).join(", ");
  const n = aguardam.length;

  return (
    <>
      {n > 0 && (
        <div
          className="destaque pa-aguardam" role="button" tabIndex={0}
          onClick={() => setLista(true)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setLista(true); }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>Pendente · à espera dos líderes</p>
            <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em", lineHeight: 1.3 }}>
              {n === 1 ? `${aguardam[0].nome} quer servir e aguarda o líder` : `${n} pessoas querem servir e aguardam os líderes`}
            </p>
            <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>
              {antigos > 0 ? `${antigos} há mais de ${DIAS_PARADO} dias · ` : ""}{resumoBases}
            </p>
          </div>
          <span style={{ fontSize: 24 }} aria-hidden>🙋</span>
        </div>
      )}

      {lista && !aberto && (
        <>
          <div className="veu on" onClick={() => setLista(false)} />
          <div className="pin on" role="dialog" aria-modal="true" aria-labelledby="aguardam-titulo">
            <div className="pux" />
            <h2 id="aguardam-titulo">À espera dos líderes</h2>
            <p className="sb2">Quem mandaste às bases e ainda não teve resposta. Toca para ver o contacto.</p>
            {aguardam.length === 0 && <div className="vaz" style={{ marginTop: 14 }}>Já ninguém está à espera. 🙌</div>}
            {aguardam.map((c) => (
              <div
                key={c.id} className={`linha cabtoque${c.diasEspera >= DIAS_PARADO ? " pa-parado" : ""}`}
                role="button" tabIndex={0} onClick={() => setAberto(c.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setAberto(c.id); }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="nmt">{c.nome}</p>
                  <p className="ds">
                    {(c.servir.bases ?? []).map((b) => `${curto(b.nome)}${b.estado === "recusada" ? " (agora não)" : ""}`).join(" · ")}
                  </p>
                  <p className={c.diasEspera >= DIAS_PARADO ? "pa-parado-txt" : "cap"} style={{ marginTop: 3 }}>
                    {c.diasEspera === 0 ? "enviado hoje" : `à espera há ${c.diasEspera} dia${c.diasEspera === 1 ? "" : "s"}`}
                  </p>
                </div>
                <span className="seta" aria-hidden>›</span>
              </div>
            ))}
            <button className="btn sec full" style={{ marginTop: 16 }} onClick={() => setLista(false)}>Fechar</button>
          </div>
        </>
      )}

      {aberto && contactos.some((c) => c.id === aberto) && (
        <SheetContacto contacto={contactos.find((c) => c.id === aberto)} onFechar={() => setAberto(null)} />
      )}
    </>
  );
}
