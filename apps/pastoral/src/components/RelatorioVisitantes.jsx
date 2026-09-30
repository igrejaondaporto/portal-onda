import { useMemo } from "react";
import { createPortal } from "react-dom";
import { Download } from "lucide-react";
import { dataCurta } from "@portal/shared/lib/data.js";
import Barras from "./Barras";
import { ETAPAS, dataDaVisita, indiceEtapa, nomeEtapa, nomeGD } from "../lib/contactos";
import { presencaDoCulto } from "../lib/presenca";

/**
 * O relatório de visitantes (pedido 2026-09: "relatório de visitante
 * no Painel Pastoral, filtrado por período — último mês, último culto,
 * 3 meses, etc."). Vive no topo de Pessoas → Visitantes; o período é o
 * mesmo que filtra o funil e a lista logo abaixo.
 *
 * Duas fontes que contam coisas diferentes, lado a lado e nunca
 * somadas: **no auditório** é quantos visitantes a Base Pessoal marcou
 * no Mapa (quem veio, deixasse contacto ou não); **deixaram contacto**
 * é quantos foram à salinha e ficaram no Formulário — os `contactos`,
 * com nome. A diferença entre as duas é quem veio e foi embora sem
 * ninguém lhe pegar.
 *
 * Exporta para PDF pelo mesmo caminho de Números (`RelatorioNumeros`):
 * uma folha de impressão sempre montada, que só sai com
 * `body[data-imprimir="visitantes"]`. Ao contrário de Números, leva
 * nomes — o relatório É a lista de quem apareceu —, mas nunca telefone
 * nem e-mail: um papel que circula numa reunião não é o sítio para
 * isso, e para ligar a alguém o painel está a um toque.
 */
export function exportarVisitantes() {
  const corpo = document.body;
  const limpar = () => { delete corpo.dataset.imprimir; };
  corpo.dataset.imprimir = "visitantes";
  window.addEventListener("afterprint", limpar, { once: true });
  window.print();
}

const dataPt = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
const localidade = (c) => [c.freguesia, c.concelho].filter(Boolean).join(", ") || "—";

export default function RelatorioVisitantes({ titulo, intervalo, cultos, contactos, carregando, erro }) {
  /** Culto a culto: os visitantes do Mapa e os contactos que ficaram
   *  desse culto. Entra um culto com qualquer uma das duas — um
   *  domingo sem Mapa mas com três contactos continua a contar. */
  const porCulto = useMemo(() => {
    const mapa = new Map();
    for (const c of cultos) {
      const v = presencaDoCulto(c).visitantes;
      mapa.set(c.eventoId, { chave: c.eventoId, data: c.data, auditorio: v, cadastrados: 0 });
    }
    for (const c of contactos) {
      if (!c.eventoId) continue;
      const linha = mapa.get(c.eventoId) ?? { chave: c.eventoId, data: dataDaVisita(c), auditorio: null, cadastrados: 0 };
      linha.cadastrados += 1;
      mapa.set(c.eventoId, linha);
    }
    return [...mapa.values()]
      .filter((l) => l.auditorio !== null || l.cadastrados > 0)
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [cultos, contactos]);

  const comMapa = porCulto.filter((l) => l.auditorio !== null);
  const noAuditorio = comMapa.length ? comMapa.reduce((t, l) => t + l.auditorio, 0) : null;
  const mediaAuditorio = comMapa.length ? Math.round(noAuditorio / comMapa.length) : null;
  const contactados = contactos.filter((c) => indiceEtapa(c.etapa) >= 1).length;
  const pctContactados = contactos.length ? Math.round((contactados / contactos.length) * 100) : null;

  /** De onde vêm, por concelho — o que decide para que GD
   *  encaminhar. "Sem localidade" fica sempre no fim. */
  const porConcelho = useMemo(() => {
    const mapa = new Map();
    for (const c of contactos) {
      const k = c.concelho || "Sem localidade";
      mapa.set(k, (mapa.get(k) ?? 0) + 1);
    }
    return [...mapa.entries()]
      .map(([rotulo, valor]) => ({ chave: rotulo, rotulo, valor }))
      .sort((a, b) => (a.chave === "Sem localidade") - (b.chave === "Sem localidade") || b.valor - a.valor);
  }, [contactos]);

  const porEtapa = ETAPAS.map((e) => ({ ...e, total: contactos.filter((c) => c.etapa === e.id).length }));
  const lista = useMemo(
    () => contactos.slice().sort((a, b) => (dataDaVisita(b) ?? "").localeCompare(dataDaVisita(a) ?? "")),
    [contactos],
  );

  return (
    <div className="sect" style={{ paddingTop: 14 }}>
      <div className="cabecalho" style={{ marginTop: 0 }}>
        <h3>Relatório</h3>
        <span className="cap">
          {intervalo[0] === intervalo[1] ? dataCurta(intervalo[0]) : `${dataCurta(intervalo[0])} a ${dataCurta(intervalo[1])}`}
        </span>
      </div>

      {erro && <p className="cap" style={{ marginTop: 0 }}>Os números do Mapa não carregaram ({erro}) — os contactos abaixo estão certos.</p>}

      <div className="nm-quatro" style={{ marginTop: 4 }}>
        <div>
          <p>No auditório</p>
          <b>{carregando ? "…" : noAuditorio ?? "—"}</b>
          <small>marcados no Mapa</small>
        </div>
        <div>
          <p>Deixaram contacto</p>
          <b>{contactos.length}</b>
          <small>no Formulário</small>
        </div>
        <div>
          <p>Média por culto</p>
          <b>{carregando ? "…" : mediaAuditorio ?? "—"}</b>
          <small>{comMapa.length ? `no auditório, ${comMapa.length} culto${comMapa.length === 1 ? "" : "s"}` : "no auditório"}</small>
        </div>
        <div>
          <p>Já contactados</p>
          <b>{pctContactados === null ? "—" : `${pctContactados}%`}</b>
          <small>{contactados} de {contactos.length}</small>
        </div>
      </div>

      {porCulto.length > 0 && (
        <div className="tabwrap" style={{ marginTop: 14 }}>
          <table className="tab nm-criancas">
            <thead><tr><th>Culto</th><th>No auditório</th><th>Contacto</th></tr></thead>
            <tbody>
              {porCulto.map((l) => (
                <tr key={l.chave}>
                  <td>{dataCurta(l.data)}</td>
                  <td>{l.auditorio ?? "—"}</td>
                  <td>{l.cadastrados || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {contactos.length > 0 && (
        <>
          <p className="cap" style={{ marginTop: 16 }}>De onde vêm</p>
          <Barras linhas={porConcelho} />
        </>
      )}

      <button className="btn sec full" style={{ marginTop: 14 }} onClick={exportarVisitantes} disabled={carregando}>
        <Download size={16} /> Exportar {titulo.toLowerCase()} (PDF)
      </button>

      {createPortal(
        <div className="pa-print pa-print-rel pa-print-vis" aria-hidden="true">
          <h1>Visitantes · {titulo}</h1>
          <p className="pa-print-sub">
            {dataPt(intervalo[0])}{intervalo[0] !== intervalo[1] ? ` a ${dataPt(intervalo[1])}` : ""} · Painel Pastoral,
            gerado a {dataPt(new Date().toLocaleDateString("sv-SE"))}
          </p>

          <h2>Resumo</h2>
          <table className="pa-print-tab pa-print-num">
            <tbody>
              <tr><td>Visitantes no auditório (Mapa)</td><td>{noAuditorio ?? "—"}</td></tr>
              <tr><td>Média no auditório por culto</td><td>{mediaAuditorio ?? "—"}</td></tr>
              <tr><td>Deixaram contacto (Formulário)</td><td>{contactos.length}</td></tr>
              <tr><td>Já contactados</td><td>{pctContactados === null ? "—" : `${contactados} (${pctContactados}%)`}</td></tr>
            </tbody>
          </table>

          {porCulto.length > 0 && (
            <>
              <h2>Culto a culto</h2>
              <table className="pa-print-tab pa-print-num">
                <thead><tr><th>Culto</th><th>No auditório</th><th>Deixaram contacto</th></tr></thead>
                <tbody>
                  {porCulto.map((l) => (
                    <tr key={l.chave}><td>{dataPt(l.data)}</td><td>{l.auditorio ?? "—"}</td><td>{l.cadastrados || "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {contactos.length > 0 && (
            <>
              <h2>Onde estão agora</h2>
              <table className="pa-print-tab pa-print-num">
                <tbody>
                  {porEtapa.map((e) => <tr key={e.id}><td>{e.nome}</td><td>{e.total || "—"}</td></tr>)}
                </tbody>
              </table>

              <h2>De onde vêm</h2>
              <table className="pa-print-tab pa-print-num">
                <tbody>
                  {porConcelho.map((l) => <tr key={l.chave}><td>{l.rotulo}</td><td>{l.valor}</td></tr>)}
                </tbody>
              </table>

              <h2>Quem deixou contacto</h2>
              <table className="pa-print-tab">
                <thead><tr><th>Nome</th><th>Culto</th><th>Localidade</th><th>Etapa</th><th>GD</th></tr></thead>
                <tbody>
                  {lista.map((c) => (
                    <tr key={c.id}>
                      <td>{c.nome}</td><td>{dataPt(dataDaVisita(c))}</td><td>{localidade(c)}</td>
                      <td>{nomeEtapa(c.etapa)}</td><td>{nomeGD(c) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <p className="pa-print-rodape">
            No auditório: visitantes marcados no Mapa (Base Pessoal). Deixaram contacto: Formulário da Base
            Pessoal, sem os arquivados. Sem telefones nem e-mails de propósito — estão no Painel Pastoral.
            "—" quer dizer que não foi contado, nunca zero.
          </p>
        </div>,
        document.body,
      )}
    </div>
  );
}
