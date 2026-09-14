import { useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { linkWhatsApp } from "@portal/shared/lib/data.js";
import FotoRedonda from "@portal/shared/components/FotoRedonda.jsx";
import { darSaida, anularCheckin, lerConteudoQR, hora } from "../../lib/kinder";
import LeitorQR from "../LeitorQR";
import { Cuidados } from "../../pages/Checkin";

/**
 * Saída: quem veio buscar (responsáveis e autorizados da ficha, ou
 * outra pessoa) + o código do dia. Sem código, só uma líder — ou a
 * Mestra da sala neste culto (`podeForcarSaida`, ver Checkin.jsx) — e
 * com o motivo, que fica registado. Daqui também se chama os pais
 * (WhatsApp ou telefone) quando é preciso irem buscar a criança mais
 * cedo.
 */
export default function SheetSaida({ familia, criancas, checkinPorCrianca, criancaInicial, codigoInicial, uid, lider, podeForcarSaida, onFechar }) {
  const torrada = useTorrada();
  const naSala = criancas.filter((c) => checkinPorCrianca[c.id] && !checkinPorCrianca[c.id].saidaEm);
  const [escolhidas, setEscolhidas] = useState(() => new Set(criancaInicial ? [criancaInicial] : naSala.map((c) => c.id)));
  const [quem, setQuem] = useState("");
  const [outro, setOutro] = useState("");
  const [codigo, setCodigo] = useState(codigoInicial ?? "");
  const [semCodigo, setSemCodigo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [aLer, setALer] = useState(false);
  const pessoas = [...(familia.responsaveis || []), ...(familia.autorizados || [])];
  const responsavel = familia.responsaveis?.[0];

  function alternar(id) {
    setEscolhidas((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function sair() {
    const levantadoPor = quem === "__outro" ? outro.trim() : quem;
    if (!escolhidas.size) return torrada("Escolhe pelo menos uma criança.");
    if (!levantadoPor) return torrada("Diz quem veio buscar.");
    if (!semCodigo && codigo.trim().length !== 4) return torrada("O código tem 4 caracteres.");
    if (semCodigo && !motivo.trim()) return torrada("Diz porque sai sem código.");
    setAEnviar(true);
    try {
      await darSaida({
        criancaIds: [...escolhidas], levantadoPor,
        ...(semCodigo ? { motivo: motivo.trim() } : { codigo: codigo.trim().toUpperCase() }),
      });
      torrada(escolhidas.size > 1 ? "Saída registada" : `${criancas.find((c) => escolhidas.has(c.id))?.nome.split(" ")[0]} saiu`);
      onFechar();
    } catch (e) {
      torrada(e.message || "Não foi possível dar a saída.", true);
      setAEnviar(false);
    }
  }

  async function anular(c) {
    try {
      await anularCheckin(c.id);
      torrada(`Check-in de ${c.nome.split(" ")[0]} anulado`);
      if (naSala.length <= 1) onFechar();
    } catch (e) {
      torrada(e.message || "Não foi possível anular.", true);
    }
  }

  function aoLer(texto) {
    setALer(false);
    const lido = lerConteudoQR(texto);
    if (!lido || lido.familiaId !== familia.id) return torrada("Esse QR não é desta família.", true);
    if (!lido.codigo) return torrada("Esse QR ainda não tem o código de hoje — pede aos pais para atualizarem o link.", true);
    setCodigo(lido.codigo);
    setSemCodigo(false);
  }

  if (aLer) return <LeitorQR titulo="Ler QR de saída" onLido={aoLer} onFechar={() => setALer(false)} />;

  const nomesNaSala = naSala.map((c) => c.nome.split(" ")[0]).join(" e ");

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>Saída</h2>
        <p className="sb2">{(familia.responsaveis || []).map((r) => r.nome).join(" · ")}</p>

        {naSala.length === 0 && <div className="vaz" style={{ marginTop: 12 }}>Nenhuma criança desta família está na sala.</div>}
        <div style={{ marginTop: 12 }}>
          {naSala.map((c) => (
            <div className="opcao" key={c.id} style={{ cursor: "pointer" }} onClick={() => alternar(c.id)}>
              <FotoRedonda src={c.foto?.url} alt={c.nome} />
              <span style={{ flex: 1 }}>
                <b style={{ fontSize: 15.5, fontWeight: 700 }}>{c.nome}</b>
                <span style={{ display: "block", fontSize: 12, color: "var(--cinza)" }}>Entrou às {hora(checkinPorCrianca[c.id].entradaEm)}</span>
                <Cuidados crianca={c} />
              </span>
              <span className={`chk${escolhidas.has(c.id) ? " on" : ""}`}>✓</span>
            </div>
          ))}
        </div>

        {naSala.length > 0 && (
          <>
            <label className="rot">Quem veio buscar</label>
            <div className="subtabs" style={{ flexWrap: "wrap" }}>
              {pessoas.map((p, i) => (
                <button key={i} data-on={quem === p.nome ? 1 : 0} style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => setQuem(p.nome)}>
                  <FotoRedonda src={p.foto?.url} alt={p.nome} tamanho={22} />
                  {p.nome}{p.parentesco ? ` · ${p.parentesco}` : ""}
                </button>
              ))}
              <button data-on={quem === "__outro" ? 1 : 0} onClick={() => setQuem("__outro")}>Outra pessoa</button>
            </div>
            {quem === "__outro" && (
              <>
                <input className="campo" style={{ marginTop: 8 }} value={outro} onChange={(e) => setOutro(e.target.value)} placeholder="Nome de quem veio" />
                <p className="ds"><span className="kin-alerta">Não está na ficha — confirma com os pais antes de entregar.</span></p>
              </>
            )}

            {!semCodigo ? (
              <>
                <label className="rot">Código</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="campo" style={{ flex: 1, margin: 0, fontSize: 22, letterSpacing: ".2em", textTransform: "uppercase", textAlign: "center", fontWeight: 800 }}
                    value={codigo} maxLength={4} autoCapitalize="characters" autoComplete="off"
                    onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="····"
                  />
                  <button className="btn sec" onClick={() => setALer(true)}>Ler QR</button>
                </div>
              </>
            ) : (
              <>
                <label className="rot">Porque sai sem código</label>
                <input className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: mãe sem bateria, confirmei por telefone" />
              </>
            )}
            {podeForcarSaida && (
              <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => setSemCodigo((v) => !v)}>
                {semCodigo ? "Afinal tem código" : "Saída sem código"}
              </button>
            )}

            <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar} onClick={sair}>
              {aEnviar ? "A registar…" : "Dar saída"}
            </button>
          </>
        )}

        {responsavel?.telefone && naSala.length > 0 && (
          <>
            <p className="rot" style={{ marginTop: 18 }}>Chamar os pais</p>
            <div style={{ display: "flex", gap: 8 }}>
              <a className="btn sec" style={{ flex: 1, textAlign: "center" }} target="_blank" rel="noreferrer"
                href={linkWhatsApp(responsavel.telefone, `Olá ${responsavel.nome.split(" ")[0]}, daqui é o Kinder. Pode vir à sala por causa de ${nomesNaSala}? Obrigado!`)}>
                WhatsApp
              </a>
              <a className="btn sec" style={{ flex: 1, textAlign: "center" }} href={`tel:${responsavel.telefone.replace(/\s/g, "")}`}>Ligar</a>
            </div>
            <p className="ds" style={{ marginTop: 6 }}>Para o telão, usa Culto → Chamadas.</p>
          </>
        )}

        {naSala.filter((c) => lider || checkinPorCrianca[c.id].entradaPor === uid).map((c) => (
          <button key={c.id} className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={() => anular(c)}>
            Anular check-in de {c.nome.split(" ")[0]} (foi engano)
          </button>
        ))}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
