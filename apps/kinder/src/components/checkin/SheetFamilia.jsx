import { useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { linkWhatsApp } from "@portal/shared/lib/data.js";
import { nomeCategoria, varsCategoria } from "../../lib/modelo";
import {
  fazerCheckin, editarFamilia, novoLinkFamilia, desativarFamilia, linkFamilia, hora,
} from "../../lib/kinder";
import FormFamilia from "../FormFamilia";
import { Cuidados } from "../../pages/Checkin";

const primeiroNome = (n) => String(n || "").split(" ")[0];

/** Ícone do WhatsApp — cru, sem depender de nenhuma lib (mesmo padrão
 *  do resto do Kinder, ver IconeSite em ImprimirRegisto.jsx). Só o
 *  ícone no botão, sem texto — a própria forma já diz o que é. */
function IconeWhatsApp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.6-.8-1.8-.9-.2-.1-.4-.1-.6.1-.2.2-.6.9-.8 1-.1.2-.3.2-.5.1-1.4-.6-2.4-1.4-3.3-2.9-.1-.2-.1-.4.1-.5.2-.2.5-.5.6-.7.1-.2.1-.4 0-.5-.1-.2-.7-1.7-.9-2.1-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.5.2-.6.3-.5.5-.7 1.1-.7 1.8.1 1.6 1 3.1 2.4 4.5 1.7 1.7 3.1 2.3 4.9 2.6.6.1 1.1 0 1.5-.2.4-.2 1.2-.9 1.4-1.4.2-.5.2-.9.1-1-.1-.1-.2-.2-.4-.2z" />
      <path d="M12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.7 1.5 5.2L2 22l4.9-1.5c1.5.9 3.2 1.3 5.1 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.7 0-3.4-.5-4.8-1.4l-.3-.2-3.1.9.9-3-.2-.3C3.6 14 3.1 12.4 3.1 12.1c0-4.9 4-8.9 8.9-8.9s8.9 4 8.9 8.9-4 8.9-8.9 9.1z" />
    </svg>
  );
}

/**
 * Uma família, à entrada: marcar as crianças que ficam → check-in →
 * o código aparece aqui e pode seguir por WhatsApp para os pais.
 * Também: corrigir a ficha, enviar (outra vez) o link da família e,
 * só líderes, remover a família.
 */
export default function SheetFamilia({ familia, criancas, checkinPorCrianca, codigo, lider, restrita, tokenAcabado, onFechar, onSaida }) {
  const torrada = useTorrada();
  const foraDaSala = criancas.filter((c) => !checkinPorCrianca[c.id] || checkinPorCrianca[c.id].saidaEm);
  const [escolhidas, setEscolhidas] = useState(() => new Set(foraDaSala.map((c) => c.id)));
  const [aEnviar, setAEnviar] = useState(false);
  const [codigoFeito, setCodigoFeito] = useState(null);
  const [aEditar, setAEditar] = useState(false);
  const [aConfirmarRemover, setAConfirmarRemover] = useState(false);
  const [token, setToken] = useState(tokenAcabado ?? null);
  const responsavel = familia.responsaveis?.[0];
  const naSala = criancas.filter((c) => checkinPorCrianca[c.id] && !checkinPorCrianca[c.id].saidaEm);
  const nomes = criancas.map((c) => primeiroNome(c.nome)).join(", ");

  function alternar(id) {
    setEscolhidas((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function checkin() {
    if (!escolhidas.size) return torrada("Escolhe pelo menos uma criança.");
    setAEnviar(true);
    try {
      const r = await fazerCheckin([...escolhidas]);
      setCodigoFeito(r.codigos[familia.id]);
    } catch (e) {
      torrada(e.message || "Não foi possível fazer o check-in.", true);
    } finally {
      setAEnviar(false);
    }
  }

  async function guardarFicha(dados) {
    setAEnviar(true);
    try {
      await editarFamilia({ familiaId: familia.id, ...dados });
      setAEditar(false);
      torrada("Ficha atualizada");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.", true);
    } finally {
      setAEnviar(false);
    }
  }

  async function gerarLink() {
    try {
      const r = await novoLinkFamilia(familia.id);
      setToken(r.token);
    } catch (e) {
      torrada(e.message || "Não foi possível gerar o link.", true);
    }
  }

  async function remover() {
    try {
      await desativarFamilia(familia.id);
      torrada("Família removida");
      onFechar();
    } catch (e) {
      torrada(e.message || "Não foi possível remover.", true);
    }
  }

  const codigoHoje = codigoFeito || codigo;
  const textoCodigo = `Olá! ${nomes} ${naSala.length + (codigoFeito ? escolhidas.size : 0) > 1 ? "já estão" : "já está"} no Kinder. Código para ir buscar: ${codigoHoje}`;
  const textoBoasVindas = `Olá ${primeiroNome(responsavel?.nome)}! Bem-vindos à Onda 💛 Obrigado por confiarem o Kinder à vossa família. Qualquer coisa, falem connosco.`;

  if (aEditar) {
    return (
      <>
        <div className="veu on" onClick={() => setAEditar(false)} />
        <div className="pin on" role="dialog" aria-modal="true">
          <div className="pux" />
          <h2>Corrigir ficha</h2>
          <FormFamilia
            inicial={{ ...familia, criancas }} podeEscolherSala salaFixa={restrita} aEnviar={aEnviar}
            onSubmeter={guardarFicha} onCancelar={() => setAEditar(false)} avisar={(m) => torrada(m, true)}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        {codigoFeito ? (
          <>
            <h2>Check-in feito</h2>
            <p className="sb2">Código para ir buscar</p>
            <p className="kin-codigo">{codigoFeito}</p>
            <p className="ds" style={{ textAlign: "center" }}>Diz o código aos pais — também aparece no link da família.</p>
            {responsavel?.telefone && (
              <a className="btn full" style={{ marginTop: 16, display: "block", textAlign: "center" }} href={linkWhatsApp(responsavel.telefone, textoCodigo)} target="_blank" rel="noreferrer">
                Enviar código por WhatsApp
              </a>
            )}
            {familia.visitante && responsavel?.telefone && (
              <a className="btn sec full" style={{ marginTop: 9, display: "block", textAlign: "center" }} href={linkWhatsApp(responsavel.telefone, textoBoasVindas)} target="_blank" rel="noreferrer">
                Dar boas-vindas
              </a>
            )}
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Concluir</button>
          </>
        ) : (
          <>
            <h2>{nomes || "Família"}</h2>
            <p className="sb2">{(familia.responsaveis || []).map((r) => r.nome).join(" · ")}</p>

            <div style={{ marginTop: 12 }}>
              {criancas.map((c) => {
                const ck = checkinPorCrianca[c.id];
                const dentro = ck && !ck.saidaEm;
                return (
                  <div className="opcao" key={c.id} style={{ cursor: dentro ? "default" : "pointer" }} onClick={() => !dentro && alternar(c.id)}>
                    <span style={{ flex: 1 }}>
                      <b style={{ fontSize: 15.5, fontWeight: 700 }}>{c.nome}</b>
                      <span style={{ display: "block", fontSize: 12, color: "var(--cinza)" }}>
                        {dentro ? `Na sala desde as ${hora(ck.entradaEm)}` : ck?.saidaEm ? `Saiu às ${hora(ck.saidaEm)}` : "Fora da sala"}
                      </span>
                      <Cuidados crianca={c} />
                    </span>
                    {c.categoria
                      ? <span className="kin-tagcat" style={varsCategoria(c.categoria)}>{nomeCategoria(c.categoria)}</span>
                      : <span className="kin-alerta">Sem sala</span>}
                    {!dentro && <span className={`chk${escolhidas.has(c.id) ? " on" : ""}`}>✓</span>}
                  </div>
                );
              })}
            </div>

            {foraDaSala.length > 0 && (
              <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar} onClick={checkin}>
                {aEnviar ? "A registar…" : `Fazer check-in (${escolhidas.size})`}
              </button>
            )}
            {naSala.length > 0 && (
              <button className="btn sec full" style={{ marginTop: 9 }} onClick={onSaida}>
                Dar saída{codigo ? ` · código ${codigo}` : ""}
              </button>
            )}

            <p className="rot" style={{ marginTop: 18 }}>Contactos</p>
            {(familia.responsaveis || []).map((r, i) => (
              <div className="linha" key={i}>
                <div style={{ flex: 1 }}>
                  <p className="nmt">{r.nome}</p>
                  <p className="ds">{[r.parentesco, r.telefone].filter(Boolean).join(" · ")}</p>
                </div>
                {r.telefone && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <a className="btn sec" style={{ padding: "7px 12px", fontSize: 12.5 }} href={`tel:${r.telefone.replace(/\s/g, "")}`}>Ligar</a>
                    <a
                      className="btn sec" aria-label={`WhatsApp para ${r.nome}`} title="WhatsApp"
                      style={{ padding: "7px 10px", display: "flex", alignItems: "center" }}
                      href={linkWhatsApp(r.telefone)} target="_blank" rel="noreferrer"
                    >
                      <IconeWhatsApp />
                    </a>
                  </div>
                )}
              </div>
            ))}
            {familia.autorizados?.length > 0 && (
              <p className="ds" style={{ marginTop: 6 }}>Podem ir buscar: {familia.autorizados.map((a) => `${a.nome}${a.parentesco ? ` (${a.parentesco})` : ""}`).join(", ")}</p>
            )}
            {!familia.fotoAutorizada && <p className="ds" style={{ marginTop: 6 }}><span className="kin-alerta info">Sem autorização para fotografias</span></p>}

            {token ? (
              <div className="caixa" style={{ marginTop: 14 }}>
                <p className="nmt" style={{ fontSize: 14 }}>Link da família</p>
                <p style={{ fontSize: 12, wordBreak: "break-all", color: "var(--azul)", marginTop: 4 }}>{linkFamilia(token)}</p>
                {responsavel?.telefone && (
                  <a className="btn full" style={{ marginTop: 10, display: "block", textAlign: "center" }}
                    href={linkWhatsApp(responsavel.telefone, `Olá! Este é o link da vossa família no Kinder da Onda — guardem-no no telemóvel: ${linkFamilia(token)}`)}
                    target="_blank" rel="noreferrer">
                    Enviar por WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <button className="btn sec full" style={{ marginTop: 14 }} onClick={gerarLink}>Gerar novo link da família</button>
            )}
            {!token && <p className="ds" style={{ marginTop: 6 }}>O link antigo deixa de funcionar.</p>}

            <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => setAEditar(true)}>Corrigir ficha</button>
            {lider && (aConfirmarRemover ? (
              <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 9 }}>
                <p style={{ fontSize: 13, fontWeight: 600 }}>Remover esta família?</p>
                <p className="ds" style={{ marginTop: 4 }}>Deixa de aparecer no check-in. O histórico dos domingos fica.</p>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn" style={{ flex: 1, background: "var(--magenta)" }} onClick={remover}>Remover</button>
                  <button className="btn sec" style={{ flex: 1 }} onClick={() => setAConfirmarRemover(false)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={() => setAConfirmarRemover(true)}>Remover família</button>
            ))}
            <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
          </>
        )}
      </div>
    </>
  );
}
