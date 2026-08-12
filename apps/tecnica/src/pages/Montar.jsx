import { useEffect, useState } from "react";
import { ouvirVoluntarios, ouvirMinisterios } from "../lib/painel";
import { ouvirEnqueteAberta, ouvirRespostas, obterEventosPorIds, fecharEnquete, textoWhatsApp, linkWhatsApp } from "../lib/enquetes";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso, dataCurta, MESES } from "@portal/shared/lib/data.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import SheetAbrirEnquete from "../components/painel/SheetAbrirEnquete";

const telefoneWa = (t) => "351" + String(t || "").replace(/\D/g, "").replace(/^351/, "");
const NIVEL_TXT = { titular: "Titular", aprendiz: "Em treino" };

/** Uma resposta com o nome + o resumo (ministério/nível, se vier de
 *  um grupo) + os mini-cartões coloridos por domingo. */
function LinhaResposta({ pessoa, resposta: r, domingos, eventosPorId, rotulo }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--fio)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <Avatar pessoa={pessoa} tamanho={34} fonte={13} />
        <div style={{ flex: 1 }}>
          <p className="nmt">{pessoa.nome}</p>
          <p className="ds">
            {rotulo ? `${rotulo} · ` : ""}
            {r.semIndisponibilidade
              ? "Sem indisponibilidades"
              : `Indisponível em ${r.indisponivelEm.length} culto${r.indisponivelEm.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8, marginLeft: 47 }}>
        {(domingos || []).map((id) => {
          const ev = eventosPorId[id];
          const indisponivel = !r.semIndisponibilidade && (r.indisponivelEm || []).includes(id);
          return (
            <span
              key={id}
              style={{
                fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 100, color: "#fff",
                background: indisponivel ? "var(--magenta)" : "var(--verde)",
              }}
            >
              {dataCurta(ev?.data || id)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function Montar({ ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const hoje = new Date();
  const [voluntarios, setVoluntarios] = useState([]);
  const [ministerios, setMinisterios] = useState([]);
  const [enquete, setEnquete] = useState(undefined); // undefined = ainda a carregar
  const [respostas, setRespostas] = useState([]);
  const [eventosPorId, setEventosPorId] = useState({});
  const [sheet, setSheet] = useState(null);
  const [aFechar, setAFechar] = useState(false);

  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirMinisterios(setMinisterios), []);
  useEffect(() => ouvirEnqueteAberta(setEnquete), []);
  useEffect(() => {
    if (!enquete) { setRespostas([]); return; }
    return ouvirRespostas(enquete.id, setRespostas);
  }, [enquete]);
  useEffect(() => {
    if (!enquete?.domingos?.length) { setEventosPorId({}); return; }
    obterEventosPorIds(enquete.domingos).then(setEventosPorId);
  }, [enquete]);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Montar",
      subtitulo: "Enquete e escala do mês",
      chips: enquete ? [`${respostas.length} de ${voluntarios.length} responderam`] : [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, enquete, respostas.length, voluntarios.length]);

  const semEnqueteParaOMesQueVem = !enquete && hoje.getDate() >= 15;
  const responderamIds = new Set(respostas.map((r) => r.id));
  const naoResponderam = voluntarios.filter((p) => !responderamIds.has(p.id));

  // agrupadas por ministério — quem serve em mais do que um (ex.: o
  // Responsável acumula) aparece num grupo por cada um deles
  const respostasComPessoa = respostas
    .map((r) => ({ resposta: r, pessoa: voluntarios.find((p) => p.id === r.id) }))
    .filter((x) => x.pessoa);
  const gruposMinisterio = ministerios
    .map((m) => ({ ministerio: m, itens: respostasComPessoa.filter((x) => x.pessoa.ministerios?.[m.id]) }))
    .filter((g) => g.itens.length);
  const semMinisterio = respostasComPessoa.filter((x) => !ministerios.some((m) => x.pessoa.ministerios?.[m.id]));

  async function fechar() {
    if (!enquete) return;
    setAFechar(true);
    try {
      await fecharEnquete(enquete.id);
      torrada("Enquete fechada");
    } catch (e) {
      torrada(e.message || "Não foi possível fechar a enquete.");
    } finally {
      setAFechar(false);
    }
  }

  async function copiarTexto() {
    try {
      await navigator.clipboard.writeText(textoWhatsApp(enquete.id, enquete.prazo));
      torrada("Texto copiado");
    } catch {
      torrada("Não foi possível copiar — copia manualmente.");
    }
  }

  function lembrar(pessoa) {
    const texto = `Olá ${pessoa.nome.split(" ")[0]}, ainda não recebi a tua resposta à enquete de indisponibilidades. Podes responder no Início do portal? 🙏`;
    window.open(`https://wa.me/${telefoneWa(pessoa.telefone)}?text=${encodeURIComponent(texto)}`, "_blank");
  }

  return (
    <>
      <div className="sect">
        {enquete === undefined && <div className="vaz">A carregar…</div>}

        {enquete === null && (
          <>
            {semEnqueteParaOMesQueVem && (
              <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--magenta)" }}>Ainda não há enquete para o mês que vem</p>
                <p className="ds" style={{ marginTop: 4 }}>Já passou o dia 15 — é boa altura para abrir.</p>
              </div>
            )}
            <div className="cabecalho">
              <h3>Enquete de indisponibilidade</h3>
            </div>
            <div className="vaz">Nenhuma enquete aberta agora.</div>
            <button className="btn full" style={{ marginTop: 12 }} onClick={() => setSheet({ tipo: "abrirEnquete" })}>
              Abrir enquete
            </button>
          </>
        )}

        {enquete && (
          <>
            <div className="cabecalho">
              <h3>Enquete de {MESES[Number(enquete.id.split("-")[1]) - 1]}</h3>
              <span className="tag lim">aberta</span>
            </div>
            <p className="ds" style={{ padding: "6px 0 2px" }}>Prazo até {dataPorExtenso(enquete.prazo)}</p>
            <p className="ds">
              {(enquete.domingos || []).map((id) => eventosPorId[id]?.tipo || dataPorExtenso(eventosPorId[id]?.data || id)).join(" · ")}
            </p>

            <div className="caixa" style={{ marginTop: 12 }}>
              <p className="cap">Texto pronto para o WhatsApp</p>
              <p style={{ marginTop: 8, lineHeight: 1.6, fontSize: 13.5 }}>{textoWhatsApp(enquete.id, enquete.prazo)}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} onClick={copiarTexto}>Copiar texto</button>
                <a className="btn" style={{ flex: 1, fontSize: 12.5, textAlign: "center" }} href={linkWhatsApp(textoWhatsApp(enquete.id, enquete.prazo))} target="_blank" rel="noreferrer">
                  Abrir WhatsApp
                </a>
              </div>
            </div>

            <label className="rot" style={{ marginTop: 16 }}>Respondeu ({respostas.length}/{voluntarios.length})</label>
            {gruposMinisterio.map(({ ministerio: m, itens }) => (
              <div key={m.id}>
                <p className="cap" style={{ padding: "10px 0 2px", color: m.cor }}>{m.nome}</p>
                {itens.map(({ resposta: r, pessoa }) => (
                  <LinhaResposta
                    key={r.id} pessoa={pessoa} resposta={r} domingos={enquete.domingos} eventosPorId={eventosPorId}
                    rotulo={`${m.nome} · ${NIVEL_TXT[pessoa.ministerios?.[m.id]] ?? "sem nível"}`}
                  />
                ))}
              </div>
            ))}
            {semMinisterio.length > 0 && (
              <div>
                <p className="cap" style={{ padding: "10px 0 2px" }}>Sem ministério</p>
                {semMinisterio.map(({ resposta: r, pessoa }) => (
                  <LinhaResposta key={r.id} pessoa={pessoa} resposta={r} domingos={enquete.domingos} eventosPorId={eventosPorId} />
                ))}
              </div>
            )}

            {naoResponderam.length > 0 && (
              <>
                <label className="rot" style={{ marginTop: 16 }}>Ainda não respondeu ({naoResponderam.length})</label>
                {naoResponderam.map((p) => (
                  <div className="linha" key={p.id}>
                    <Avatar pessoa={p} tamanho={34} fonte={13} />
                    <div style={{ flex: 1 }}><p className="nmt">{p.nome}</p></div>
                    <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5 }} onClick={() => lembrar(p)}>Lembrar</button>
                  </div>
                ))}
              </>
            )}

            <button className="btn sec full" style={{ marginTop: 16, color: "var(--magenta)" }} disabled={aFechar} onClick={fechar}>
              {aFechar ? "A fechar…" : "Fechar enquete"}
            </button>
          </>
        )}
      </div>

      {sheet?.tipo === "abrirEnquete" && (
        <SheetAbrirEnquete
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}
