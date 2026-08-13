import { useEffect, useState } from "react";
import { ouvirVoluntarios, ouvirMinisterios } from "../lib/painel";
import { ouvirEnquetesMontar, ouvirUltimasEnquetes, ouvirRespostas, obterEventosPorIds, fecharEnquete, reabrirEnquete, textoWhatsApp, linkWhatsApp } from "../lib/enquetes";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { dataPorExtenso, dataCurta, MESES } from "@portal/shared/lib/data.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import SheetAbrirEnquete from "../components/painel/SheetAbrirEnquete";
import SheetPessoa from "../components/painel/SheetPessoa";
import SheetRemoverPessoa from "../components/painel/SheetRemoverPessoa";
import SugestorEscala from "../components/painel/SugestorEscala";

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

/** Um mês de enquete — respostas agrupadas por ministério, quem falta
 *  responder, e o botão de fechar. A exclusão vive só na Escala
 *  sugerida (não faz sentido repetir o botão aqui também). */
function CartaoEnquete({ enquete, voluntarios, ministerios, eventosPorId }) {
  const torrada = useTorrada();
  const [respostas, setRespostas] = useState([]);
  const [aFechar, setAFechar] = useState(false);
  const [aReabrir, setAReabrir] = useState(false);
  const fechada = enquete.estado === "fechada";

  useEffect(() => ouvirRespostas(enquete.id, setRespostas), [enquete.id]);

  const responderamIds = new Set(respostas.map((r) => r.id));
  const naoResponderam = voluntarios.filter((p) => !responderamIds.has(p.id));
  const respostasComPessoa = respostas
    .map((r) => ({ resposta: r, pessoa: voluntarios.find((p) => p.id === r.id) }))
    .filter((x) => x.pessoa);
  // titulares sempre acima de quem está em treino, dentro do ministério
  const ORDEM_NIVEL = { titular: 0, aprendiz: 1 };
  const gruposMinisterio = ministerios
    .map((m) => ({
      ministerio: m,
      itens: respostasComPessoa
        .filter((x) => x.pessoa.ministerios?.[m.id])
        .sort((a, b) => (ORDEM_NIVEL[a.pessoa.ministerios[m.id]] ?? 9) - (ORDEM_NIVEL[b.pessoa.ministerios[m.id]] ?? 9)),
    }))
    .filter((g) => g.itens.length);
  const semMinisterio = respostasComPessoa.filter((x) => !ministerios.some((m) => x.pessoa.ministerios?.[m.id]));

  async function fechar() {
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

  async function reabrir() {
    setAReabrir(true);
    try {
      await reabrirEnquete(enquete.id);
      torrada("Enquete reaberta");
    } catch (e) {
      torrada(e.message || "Não foi possível reabrir a enquete.");
    } finally {
      setAReabrir(false);
    }
  }

  function lembrar(pessoa) {
    const texto = `Olá ${pessoa.nome.split(" ")[0]}, ainda não recebi a tua resposta à enquete de indisponibilidades. Podes responder no Início do portal? 🙏`;
    window.open(`https://wa.me/${telefoneWa(pessoa.telefone)}?text=${encodeURIComponent(texto)}`, "_blank");
  }

  return (
    <div className="caixa" style={{ marginTop: 14 }}>
      <div className="cabecalho">
        <h3>Enquete de {MESES[Number(enquete.id.split("-")[1]) - 1]}</h3>
        <span className={`tag ${fechada ? "cinz" : "lim"}`}>{fechada ? "fechada" : "aberta"}</span>
      </div>
      <p className="ds" style={{ padding: "6px 0 2px" }}>Prazo até {dataPorExtenso(enquete.prazo)}</p>
      <p className="ds">
        {(enquete.domingos || []).map((id) => eventosPorId[id]?.tipo || dataPorExtenso(eventosPorId[id]?.data || id)).join(" · ")}
      </p>

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

      {fechada ? (
        <button className="btn sec full" style={{ marginTop: 16 }} disabled={aReabrir} onClick={reabrir}>
          {aReabrir ? "A reabrir…" : "🔒 Reabrir"}
        </button>
      ) : (
        <button className="btn sec full" style={{ marginTop: 16 }} disabled={aFechar} onClick={fechar}>
          {aFechar ? "A fechar…" : "Fechar enquete"}
        </button>
      )}
    </div>
  );
}

/** As últimas 3 enquetes, mesmo já com escala publicada — uma linha
 *  compacta cada, expande ao tocar (reaproveita o CartaoEnquete) e
 *  tem "Ocultar" para fechar de novo sem perder a linha. */
function UltimasEnquetes({ voluntarios, ministerios }) {
  const [enquetes, setEnquetes] = useState([]);
  const [eventosPorId, setEventosPorId] = useState({});
  const [expandida, setExpandida] = useState(null);

  useEffect(() => ouvirUltimasEnquetes(3, setEnquetes), []);
  useEffect(() => {
    const ids = [...new Set(enquetes.flatMap((e) => e.domingos || []))];
    if (!ids.length) { setEventosPorId({}); return; }
    obterEventosPorIds(ids).then(setEventosPorId);
  }, [enquetes]);

  if (!enquetes.length) return null;

  return (
    <div className="sect">
      <div className="cabecalho"><h3>Últimas enquetes</h3></div>
      {enquetes.map((e) => {
        const aberta = expandida === e.id;
        return (
          <div key={e.id}>
            <div className="linha" style={{ cursor: "pointer" }} onClick={() => setExpandida(aberta ? null : e.id)}>
              <div style={{ flex: 1 }}>
                <p className="nmt">Enquete de {MESES[Number(e.id.split("-")[1]) - 1]}</p>
                <p className="ds">{e.estado === "aberta" ? "Aberta" : "Fechada"} · prazo {dataPorExtenso(e.prazo)}</p>
              </div>
              <span className="seta">{aberta ? "︿" : "›"}</span>
            </div>
            {aberta && (
              <>
                <CartaoEnquete enquete={e} voluntarios={voluntarios} ministerios={ministerios} eventosPorId={eventosPorId} />
                <button className="btn sec full" style={{ marginTop: 9 }} onClick={() => setExpandida(null)}>Ocultar</button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Montar({ ativo, definirCabecalho }) {
  const torrada = useTorrada();
  const hoje = new Date();
  const [voluntarios, setVoluntarios] = useState([]);
  const [ministerios, setMinisterios] = useState([]);
  const [enquetesMontar, setEnquetesMontar] = useState(undefined); // undefined = ainda a carregar
  const [eventosPorId, setEventosPorId] = useState({});
  const [sheet, setSheet] = useState(null);

  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirMinisterios(setMinisterios), []);
  useEffect(() => ouvirEnquetesMontar(setEnquetesMontar), []);
  useEffect(() => {
    const ids = [...new Set((enquetesMontar || []).flatMap((e) => e.domingos || []))];
    if (!ids.length) { setEventosPorId({}); return; }
    obterEventosPorIds(ids).then(setEventosPorId);
  }, [enquetesMontar]);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Montar",
      subtitulo: "Enquete e escala do mês",
      chips: [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  const pessoaPorId = (id) => voluntarios.find((p) => p.id === id);
  const abertas = (enquetesMontar || []).filter((e) => e.estado === "aberta");
  const semEnqueteParaOMesQueVem = Array.isArray(enquetesMontar) && abertas.length === 0 && hoje.getDate() >= 15;

  async function copiarTexto() {
    try {
      await navigator.clipboard.writeText(textoWhatsApp(abertas.map((e) => ({ mes: e.id, prazo: e.prazo }))));
      torrada("Texto copiado");
    } catch {
      torrada("Não foi possível copiar — copia manualmente.");
    }
  }

  return (
    <>
      <div className="sect">
        {enquetesMontar === undefined && <div className="vaz">A carregar…</div>}

        {enquetesMontar !== undefined && abertas.length === 0 && (
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

        {abertas.length > 0 && (
          <>
            <div className="cabecalho">
              <h3>Texto pronto para o WhatsApp</h3>
            </div>
            <p style={{ lineHeight: 1.6, fontSize: 13.5, whiteSpace: "pre-wrap" }}>
              {textoWhatsApp(abertas.map((e) => ({ mes: e.id, prazo: e.prazo })))}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn sec" style={{ flex: 1, fontSize: 12.5 }} onClick={copiarTexto}>Copiar texto</button>
              <a
                className="btn" style={{ flex: 1, fontSize: 12.5, textAlign: "center" }}
                href={linkWhatsApp(textoWhatsApp(abertas.map((e) => ({ mes: e.id, prazo: e.prazo }))))}
                target="_blank" rel="noreferrer"
              >
                Abrir WhatsApp
              </a>
            </div>
          </>
        )}

        {(enquetesMontar || []).map((e) => (
          <CartaoEnquete key={e.id} enquete={e} voluntarios={voluntarios} ministerios={ministerios} eventosPorId={eventosPorId} />
        ))}
      </div>

      {ministerios.length > 0 && (
        <SugestorEscala
          ministerios={ministerios} voluntarios={voluntarios}
          onPromover={(pessoaId) => setSheet({ tipo: "pessoa", pessoaId })}
        />
      )}

      {ministerios.length > 0 && <UltimasEnquetes ministerios={ministerios} voluntarios={voluntarios} />}

      {sheet?.tipo === "abrirEnquete" && (
        <SheetAbrirEnquete
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "pessoa" && (
        <SheetPessoa
          pessoa={sheet.pessoaId ? pessoaPorId(sheet.pessoaId) : null}
          ministerios={ministerios}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
          onRemover={(pessoaId) => setSheet({ tipo: "removerPessoa", pessoaId })}
        />
      )}
      {sheet?.tipo === "removerPessoa" && (
        <SheetRemoverPessoa
          pessoa={pessoaPorId(sheet.pessoaId)}
          onFechar={() => setSheet(null)}
          onVoltar={(pessoaId) => setSheet({ tipo: "pessoa", pessoaId })}
          onRemovido={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}
