import { useEffect, useState } from "react";
import { obterCatalogoChecklistDeTodasAsBases, ouvirChecklistDoEvento, obterProximoEvento } from "../lib/painel";
import { dataPorExtenso } from "@portal/shared/lib/data.js";

// [chave, título da aba, mensagem de "tudo pronto" desta categoria] —
// pedido explícito do líder: cada categoria tem a sua própria frase
// de fechado, não um "tudo pronto" genérico repetido três vezes.
const CATEGORIAS = [
  ["pre", "Pré-culto", "Pronto pro Culto!"],
  ["durante", "Durante o culto", "Pronto para o encerramento!"],
  ["pos", "Pós-culto", "Pronto para o fechamento das portas!"],
];

function listaComE(nomes) {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/** Menu próprio — pedido do líder, depois de testar como terceiro
 *  segmento dentro de Escala e achar que "essa parte" merecia acesso
 *  direto. Três categorias, mesma divisão que cada base já usa na
 *  própria checklist (fase: pre/durante/pos) — mas aqui é a
 *  categoria em si que organiza a tela, não um agrupamento dentro de
 *  um cartão só.
 *
 *  Catálogo (que função existe, de que ministério/fase, nomes de
 *  quem está ativo em cada base) vem uma vez da Cloud Function
 *  `checklistCrossBase` — bases/{b}/funcoes e /pessoas são
 *  restritos à própria base nas rules, só o Admin SDK lê cruzado. O
 *  estado (feito, quem, a que hora) é ao vivo: eventos/{e}/checklist
 *  já é global (`allow read: if autenticado()`), não pede Cloud
 *  Function nenhuma para isso — só assim fica em tempo real sem
 *  chamar a função a cada toque de checkbox de qualquer base.
 *
 *  Um cartão por base, fechado por omissão (mesmo `.mincartao` que a
 *  Comunicação já usa para agrupar Wiki/Acervo/Solicitações),
 *  agrupado por ministério dentro da categoria quando a base tem
 *  (Técnica/Comunicação) — sem ministérios (Apoio/Backstage), lista
 *  direta. Só leitura: marcar a checklist continua a ser sempre da
 *  própria base (rules já exigem estar na escala dela para escrever
 *  ali). */
export default function Checklists({ ativo, definirCabecalho }) {
  const [categoria, setCategoria] = useState("pre");
  const [evento, setEvento] = useState(undefined); // undefined = a carregar, null = nenhum
  const [catalogo, setCatalogo] = useState(null); // null = a carregar
  const [checklist, setChecklist] = useState({});
  const [abertos, setAbertos] = useState({});

  useEffect(() => { obterProximoEvento().then(setEvento); }, []);
  useEffect(() => {
    if (!evento) { setCatalogo(null); return; }
    setCatalogo(null);
    setAbertos({});
    obterCatalogoChecklistDeTodasAsBases(evento.id).then(setCatalogo);
  }, [evento]);
  useEffect(() => {
    if (!evento) { setChecklist({}); return; }
    return ouvirChecklistDoEvento(evento.id, setChecklist);
  }, [evento]);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Checklists</em>,
      subtitulo: evento ? (evento.tipo || dataPorExtenso(evento.data)) : "",
      chips: [],
    });
  }, [ativo, evento, definirCabecalho]);

  const [, tituloCategoria, mensagemPronto] = CATEGORIAS.find(([c]) => c === categoria);

  // por base: só as funções desta categoria, agrupadas por ministério
  // quando a base tem — uma função de "Fotografia" pode ser
  // pré-culto e outra durante, por isso agrupa DEPOIS de filtrar por
  // fase, nunca antes (ver checklistCrossBase, functions/index.js)
  const basesCategoria = (catalogo || []).map((b) => {
    const funcoesCategoria = b.funcoes.filter((f) => f.fase === categoria);
    const temMinisterio = funcoesCategoria.some((f) => f.ministerioId);
    const grupos = temMinisterio
      ? Object.values(funcoesCategoria.reduce((acc, f) => {
          const chave = f.ministerioId || "_geral";
          (acc[chave] ??= { chave, titulo: f.ministerioNome || "Geral", cor: f.ministerioCor, funcoes: [] }).funcoes.push(f);
          return acc;
        }, {}))
      : [{ chave: "_flat", titulo: null, cor: null, funcoes: funcoesCategoria }];
    return { ...b, funcoesCategoria, grupos };
  });

  const comTarefas = basesCategoria.filter((b) => b.funcoesCategoria.length > 0);
  const pendentes = comTarefas.filter((b) => b.funcoesCategoria.some((f) => !checklist[f.id]));
  const tudoPronto = comTarefas.length > 0 && pendentes.length === 0;
  const textoResumo = comTarefas.length === 0
    ? "Sem tarefas nesta categoria."
    : tudoPronto
      ? mensagemPronto
      : pendentes.length === 1
        ? `Falta apenas ${pendentes[0].nome} finalizar`
        : `Faltam ${listaComE(pendentes.map((b) => b.nome))} finalizarem`;

  return (
    <div className="sect">
      <div className="subtabs" style={{ marginBottom: 4 }}>
        {CATEGORIAS.map(([chave, titulo]) => (
          <button key={chave} data-on={categoria === chave ? 1 : 0} onClick={() => setCategoria(chave)}>
            {titulo}
          </button>
        ))}
      </div>

      {evento === undefined && <div className="vaz">A carregar…</div>}
      {evento === null && <div className="vaz">Sem cultos marcados.</div>}

      {evento && (
        <>
          <p className="ds" style={{ margin: "10px 0" }}>{tituloCategoria} · {evento.tipo || dataPorExtenso(evento.data)}</p>

          {catalogo === null && <div className="vaz">A carregar…</div>}

          {catalogo && basesCategoria.map((b) => {
            const aberto = !!abertos[b.baseId];
            const feitasBase = b.funcoesCategoria.filter((f) => checklist[f.id]).length;
            return (
              <div className="mincartao" key={b.baseId}>
                <div className="mincartao-barra" style={{ background: b.cor || "var(--fio)" }} />
                <button
                  className="mincartao-cab cabtoque"
                  data-aberto={aberto ? 1 : 0} aria-expanded={aberto}
                  onClick={() => setAbertos((v) => ({ ...v, [b.baseId]: !v[b.baseId] }))}
                >
                  <span className="ponto" style={{ background: b.cor || "var(--cinza)" }} />
                  <span className="nome">{b.nome}</span>
                  <span className="conta">
                    {b.funcoesCategoria.length === 0 ? "sem tarefas" : `${feitasBase} de ${b.funcoesCategoria.length}`}
                  </span>
                  <span className="cabtoque-seta" aria-hidden="true">›</span>
                </button>
                {aberto && (
                  <div style={{ padding: "0 12px 12px" }}>
                    {b.funcoesCategoria.length === 0 && <div className="vaz" style={{ border: 0 }}>Nada nesta categoria.</div>}
                    {b.grupos.map((g) => (
                      <div key={g.chave}>
                        {g.titulo && (
                          <div className="fasecab">
                            <h4>
                              {g.cor && <span className="quadmin" style={{ background: g.cor }} />}
                              {g.titulo}
                            </h4>
                            <em>{g.funcoes.filter((f) => checklist[f.id]).length}/{g.funcoes.length}</em>
                          </div>
                        )}
                        {g.funcoes.map((f) => {
                          const c = checklist[f.id];
                          const ok = !!c;
                          return (
                            <div className={`linha${ok ? " feita" : ""}`} key={f.id}>
                              <span className={`chk${ok ? " on" : ""}`} style={{ cursor: "default" }}>✓</span>
                              <div style={{ flex: 1 }}>
                                <p className="nmt" style={{ fontSize: 15 }}>{f.nome}</p>
                                <p className="ds">{ok ? `${b.pessoas[c.por] ?? "alguém"} · ${c.hora}` : "Por fazer"}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {catalogo && (
            <div
              style={{
                marginTop: 16, padding: "16px 20px", borderRadius: 100, textAlign: "center",
                fontWeight: 700, fontSize: 15,
                background: tudoPronto ? "var(--verde)" : "var(--agua)",
                color: tudoPronto ? "#fff" : "var(--cinza)",
              }}
            >
              {tudoPronto && "✅ "}{textoResumo}
            </div>
          )}
        </>
      )}
    </div>
  );
}
