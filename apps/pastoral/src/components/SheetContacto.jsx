import { useEffect, useState } from "react";
import {
  BASES_CANDIDATURA, ETAPAS, CORES_ETAPA, corTextoEtapa, diasParado, estadoServir, indiceEtapa, nomeEtapa, nomeGD, ouvirGDs,
} from "../lib/contactos";
import { arquivarContactoPastoral, enviarContactoParaServir, moverEtapaContacto } from "../lib/pastoral";
import { ouvirBases } from "../lib/bases";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataTimestamp, linkWhatsApp } from "@portal/shared/lib/data.js";

/**
 * Um visitante, e o caminho dele.
 *
 * Mover de etapa é a única escrita que o Painel Pastoral faz num dado
 * de outra base — e passa por Cloud Function (`moverEtapaContacto`),
 * não por escrita direta, porque o histórico tem de ficar gravado na
 * mesma escrita. Uma regra do Firestore não garante isso.
 *
 * Andar para trás é permitido de propósito: quem foi marcado como
 * "Membro" por engano tem de poder voltar, e o histórico regista as
 * duas direções — não se perde nada ao corrigir.
 *
 * O botão de WhatsApp não muda nada no sistema: abre a conversa com a
 * pessoa. É o mesmo padrão que a líder da Base Pessoal já usa para
 * "entregar" os contactos à mão — só que agora, depois de falar, há
 * onde registar que se falou.
 */
const ROTULO_ESTADO_BASE = { pendente: "à espera", recusada: "agora não", cancelada: "cancelado", aprovada: "aprovado" };

export default function SheetContacto({ contacto, onFechar }) {
  const torrada = useTorrada();
  const [aGuardar, setAGuardar] = useState(false);
  const [aArquivar, setAArquivar] = useState(false);
  // passar para "No GD" pergunta primeiro qual (pedido 2026-09) — a
  // lista só é pedida quando é precisa
  const [escolherGD, setEscolherGD] = useState(false);
  const [gds, setGds] = useState(null);
  const atual = contacto.etapa ?? "visita";
  const dias = diasParado(contacto);
  const wa = linkWhatsApp(contacto.telemovel);
  const gdAtual = nomeGD(contacto);

  useEffect(() => (escolherGD ? ouvirGDs(setGds) : undefined), [escolherGD]);

  // passar para "Quer servir" pergunta primeiro a que base(s) — o
  // pedido vai aos líderes (functions/candidaturas.js), e o estado
  // volta no próprio contacto (`servir`)
  const [escolherBases, setEscolherBases] = useState(false);
  const [bases, setBases] = useState(null);
  const [escolha, setEscolha] = useState([]); // [1.ª, 2.ª?]
  useEffect(() => (escolherBases ? ouvirBases(setBases) : undefined), [escolherBases]);
  const servir = estadoServir(contacto);
  const aguardando = contacto.servir?.estado === "aguardando";

  function abrirEscolherBases() {
    setEscolherGD(false);
    setEscolha(aguardando ? (contacto.servir.bases ?? []).filter((b) => b.estado === "pendente").map((b) => b.baseId) : []);
    setEscolherBases(true);
  }

  /** Um toque escolhe a 1.ª, o seguinte a 2.ª; tocar numa escolhida tira-a. */
  function alternarBase(id) {
    setEscolha((e) => (e.includes(id) ? e.filter((x) => x !== id) : e.length >= 2 ? [e[0], id] : [...e, id]));
  }

  async function enviarAosLideres() {
    if (!escolha.length) return;
    setAGuardar(true);
    try {
      await enviarContactoParaServir(contacto.id, escolha);
      torrada(`${contacto.nome} → enviado a ${escolha.map((b) => bases?.[b]?.nome ?? b).join(" e ")}`);
      setEscolherBases(false);
    } catch (e) {
      torrada(e.message || "Não foi possível enviar.");
    } finally {
      setAGuardar(false);
    }
  }

  async function mover(etapa, gdId) {
    if (etapa === atual && !gdId) return;
    if (aguardando && etapa !== "voluntario"
      && !window.confirm(`${contacto.nome} tem um pedido à espera nas bases. Ao mover, o pedido sai do Início dos líderes. Continuar?`)) return;
    setAGuardar(true);
    try {
      await moverEtapaContacto(contacto.id, etapa, null, gdId);
      const gd = gdId ? gds?.find((g) => g.id === gdId)?.nome : null;
      torrada(`${contacto.nome} → ${nomeEtapa(etapa)}${gd ? ` · ${gd}` : ""}`);
      setEscolherGD(false);
    } catch (e) {
      torrada(e.message || "Não foi possível mover.");
    } finally {
      setAGuardar(false);
    }
  }

  /** "Excluir" nunca é um delete a sério (regra 5 do CLAUDE.md raiz) —
   *  arquiva, o mesmo campo que a Base Pessoal já usa no Formulário
   *  dela. `ouvirContactos` já filtra `arquivado`, por isso a lista
   *  perde este contacto sozinha assim que a escrita chegar. */
  async function arquivar() {
    if (!window.confirm(`Excluir ${contacto.nome} do funil? Não aparece mais em lado nenhum, mas o registo fica guardado.`)) return;
    setAArquivar(true);
    try {
      await arquivarContactoPastoral(contacto.id);
      torrada(`${contacto.nome} excluído do funil`);
      onFechar();
    } catch (e) {
      torrada(e.message || "Não foi possível excluir.");
      setAArquivar(false);
    }
  }

  const historico = Array.isArray(contacto.historicoEtapas) ? [...contacto.historicoEtapas].reverse() : [];

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{contacto.nome}</h2>
        <p className="sb2">
          <span className="quadmin" style={{ background: CORES_ETAPA[atual] }} />
          {nomeEtapa(atual)}
          {dias !== null && ` · há ${dias} dia${dias === 1 ? "" : "s"}`}
        </p>

        {(contacto.freguesia || contacto.concelho) && (
          <>
            <label className="rot" style={{ marginTop: 14 }}>Onde mora</label>
            <p className="ds">{[contacto.freguesia, contacto.concelho].filter(Boolean).join(", ")}</p>
          </>
        )}

        {gdAtual && (
          <>
            <label className="rot" style={{ marginTop: 12 }}>Vai ao GD</label>
            <p className="ds" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <b style={{ color: "var(--tinta)" }}>{gdAtual}</b>
              {atual === "gd" && (
                <button className="btn sec" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setEscolherGD(true)}>
                  Trocar
                </button>
              )}
            </p>
          </>
        )}

        {contacto.gdSugerido && contacto.gdSugerido !== gdAtual && (
          <>
            <label className="rot" style={{ marginTop: 12 }}>GD mais próximo</label>
            <p className="ds">{contacto.gdSugerido}</p>
          </>
        )}

        <label className="rot" style={{ marginTop: 12 }}>Chegou</label>
        <p className="ds">
          {dataTimestamp(contacto.criadoEm)}
          {contacto.eventoId ? ` · no culto de ${contacto.eventoId}` : ""}
        </p>

        {/* o que a Base Pessoal escreveu no Formulário (pedido 2026-09:
            "quantas pessoas tinham, se tem algo mais a dizer") */}
        {contacto.observacoes && (
          <>
            <label className="rot" style={{ marginTop: 12 }}>Observações</label>
            <p className="ds" style={{ whiteSpace: "pre-line" }}>{contacto.observacoes}</p>
          </>
        )}

        {contacto.telemovel && (
          <>
            <label className="rot" style={{ marginTop: 12 }}>Contacto</label>
            <p className="ds">{contacto.telemovel}</p>
          </>
        )}

        {wa && (
          <a className="btn sec full" href={wa} target="_blank" rel="noreferrer" style={{ marginTop: 14, display: "block", textAlign: "center" }}>
            Falar por WhatsApp
          </a>
        )}

        {servir && (
          <>
            <label className="rot" style={{ marginTop: 14 }}>Quer servir</label>
            <p className={`pa-servir ${servir.classe}`}>{servir.icone} {servir.texto}</p>
            {(contacto.servir.bases ?? []).length > 0 && contacto.servir.estado !== "aprovada" && (
              <p className="ds" style={{ marginTop: 4 }}>
                {contacto.servir.bases.map((b) => `${b.opcao}.ª ${b.nome}: ${ROTULO_ESTADO_BASE[b.estado] ?? b.estado}`).join(" · ")}
              </p>
            )}
            {contacto.servir.estado !== "aprovada" && !escolherBases && (
              <button className="btn sec" style={{ marginTop: 8, padding: "7px 14px", fontSize: 12.5 }} onClick={abrirEscolherBases}>
                {aguardando ? "Trocar as bases" : "Escolher outra base"}
              </button>
            )}
          </>
        )}

        <label className="rot" style={{ marginTop: 18 }}>Mover para</label>
        <div className="pa-etapas">
          {ETAPAS.map((e) => {
            const i = indiceEtapa(e.id);
            const iAtual = indiceEtapa(atual);
            return (
              <button
                key={e.id}
                className={`pa-etapa${e.id === atual ? " on" : ""}${i < iAtual ? " feita" : ""}`}
                style={e.id === atual ? { background: CORES_ETAPA[e.id], borderColor: CORES_ETAPA[e.id], color: corTextoEtapa(e.id) } : undefined}
                disabled={aGuardar || e.id === atual}
                onClick={() => (e.id === "gd" ? (setEscolherBases(false), setEscolherGD(true)) : e.id === "voluntario" ? abrirEscolherBases() : mover(e.id))}
              >
                {e.nome}
              </button>
            );
          })}
        </div>

        {escolherGD && (
          <div className="pa-escolher-gd">
            <p className="nmt" style={{ fontSize: 14 }}>Em que GD ficou?</p>
            {gds === null ? <p className="ds">A carregar os GDs…</p> : gds.length === 0 ? (
              <p className="ds">Ainda não há GDs no catálogo — a líder da Base Pessoal é quem os cria.</p>
            ) : (
              <div className="pa-etapas" style={{ marginTop: 8 }}>
                {gds.map((g) => (
                  <button
                    key={g.id}
                    className={`pa-etapa${contacto.gd?.id === g.id ? " on" : ""}${g.nome === contacto.gdSugerido ? " sugerido" : ""}`}
                    disabled={aGuardar || contacto.gd?.id === g.id}
                    onClick={() => mover("gd", g.id)}
                  >
                    {g.nome}{g.regiao ? ` · ${g.regiao}` : ""}
                  </button>
                ))}
              </div>
            )}
            {contacto.gdSugerido && <p className="cap" style={{ marginTop: 6 }}>Sugerido no Formulário: {contacto.gdSugerido}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {atual !== "gd" && (
                <button className="btn sec" style={{ flex: 1 }} disabled={aGuardar} onClick={() => mover("gd")}>
                  Sem escolher agora
                </button>
              )}
              <button className="btn sec" style={{ flex: 1 }} onClick={() => setEscolherGD(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {escolherBases && (
          <div className="pa-escolher-gd">
            <p className="nmt" style={{ fontSize: 14 }}>Em que base quer servir?</p>
            <p className="ds" style={{ marginTop: 2 }}>
              Toca na 1.ª e, se quiseres, numa 2.ª. Os dois líderes recebem o pedido ao mesmo tempo — o primeiro a aprovar
              fica com a pessoa, e o pedido do outro some.
            </p>
            {bases === null ? <p className="ds">A carregar as bases…</p> : (
              <div className="pa-etapas" style={{ marginTop: 8 }}>
                {BASES_CANDIDATURA.filter((id) => bases[id]).sort((a, b) => bases[a].nome.localeCompare(bases[b].nome, "pt")).map((id) => {
                  const i = escolha.indexOf(id);
                  return (
                    <button
                      key={id} className={`pa-etapa${i === 0 ? " on" : i === 1 ? " segunda" : ""}`}
                      aria-pressed={i >= 0} disabled={aGuardar} onClick={() => alternarBase(id)}
                    >
                      {i >= 0 && <b className="pa-opcao">{i + 1}.ª</b>}{bases[id].nome}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn" style={{ flex: 1 }} disabled={aGuardar || !escolha.length} onClick={enviarAosLideres}>
                {aGuardar ? "A enviar…" : escolha.length === 2 ? "Enviar aos dois líderes" : "Enviar ao líder"}
              </button>
              <button className="btn sec" style={{ flex: "none" }} onClick={() => setEscolherBases(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {historico.length > 0 && (
          <>
            <label className="rot" style={{ marginTop: 18 }}>O caminho até aqui</label>
            {historico.map((h, i) => (
              <p className="ds" key={i} style={{ marginTop: i === 0 ? 4 : 2 }}>
                {h.de === h.para ? `Trocou de GD` : `${nomeEtapa(h.de)} → ${nomeEtapa(h.para)}`}
                {h.gd ? ` (${h.gd})` : ""}{h.nota ? ` — ${h.nota}` : ""} · {String(h.em ?? "").slice(0, 10)}
              </p>
            ))}
          </>
        )}

        <button className="btn sec full" style={{ marginTop: 18, color: "var(--magenta)" }} disabled={aArquivar} onClick={arquivar}>
          {aArquivar ? "A excluir…" : "Excluir do funil"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
