import { useEffect, useMemo, useState } from "react";
import { desgastePastoral, pessoasPastoral } from "../lib/pastoral";
import {
  DIAS_PARADO, contarPorEtapa, conversaoFunil, corTextoEtapa, diasParado, esquecidos, nomeGD, ouvirContactos,
} from "../lib/contactos";
import { dataCurta, haAtras, linkWhatsApp } from "@portal/shared/lib/data.js";
import Avatar from "@portal/shared/components/Avatar.jsx";
import LinhaPessoaContacto from "@portal/shared/components/LinhaPessoaContacto.jsx";
import Funil from "../components/Funil";
import Barras from "../components/Barras";
import SheetContacto from "../components/SheetContacto";

/** As três salas fixas da Kinder — mesma cópia pequena de Domingo.jsx
 *  (ver o comentário lá: cada app carrega só o seu bundle, três linhas
 *  não valem a pena partilhar). Só para "Líderes e auxiliares" dizer
 *  em qual sala cada um da Kinder serve (pedido 2026-09). */
const SALAS_KINDER = {
  baby: "Baby",
  fun: "Fun",
  junior: "Júnior",
};

/** As etiquetas de base de uma pessoa, como `tagExtra` de
 *  `LinhaPessoaContacto` — pode ser mais do que uma (quem serve em
 *  duas ou mais bases), por isso nunca o slot de badge único. */
function TagsBase({ bases }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {bases.map((b) => (
        <span className="tag" key={b.baseId} style={{ background: b.cor ?? "var(--cinza)" }}>{b.nome}</span>
      ))}
    </div>
  );
}

/** A linha do desgaste: tem barra de progresso e contagem de cultos,
 *  que não cabem nos slots do LinhaPessoaContacto partilhado — por
 *  isso é local, mas usa os mesmos dois primitivos (Avatar,
 *  linkWhatsApp) para o mesmo gesto de "toca no nome, aparece o
 *  WhatsApp". */
function LinhaDesgaste({ pessoa, cultos, pct, bases, aberta, onToggle }) {
  const link = linkWhatsApp(pessoa.telefone);
  return (
    <div className="linha" style={{ alignItems: "flex-start", cursor: "pointer", flexWrap: "wrap" }} onClick={onToggle}>
      <Avatar pessoa={pessoa} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="nmt">{pessoa.nome}</p>
        <p className="ds" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {bases.map((b) => (
            <span className="tag" key={b.baseId} style={{ background: b.cor }}>{b.nome}</span>
          ))}
        </p>
        <div className="barra" style={{ marginTop: 7 }}>
          <i style={{ width: `${pct}%`, background: pct >= 50 ? "var(--laranja)" : "var(--azul)" }} />
        </div>
      </div>
      <span style={{ flex: "none", fontSize: 15, fontWeight: 800, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" }}>
        {cultos}
      </span>
      {aberta && (
        <div className="aberto" onClick={(e) => e.stopPropagation()} style={{ paddingTop: 4, flexBasis: "100%" }}>
          {link ? (
            <a className="btn sec full" href={link} target="_blank" rel="noopener">Chamar no WhatsApp</a>
          ) : (
            <p className="ds">Sem contacto no perfil.</p>
          )}
          {/* os domingos a sério, não só o número — é o que comprova
              o "serviu X vezes" sem ter de confiar de olhos fechados */}
          {pessoa.datas?.length > 0 && (
            <p className="ds" style={{ marginTop: 10 }}>
              Serviu em: {pessoa.datas.map((d) => dataCurta(d)).join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const ABAS = [
  ["voluntarios", "Quem serve"],
  ["desgaste", "Desgaste"],
  ["funil", "Visitantes"],
];

/** Filtro por quando a visita chegou — não por etapa (essa já é o
 *  Funil) nem por nome (esse já é a busca). "Todos" fica primeiro e é
 *  o omisso: a maior parte das vezes quer-se ver toda a gente. */
const PERIODOS_CHEGADA = [
  ["todos", "Todos"],
  ["30d", "Últimos 30 dias"],
  ["90d", "Últimos 90 dias"],
];

/** A janela do desgaste: os últimos dois meses. É o período que
 *  interessa para equilibrar quem serve agora — quem esteve sobrecarregado
 *  na primavera e já parou não é hoje um caso a corrigir, e ficar no
 *  topo da lista escondia quem está a servir demais ESTA fase. */
const MESES_DESGASTE = 2;

function janelaDesgaste() {
  const h = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return [iso(new Date(h.getFullYear(), h.getMonth() - MESES_DESGASTE, h.getDate())), iso(h)];
}

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
  const [periodoChegada, setPeriodoChegada] = useState("todos");
  const [contactoAberto, setContactoAberto] = useState(null);
  const [desgaste, setDesgaste] = useState(null);
  const [erro, setErro] = useState(null);
  // qual linha (voluntário multi-base, líder ou desgaste) está
  // expandida a mostrar o WhatsApp — uma chave só, nunca mais do que
  // uma aberta ao mesmo tempo, mesmo padrão do contactoAberto acima
  const [linhaAberta, setLinhaAberta] = useState(null);
  const alternarLinha = (chave) => setLinhaAberta((a) => (a === chave ? null : chave));
  // as duas listas de Desgaste começam cortadas nas 3 primeiras — dez
  // pessoas de bulto era mais scroll do que a pergunta ("quem está a
  // servir demais?") precisa à primeira vista (pedido 2026-09)
  const [verTodosDesgaste, setVerTodosDesgaste] = useState(false);
  const [verTodosMultiBase, setVerTodosMultiBase] = useState(false);
  const [verTodosSemServir, setVerTodosSemServir] = useState(false);
  // "Ver só os parados" no aviso do funil
  const [soParados, setSoParados] = useState(false);

  useEffect(() => {
    let vivo = true;
    pessoasPastoral()
      .then((d) => { if (vivo) setDados(d); })
      .catch((e) => { if (vivo) setErro(e.message || "Não foi possível carregar as pessoas."); });
    return () => { vivo = false; };
  }, []);

  // só quando o separador é aberto: percorre as escalas de ~26
  // domingos × 10 bases, e não vale pagar isso a quem só veio ver a
  // lista de quem serve
  useEffect(() => {
    if (aba !== "desgaste" || desgaste) return;
    let vivo = true;
    const [de, ate] = janelaDesgaste();
    desgastePastoral(de, ate)
      .then((d) => { if (vivo) setDesgaste(d); })
      .catch((e) => { if (vivo) setErro(e.message || "Não foi possível calcular o desgaste."); });
    return () => { vivo = false; };
  }, [aba, desgaste]);

  useEffect(() => ouvirContactos(setContactos), []);

  /* ── quem serve ──────────────────────────────────────────── */

  /** A cor da base, para a etiqueta. `dados` pode ainda não ter
   *  chegado quando o separador do desgaste abre primeiro — o cinzento
   *  é um fallback honesto, não um erro. */
  const corBase = (baseId) =>
    (dados?.bases ?? []).find((b) => b.baseId === baseId)?.cor ?? "var(--cinza)";

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
  const conversao = useMemo(() => conversaoFunil(contactos), [contactos]);
  const parados = useMemo(() => esquecidos(contactos), [contactos]);
  const idsParados = useMemo(() => new Set(parados.map((c) => c.id)), [parados]);

  const listaFunil = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const dias = periodoChegada === "30d" ? 30 : periodoChegada === "90d" ? 90 : null;
    const limite = dias ? Date.now() - dias * 86400000 : null;
    return contactos
      .filter((c) => (soParados ? idsParados.has(c.id) : true))
      .filter((c) => (etapaFiltro ? c.etapa === etapaFiltro : true))
      .filter((c) => (termo ? (c.nome ?? "").toLowerCase().includes(termo) : true))
      .filter((c) => (limite ? (c.criadoEm?.toDate?.().getTime() ?? 0) >= limite : true));
  }, [contactos, etapaFiltro, busca, periodoChegada, soParados, idsParados]);

  /** Quem serviu em metade ou mais dos domingos do período. Metade não
   *  é um número mágico nem um limite de alarme — é onde "serve às
   *  vezes" passa a "serve quase sempre", e é a partir daí que vale a
   *  pena alguém perguntar se está tudo bem. */
  const gastos = useMemo(() => {
    if (!desgaste?.totalCultos) return [];
    return desgaste.pessoas.filter((p) => p.cultos / desgaste.totalCultos >= 0.5);
  }, [desgaste]);

  /** Quem serve 1 ou 2 domingos em dois meses é o normal de qualquer
   *  voluntário — listar toda a gente ensinaria a ignorar a lista. Só
   *  a partir de 3 é que há algo a olhar. */
  const desgastePorEquilibrar = useMemo(
    () => (desgaste?.pessoas ?? []).filter((p) => p.cultos > 2),
    [desgaste],
  );

  /** "Voluntários a perder o ritmo" (pedido 2026-09: "uma terceira lista
   *  em Desgaste — quem não serve há mais tempo, primeiro quem faz mais
   *  tempo"). Os ativos das bases que escalaram alguém na janela, com o
   *  último domingo em que serviram; quem não serviu nenhum vem primeiro.
   *
   *  "Bases que escalaram alguém na janela" e não uma lista fixa: o
   *  Financeiro (e qualquer base sem escala de culto) nunca escala
   *  ninguém, e sem isto a equipa inteira dele aparecia aqui para
   *  sempre. Se uma base de culto passar dois meses sem publicar
   *  escala, isso é um problema da BASE — aparece na aba Bases, não
   *  como dez pessoas "paradas" aqui. */
  const semServir = useMemo(() => {
    if (!desgaste || !dados) return [];
    const comEscala = new Set(desgaste.pessoas.flatMap((p) => p.bases.map((b) => b.baseId)));
    const ultima = new Map(desgaste.pessoas.map((p) => [p.uid, (p.datas ?? []).slice().sort().at(-1) ?? null]));
    return ativos
      .map((p) => ({ ...p, basesCulto: p.bases.filter((b) => b.ativo && comEscala.has(b.baseId)), ultima: ultima.get(p.id) ?? null }))
      .filter((p) => p.basesCulto.length)
      .sort((a, b) => {
        if (a.ultima === b.ultima) return (a.nome || "").localeCompare(b.nome || "", "pt");
        if (a.ultima === null) return -1;
        if (b.ultima === null) return 1;
        return a.ultima.localeCompare(b.ultima);
      });
  }, [desgaste, dados, ativos]);

  useEffect(() => {
    if (!ativo) return;
    const subtitulos = {
      voluntarios: "Quem serve na igreja, e em quantas bases",
      desgaste: `Quem serviu mais domingos nos últimos ${MESES_DESGASTE} meses`,
      funil: "De quem apareceu num culto a quem já serve",
    };
    const chips = {
      voluntarios: dados ? [`${ativos.length} a servir`, `${multiBase.length} em mais de uma base`] : [],
      desgaste: desgaste
        ? [`${desgaste.totalCultos} cultos`, gastos.length ? `${gastos.length} em metade ou mais` : "ninguém acima de metade"]
        : [],
      funil: [`${contactos.length} no funil`, parados.length ? `${parados.length} parados` : "nenhum parado"],
    };
    definirCabecalho({ titulo: "Pessoas", subtitulo: subtitulos[aba], chips: chips[aba] });
  }, [ativo, definirCabecalho, aba, dados, ativos, multiBase, contactos, parados, desgaste, gastos]);

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
              <div className="cabecalho"><h3>Líderes e auxiliares</h3><span className="cap">{lideres.length}</span></div>
              {lideres.map((p) => (
                <LinhaPessoaContacto
                  key={p.id} pessoa={p}
                  resumo={p.bases.filter((b) => b.ativo && (b.papel === "lider_base" || b.papel === "auxiliar"))
                    .map((b) => {
                      const sala = b.baseId === "kinder" ? SALAS_KINDER[b.categoria] : null;
                      return `${b.nome}${b.papel === "auxiliar" ? " (auxiliar)" : ""}${sala ? ` · Sala ${sala}` : ""}`;
                    }).join(" · ")}
                  aberta={linhaAberta === `lider:${p.id}`}
                  onToggle={() => alternarLinha(`lider:${p.id}`)}
                />
              ))}
            </div>

          </>
        )
      ) : aba === "desgaste" ? (
        !desgaste ? (
          <div className="vaz" style={{ marginTop: 12 }}>A percorrer as escalas dos últimos {MESES_DESGASTE} meses…</div>
        ) : (
          <>
            <div className="caixa" style={{ marginTop: 12 }}>
              <p className="ds" style={{ marginTop: 0 }}>
                O sistema já impede escalar a mesma pessoa em duas bases no mesmo culto. O que nunca mostrou a
                ninguém é quem está a servir em semanas alternadas em bases diferentes: o líder da Apoio vê
                metade, o da Kinder vê a outra metade, e ninguém vê o todo.
              </p>
              <p className="cap" style={{ marginTop: 8 }}>
                Conta <b>cultos</b>, não escalas — servir em duas bases no mesmo domingo é um domingo, não dois.
                Sempre dos últimos {MESES_DESGASTE} meses: é quem está sobrecarregado agora que interessa, não
                quem esteve há seis meses.
              </p>
            </div>

            {gastos.length > 0 && (
              <div className="caixa pa-aviso" style={{ marginTop: 12 }}>
                <p style={{ marginTop: 0 }}>
                  <b>{gastos.length} pessoa{gastos.length === 1 ? "" : "s"}</b> serviu em metade ou mais dos{" "}
                  {desgaste.totalCultos} domingos deste período.
                </p>
              </div>
            )}

            <div className="sect">
              <div className="cabecalho">
                <h3>Mais domingos servidos</h3>
                <span className="cap">últimos {MESES_DESGASTE} meses · {desgaste.totalCultos} cultos</span>
              </div>
              {/* servir 1 ou 2 domingos em dois meses é o normal de
                  qualquer voluntário — só a partir de 3 é que vale a
                  pena olhar para o equilíbrio */}
              {desgastePorEquilibrar.length ? (
                <>
                  {(verTodosDesgaste ? desgastePorEquilibrar : desgastePorEquilibrar.slice(0, 3)).map((p) => (
                    <LinhaDesgaste
                      key={p.uid} pessoa={p} cultos={p.cultos}
                      pct={Math.round((p.cultos / desgaste.totalCultos) * 100)}
                      bases={p.bases.map((b) => ({ ...b, cor: corBase(b.baseId) }))}
                      aberta={linhaAberta === `desgaste:${p.uid}`}
                      onToggle={() => alternarLinha(`desgaste:${p.uid}`)}
                    />
                  ))}
                  {desgastePorEquilibrar.length > 3 && (
                    <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setVerTodosDesgaste((v) => !v)}>
                      {verTodosDesgaste ? "Ver menos" : `Ver mais (${desgastePorEquilibrar.length - 3})`}
                    </button>
                  )}
                </>
              ) : (
                <div className="vaz">
                  {desgaste.pessoas.length
                    ? "Ninguém serviu mais de 2 domingos neste período."
                    : "Nenhuma escala publicada neste período."}
                </div>
              )}
            </div>

            {/* pedido 2026-09: "quem serve em mais de uma base"
                mudou-se para dentro de Desgaste — é aqui que a
                pergunta pertence a sério (é onde o desgaste começa,
                ver o comentário de `multiBase` acima), não em "Quem
                serve", que é só a lista de quem está ativo. */}
            <div className="sect">
              <div className="cabecalho">
                <h3>Servem em mais de uma base</h3>
                <span className="cap">{multiBase.length}</span>
              </div>
              <p className="ds" style={{ marginTop: 0 }}>
                O sistema já impede escalar a mesma pessoa em duas bases no mesmo culto — o que não mostra a
                ninguém é quem está a carregar dois compromissos ao mesmo tempo.
              </p>
              {multiBase.length ? (
                <>
                  {(verTodosMultiBase ? multiBase : multiBase.slice(0, 3)).map((p) => (
                    <LinhaPessoaContacto
                      key={p.id} pessoa={p}
                      resumo="Toca para chamar no WhatsApp"
                      tagExtra={<TagsBase bases={p.bases.filter((b) => b.ativo)} />}
                      aberta={linhaAberta === `multi:${p.id}`}
                      onToggle={() => alternarLinha(`multi:${p.id}`)}
                    />
                  ))}
                  {multiBase.length > 3 && (
                    <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setVerTodosMultiBase((v) => !v)}>
                      {verTodosMultiBase ? "Ver menos" : `Ver mais (${multiBase.length - 3})`}
                    </button>
                  )}
                </>
              ) : <div className="vaz">Ninguém serve em mais do que uma base.</div>}
            </div>

            <div className="sect">
              <div className="cabecalho">
                <h3>Não servem há mais tempo</h3>
                <span className="cap">{semServir.filter((p) => p.ultima === null).length} sem servir em {MESES_DESGASTE} meses</span>
              </div>
              <p className="ds" style={{ marginTop: 0 }}>
                Voluntários ativos, do que serviu há mais tempo para o mais recente — quem está a perder o ritmo
                costuma sair sem avisar.
              </p>
              {semServir.length ? (
                <>
                  {(verTodosSemServir ? semServir : semServir.slice(0, 3)).map((p) => (
                    <LinhaPessoaContacto
                      key={p.id} pessoa={p}
                      resumo={p.ultima
                        ? `Serviu pela última vez a ${dataCurta(p.ultima)} · toca para chamar no WhatsApp`
                        : `Não serviu nos últimos ${MESES_DESGASTE} meses · toca para chamar no WhatsApp`}
                      tagExtra={<TagsBase bases={p.basesCulto} />}
                      aberta={linhaAberta === `semservir:${p.id}`}
                      onToggle={() => alternarLinha(`semservir:${p.id}`)}
                    />
                  ))}
                  {semServir.length > 3 && (
                    <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setVerTodosSemServir((v) => !v)}>
                      {verTodosSemServir ? "Ver menos" : `Ver mais (${semServir.length - 3})`}
                    </button>
                  )}
                </>
              ) : <div className="vaz">{dados ? "Nenhum voluntário ativo em bases com escala." : "A carregar os voluntários…"}</div>}
            </div>
          </>
        )
      ) : (
        <>
          {/* a conversão, etapa a etapa (pedido 2026-09) — ver
              `conversaoFunil`: quantos estão em cada uma agora, e dos
              que lá chegaram, quantos % passaram à seguinte */}
          <div className="pa-conversao" style={{ marginTop: 12 }}>
            {conversao.map((e, i) => (
              <div key={e.id} style={{ borderTopColor: e.cor }}>
                <p>{e.nome}</p>
                <b>{e.aqui}</b>
                <small>
                  {i === conversao.length - 1
                    ? (e.chegou !== null ? `${e.chegou}% de todos chegaram` : "—")
                    : (e.passou !== null ? `${e.passou}% passaram` : "ninguém chegou")}
                </small>
              </div>
            ))}
          </div>

          <div className="sect" style={{ paddingTop: 14 }}>
            <div className="cabecalho" style={{ marginTop: 0 }}>
              <h3>O caminho</h3>
              <span className="cap">quantos estão em cada etapa</span>
            </div>
            <Funil etapas={etapas} selecionada={etapaFiltro} onSelecionar={setEtapaFiltro} />
          </div>

          {parados.length > 0 && (
            <div className="caixa destaque" style={{ marginTop: 12, flexDirection: "column", alignItems: "stretch" }}>
              <p className="ds" style={{ marginTop: 0, color: "#fff" }}>
                <b>{parados.length} pessoa{parados.length === 1 ? "" : "s"} parada{parados.length === 1 ? "" : "s"}</b> há mais
                de {DIAS_PARADO} dias na mesma etapa. A mais antiga há {parados[0].dias} dias.
              </p>
              <button className="btn sec full" style={{ marginTop: 12 }} onClick={() => setSoParados((v) => !v)}>
                {soParados ? "Ver todos" : "Ver só os parados"}
              </button>
            </div>
          )}

          <input
            className="campo" type="search" value={busca} placeholder="Procurar por nome"
            onChange={(e) => setBusca(e.target.value)} style={{ marginTop: 12 }}
          />

          <div className="menu" style={{ position: "static", border: 0, padding: "10px 0 0", background: "none", backdropFilter: "none" }}>
            {PERIODOS_CHEGADA.map(([id, rotulo]) => (
              <button key={id} data-on={periodoChegada === id ? "1" : "0"} onClick={() => setPeriodoChegada(id)}>{rotulo}</button>
            ))}
          </div>

          <div className="sect">
            <div className="cabecalho">
              <h3>{etapaFiltro ? etapas.find((e) => e.id === etapaFiltro)?.nome : "Todos"}{soParados ? " · parados" : ""}</h3>
              <span className="cap">{listaFunil.length}</span>
            </div>
            {listaFunil.length ? listaFunil.slice(0, 60).map((c) => {
              const etapa = etapas.find((e) => e.id === c.etapa);
              const parado = idsParados.has(c.id);
              const gd = nomeGD(c);
              return (
                <div
                  className={`linha cabtoque${parado ? " pa-parado" : ""}`} key={c.id}
                  onClick={() => setContactoAberto(c)}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setContactoAberto(c); }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="nmt">{c.nome}</p>
                    <p className="ds">
                      {[c.freguesia, c.concelho].filter(Boolean).join(", ") || "sem localidade"}
                    </p>
                    {/* a data de chegada, pedida a olho — "há X dias"
                        enquanto é recente, a data a sério depois de
                        uma semana (mesma lógica de `haAtras` em toda
                        a app) */}
                    {c.criadoEm && <p className="cap" style={{ marginTop: 3 }}>chegou {haAtras(c.criadoEm)}</p>}
                    {gd && <p className="cap" style={{ marginTop: 2 }}>GD: <b>{gd}</b></p>}
                    {/* parado há mais de uma semana na mesma etapa —
                        texto e não só a cor da linha (pedido 2026-09) */}
                    {parado && (
                      <p className="pa-parado-txt">à espera há {diasParado(c)} dias em {etapa?.nome ?? c.etapa}</p>
                    )}
                  </div>
                  <span className="tag" style={{ flex: "none", background: etapa?.cor ?? "var(--cinza)", color: corTextoEtapa(c.etapa) }}>
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
