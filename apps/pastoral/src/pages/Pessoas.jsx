import { useEffect, useMemo, useState } from "react";
import { pessoasPastoral } from "../lib/pastoral";
import { contarPorEtapa, esquecidos, ouvirContactos } from "../lib/contactos";
import Funil from "../components/Funil";
import Barras from "../components/Barras";
import SheetContacto from "../components/SheetContacto";

const ABAS = [
  ["voluntarios", "Quem serve"],
  ["funil", "Visitantes"],
];

/**
 * As pessoas — as que já servem, e as que ainda não.
 *
 * Duas metades da mesma pergunta, por isso dois separadores e não duas
 * abas: quem serve é o corpo que já está montado; o funil é por onde
 * ele cresce. Vê-las lado a lado é o que mostra que 12 visitas por mês
 * e 2 voluntários novos por ano não é um problema de recrutamento — é
 * um problema no meio do caminho.
 */
export default function Pessoas({ ativo, definirCabecalho }) {
  const [aba, setAba] = useState("voluntarios");
  const [dados, setDados] = useState(null);           // null = a carregar
  const [contactos, setContactos] = useState([]);
  const [etapaFiltro, setEtapaFiltro] = useState(null);
  const [busca, setBusca] = useState("");
  const [contactoAberto, setContactoAberto] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let vivo = true;
    pessoasPastoral()
      .then((d) => { if (vivo) setDados(d); })
      .catch((e) => { if (vivo) setErro(e.message || "Não foi possível carregar as pessoas."); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => ouvirContactos(setContactos), []);

  /* ── quem serve ──────────────────────────────────────────── */

  const ativos = useMemo(
    () => (dados?.pessoas ?? []).filter((p) => p.bases.some((b) => b.ativo)),
    [dados],
  );

  /** Quem serve em mais do que uma base. É a resposta a uma pergunta
   *  que hoje ninguém consegue fazer: o sistema já impede escalar a
   *  mesma pessoa em duas bases no mesmo culto
   *  (`eventos/{e}/indisponibilidades`), mas ninguém vê a lista de
   *  quem está a carregar dois compromissos ao mesmo tempo. É onde o
   *  desgaste começa, e é invisível base a base por construção. */
  const multiBase = useMemo(
    () => ativos
      .filter((p) => p.bases.filter((b) => b.ativo).length > 1)
      .sort((a, b) => b.bases.length - a.bases.length),
    [ativos],
  );

  const porBase = useMemo(() => {
    if (!dados) return [];
    return dados.bases
      .map((b) => ({
        chave: b.baseId, rotulo: b.nome, cor: b.cor,
        valor: ativos.filter((p) => p.bases.some((x) => x.baseId === b.baseId && x.ativo)).length,
      }))
      .filter((l) => l.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [dados, ativos]);

  const lideres = useMemo(
    () => ativos.filter((p) => p.bases.some((b) => b.ativo && (b.papel === "lider_base" || b.papel === "auxiliar"))),
    [ativos],
  );

  /* ── o funil ─────────────────────────────────────────────── */

  const etapas = useMemo(() => contarPorEtapa(contactos), [contactos]);
  const parados = useMemo(() => esquecidos(contactos, 30), [contactos]);

  const listaFunil = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return contactos
      .filter((c) => (etapaFiltro ? c.etapa === etapaFiltro : true))
      .filter((c) => (termo ? (c.nome ?? "").toLowerCase().includes(termo) : true));
  }, [contactos, etapaFiltro, busca]);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Pessoas",
      subtitulo: aba === "voluntarios"
        ? "Quem serve na igreja, e em quantas bases"
        : "De quem apareceu num culto a quem já serve",
      chips: aba === "voluntarios"
        ? (dados ? [`${ativos.length} a servir`, `${multiBase.length} em mais de uma base`] : [])
        : [`${contactos.length} no funil`, parados.length ? `${parados.length} parados` : "nenhum parado"],
    });
  }, [ativo, definirCabecalho, aba, dados, ativos, multiBase, contactos, parados]);

  return (
    <>
      <div className="menu" style={{ position: "static", border: 0, padding: "14px 0 4px", background: "none", backdropFilter: "none" }}>
        {ABAS.map(([id, rotulo]) => (
          <button key={id} data-on={aba === id ? "1" : "0"} onClick={() => setAba(id)}>{rotulo}</button>
        ))}
      </div>

      {aba === "voluntarios" ? (
        erro ? (
          <div className="caixa destaque" style={{ marginTop: 12 }}><p className="ds" style={{ marginTop: 0 }}>{erro}</p></div>
        ) : !dados ? (
          <div className="vaz" style={{ marginTop: 12 }}>A carregar as pessoas…</div>
        ) : (
          <>
            <div className="dupla" style={{ marginTop: 12 }}>
              <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent", marginTop: 0 }}>
                <p className="ds" style={{ marginTop: 0 }}>A servir</p>
                <p className="pa-num">{ativos.length}</p>
                <p className="ds" style={{ marginTop: 2 }}>pessoas ativas</p>
              </div>
              <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent", marginTop: 0 }}>
                <p className="ds" style={{ marginTop: 0 }}>Em duas ou mais</p>
                <p className="pa-num">{multiBase.length}</p>
                <p className="ds" style={{ marginTop: 2 }}>servem em várias bases</p>
              </div>
            </div>

            <div className="sect">
              <div className="cabecalho"><h3>Por base</h3><span className="cap">voluntários ativos</span></div>
              <Barras linhas={porBase} vazio="Ainda não há voluntários ativos." />
            </div>

            <div className="sect">
              <div className="cabecalho">
                <h3>Servem em mais de uma base</h3>
                <span className="cap">{multiBase.length}</span>
              </div>
              <p className="ds" style={{ marginTop: 0 }}>
                O sistema já impede escalar a mesma pessoa em duas bases no mesmo culto — o que não mostra a
                ninguém é quem está a carregar dois compromissos ao mesmo tempo.
              </p>
              {multiBase.length ? multiBase.map((p) => (
                <div className="linha" key={p.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="nmt">{p.nome}</p>
                    <p className="ds" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      {p.bases.filter((b) => b.ativo).map((b) => (
                        <span className="tag" key={b.baseId} style={{ background: b.cor ?? "var(--cinza)" }}>{b.nome}</span>
                      ))}
                    </p>
                  </div>
                </div>
              )) : <div className="vaz">Ninguém serve em mais do que uma base.</div>}
            </div>

            <div className="sect">
              <div className="cabecalho"><h3>Líderes e auxiliares</h3><span className="cap">{lideres.length}</span></div>
              {lideres.map((p) => (
                <div className="linha" key={p.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="nmt">{p.nome}</p>
                    <p className="ds">
                      {p.bases.filter((b) => b.ativo && (b.papel === "lider_base" || b.papel === "auxiliar"))
                        .map((b) => `${b.nome}${b.papel === "auxiliar" ? " (auxiliar)" : ""}`).join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      ) : (
        <>
          <div className="sect" style={{ paddingTop: 14 }}>
            <div className="cabecalho" style={{ marginTop: 0 }}>
              <h3>O caminho</h3>
              <span className="cap">% face às visitas</span>
            </div>
            <Funil etapas={etapas} selecionada={etapaFiltro} onSelecionar={setEtapaFiltro} />
          </div>

          {parados.length > 0 && (
            <div className="caixa destaque" style={{ marginTop: 12 }}>
              <p className="ds" style={{ marginTop: 0 }}>
                <b>{parados.length} pessoa{parados.length === 1 ? "" : "s"} parada{parados.length === 1 ? "" : "s"}</b> há mais
                de 30 dias na mesma etapa. A mais antiga há {parados[0].dias} dias.
              </p>
            </div>
          )}

          <input
            className="campo" type="search" value={busca} placeholder="Procurar por nome"
            onChange={(e) => setBusca(e.target.value)} style={{ marginTop: 12 }}
          />

          <div className="sect">
            <div className="cabecalho">
              <h3>{etapaFiltro ? etapas.find((e) => e.id === etapaFiltro)?.nome : "Todos"}</h3>
              <span className="cap">{listaFunil.length}</span>
            </div>
            {listaFunil.length ? listaFunil.slice(0, 60).map((c) => {
              const etapa = etapas.find((e) => e.id === c.etapa);
              return (
                <div
                  className="linha cabtoque" key={c.id}
                  onClick={() => setContactoAberto(c)}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setContactoAberto(c); }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="nmt">{c.nome}</p>
                    <p className="ds">
                      {[c.freguesia, c.concelho].filter(Boolean).join(", ") || "sem localidade"}
                    </p>
                  </div>
                  <span className="tag" style={{ flex: "none", background: etapa?.cor ?? "var(--cinza)" }}>
                    {etapa?.nome ?? c.etapa}
                  </span>
                </div>
              );
            }) : (
              <div className="vaz">
                {contactos.length
                  ? "Ninguém nesta etapa com esse nome."
                  : "Ainda não há contactos — a Base Pessoal é quem os recolhe, no Formulário."}
              </div>
            )}
          </div>
        </>
      )}

      {contactoAberto && (
        <SheetContacto
          contacto={contactos.find((c) => c.id === contactoAberto.id) ?? contactoAberto}
          onFechar={() => setContactoAberto(null)}
        />
      )}
    </>
  );
}
