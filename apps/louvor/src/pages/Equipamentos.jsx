import { useEffect, useState } from "react";
import { ouvirEquipamentos } from "../lib/equipamentos";
import { ouvirMelhorias, desativarMelhoria, corPrevisao, GRAVIDADE_INFO, ESTADO_INFO } from "../lib/melhorias";
import { ouvirVoluntarios } from "../lib/painel";
import { souLiderOuAuxiliar } from "../lib/modelo";
import { usePapeisEscala } from "../lib/PapeisEscalaContext.jsx";
import { dataCurta } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import FotoRedonda from "@portal/shared/components/FotoRedonda.jsx";
import SheetEquipamento from "../components/painel/SheetEquipamento";
import SheetEquipamentoDetalhe from "../components/equipamentos/SheetEquipamentoDetalhe";
import SheetMelhoria from "../components/equipamentos/SheetMelhoria";
import SheetNovaMelhoria from "../components/equipamentos/SheetNovaMelhoria";

// mesma cor da .risca/.selo do cartão, pra pintar a miniatura quando
// a melhoria não tem foto — ver global.css
const COR_MINIATURA = { alta: "var(--magenta)", media: "var(--laranja)", baixa: "var(--ciano)" };
const RANK_GRAVIDADE = { impede_culto: 0, atrapalha: 1, melhoria: 2 };
const RANK_ESTADO = { aberta: 0, em_curso: 1, resolvida: 2 };

// "2026-08-16" (data) ou um Timestamp do Firestore (abertaEm) → "16 ago"
function curta(valor) {
  if (!valor) return "—";
  const iso = typeof valor === "string" ? valor : valor.toDate?.().toISOString().slice(0, 10);
  return iso ? dataCurta(iso) : "—";
}

function ordenarMelhorias(lista, ordem) {
  return [...lista].sort((a, b) => {
    const resA = a.estado === "resolvida" ? 1 : 0, resB = b.estado === "resolvida" ? 1 : 0;
    if (resA !== resB) return resA - resB;
    if (ordem === "previsao") {
      if (!a.previsao && !b.previsao) return 0;
      if (!a.previsao) return 1;
      if (!b.previsao) return -1;
      return a.previsao < b.previsao ? -1 : a.previsao > b.previsao ? 1 : 0;
    }
    if (ordem === "data") {
      return (b.abertaEm?.toMillis?.() ?? 0) - (a.abertaEm?.toMillis?.() ?? 0);
    }
    if (ordem === "status") {
      return (RANK_ESTADO[a.estado] ?? 9) - (RANK_ESTADO[b.estado] ?? 9);
    }
    return (RANK_GRAVIDADE[a.gravidade] ?? 9) - (RANK_GRAVIDADE[b.gravidade] ?? 9);
  });
}

/** `abaControlada` + `semSubtabs`: quando Culto.jsx embrulha este
 *  ecrã com Melhorias como sub-aba própria dela (ao lado de
 *  Equipamentos, pedido do líder, 2026-09), a aba passa a vir de fora
 *  e a barra de sub-abas própria daqui esconde-se — não faz sentido
 *  ter duas barras de abas iguais, uma dentro da outra. Sem
 *  `abaControlada` (uso direto, se algum dia voltar a ter menu
 *  próprio), continua a decidir sozinho, como sempre. `onContagem`
 *  reporta `{comProblema, abertas}` para Culto.jsx poder pintar o
 *  alerta na sua própria aba "Melhorias" (ver oc-subtab-alerta). */
export default function Equipamentos({ uid, papel, ativo, definirCabecalho, abaControlada, semSubtabs, onContagem }) {
  const torrada = useTorrada();
  const souLiderBase = souLiderOuAuxiliar(papel);
  const [equipamentos, setEquipamentos] = useState([]);
  const [melhorias, setMelhorias] = useState([]);
  // "ministérios" aqui são os papéis da escala (Lead, Teclado…),
  // editáveis pelo líder em Definições da base (ver
  // PapeisEscalaContext.jsx e CLAUDE.md desta base). De propósito,
  // SEM filtrar por ativo — um papel desativado continua a agrupar o
  // equipamento que já lá estava (senão ficava invisível, sem ninguém
  // conseguir chegar lá para o mudar de sítio).
  const ministerios = usePapeisEscala();
  const [voluntarios, setVoluntarios] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [abaInterna, setAbaInterna] = useState("equipamentos"); // "equipamentos" | "melhorias"
  const aba = abaControlada ?? abaInterna;
  // Que cartões estão abertos. `undefined` = por decidir, e aí o
  // padrão é: avarias abertas (é o que precisa de ação), ministérios
  // fechados (é catálogo, consulta-se quando se procura alguma coisa).
  const [abertos, setAbertos] = useState({});
  const estaAberto = (chave) => !!(abertos[chave] ?? (chave === "avariados"));
  const alternar = (chave) => setAbertos((v) => ({ ...v, [chave]: !(v[chave] ?? (chave === "avariados")) }));
  const [expandida, setExpandida] = useState({});
  const [aConfirmarEngano, setAConfirmarEngano] = useState(null); // melhoriaId

  useEffect(() => ouvirEquipamentos(setEquipamentos), []);
  useEffect(() => ouvirMelhorias(setMelhorias), []);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);

  const comProblema = equipamentos.filter((e) => e.estado !== "ok").length;
  const melhoriasAtivas = melhorias.filter((m) => m.estado !== "resolvida");
  const melhoriasResolvidas = melhorias.filter((m) => m.estado === "resolvida");
  const abertas = melhoriasAtivas.length;

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Equipamentos</em>,
      subtitulo: aba === "equipamentos" ? "Instrumentos e equipamento de palco" : "Avarias e melhorias reportadas",
      chips: aba === "equipamentos"
        ? [`${equipamentos.length} itens`, comProblema ? `${comProblema} com problema` : "Tudo ok"]
        : [abertas ? `${abertas} em aberto` : "Nada em aberto", `${melhoriasResolvidas.length} resolvidas`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, aba, equipamentos.length, comProblema, abertas, melhoriasResolvidas.length]);

  useEffect(() => {
    onContagem?.({ comProblema, abertas });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comProblema, abertas]);

  const nomeMinisterio = (id) => ministerios.find((m) => m.id === id)?.nome;
  const equipamentoAtual = sheet?.equipamentoId ? equipamentos.find((e) => e.id === sheet.equipamentoId) : null;

  function cartaoMelhoria(m) {
    const gravInfo = GRAVIDADE_INFO[m.gravidade];
    const estInfo = ESTADO_INFO[m.estado];
    const { atrasada, texto: previsaoTexto } = corPrevisao(m);
    const equipamentoLigado = m.equipamentoId ? equipamentos.find((e) => e.id === m.equipamentoId) : null;
    const aberta = !!expandida[m.id];
    return (
      <div className="cartaomelh" key={m.id} onClick={() => setExpandida((v) => ({ ...v, [m.id]: !v[m.id] }))}>
        <span className={`risca ${gravInfo?.cor}`} />
        {m.foto ? (
          <FotoRedonda src={m.foto} alt={m.titulo} tamanho={34} />
        ) : (
          <span className="miniatura" style={{ background: COR_MINIATURA[gravInfo?.cor] }}>
            {(equipamentoLigado ? equipamentoLigado.nome : m.titulo).charAt(0).toUpperCase()}
          </span>
        )}
        <div className="cartaomelh-corpo">
          <div className="cartaomelh-linha1">
            <span className="cartaomelh-titulo">{equipamentoLigado ? equipamentoLigado.nome : m.titulo}</span>
            <button
              className="lapis"
              onClick={(e) => { e.stopPropagation(); setSheet({ tipo: "melhoria", melhoriaId: m.id, editar: true }); }}
            >
              ✎
            </button>
          </div>
          <div className="cartaomelh-linha2">
            {gravInfo && <span className={`selo ${gravInfo.cor}`}>{gravInfo.texto}</span>}
            {estInfo && <span className={`selo ${estInfo.cor}`}>{estInfo.texto}</span>}
            <span className={`cartaomelh-previsao ${atrasada ? "atrasada" : ""}`}>
              {m.estado === "resolvida" ? curta(m.abertaEm) : previsaoTexto}
            </span>
          </div>
          {aberta && (
            <div className="cartaomelh-desc">
              {m.descricao || "Sem descrição."}
              <br />
              <span className="abrir" onClick={(e) => { e.stopPropagation(); setSheet({ tipo: "melhoria", melhoriaId: m.id, editar: true }); }}>
                Comentários e histórico ›
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  async function foiEngano(m) {
    try {
      await desativarMelhoria(m.id);
      torrada("Avaria excluída. O equipamento voltou a ok.");
      setAConfirmarEngano(null);
    } catch (e) {
      torrada(e.message || "Não foi possível desfazer.");
    }
  }

  return (
    <>
      {/* Já foi um ecrã só (ver histórico) — um equipamento avariado
        * vivia partido entre "Equipamentos" e "Melhorias", era preciso
        * olhar para dois sítios para perceber o que se passava com ele.
        * Voltou a separar-se (pedido do líder, 2026-09) porque agora
        * cada equipamento continua a mostrar o estado de avaria inline
        * no catálogo, e a ficha dele (SheetEquipamentoDetalhe) já traz
        * o histórico de melhorias ligado — a "visão completa de um
        * item" não depende mais de estarem as duas listas na mesma
        * página. */}
      {!semSubtabs && (
        <div className="subtabs">
          <button data-on={aba === "equipamentos" ? 1 : 0} onClick={() => setAbaInterna("equipamentos")}>Equipamentos</button>
          <button data-on={aba === "melhorias" ? 1 : 0} onClick={() => setAbaInterna("melhorias")}>
            Melhorias
            {abertas > 0 && <span className="oc-subtab-alerta" />}
          </button>
        </div>
      )}

      <div className="sect">
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn full" style={{ flex: 1, padding: "12px 8px", fontSize: 13.5 }}
            onClick={() => setSheet({ tipo: "novaMelhoria", reportar: "avaria" })}>
            Reportar avaria
          </button>
          <button className="btn sec full" style={{ flex: 1, padding: "12px 8px", fontSize: 13.5 }}
            onClick={() => setSheet({ tipo: "novaMelhoria", reportar: "melhoria" })}>
            Reportar melhoria
          </button>
        </div>
        {souLiderBase && aba === "equipamentos" && (
          <button className="btn sec full" style={{ marginTop: 8, padding: "10px 8px", fontSize: 13 }}
            onClick={() => setSheet({ tipo: "novoEquipamento" })}>
            Novo equipamento
          </button>
        )}
        {equipamentos.length === 0 && melhorias.length === 0 && <div className="vaz">Ainda não há equipamentos no catálogo.</div>}

        {/* Os botões acima são ações; daqui para baixo é conteúdo. Sem
          * este intervalo a barra do primeiro cartão encostava ao "Novo
          * equipamento" e lia-se como se fosse parte dele. */}
        <div className="lv-equip-lista">

          {/* O que está avariado vem PRIMEIRO e já aberto. Antes vinha no
            * fim, depois de todo o equipamento que funciona — ao contrário
            * do que interessa a quem abre isto de manhã com o projetor em
            * baixo. Fecha-se depois de visto, mas não se esconde. */}
          {aba === "melhorias" && (comProblema > 0 || abertas > 0) && (() => {
            const avariados = equipamentos.filter((e) => e.estado !== "ok");
            // as que não são avaria: "comprar cabos XLR", ou ligadas a um
            // equipamento que continua em serviço. Sem isto ficavam
            // invisíveis — era a antiga aba Melhorias que as mostrava.
            const tarefas = melhoriasAtivas.filter(
              (m) => !avariados.some((e) => e.id === m.equipamentoId));
            const aberto = estaAberto("avariados");
            return (
              <div className="mincartao lv-equip lv-equip-avarias">
                <div className="mincartao-barra" />
                <button className="mincartao-cab cabtoque" data-aberto={aberto ? 1 : 0} aria-expanded={aberto} onClick={() => alternar("avariados")}>
                  <span className="ponto" />
                  <span className="nome">A precisar de atenção</span>
                  <span className="conta">
                    {avariados.length > 0 && `${avariados.length} avariado${avariados.length > 1 ? "s" : ""}`}
                    {avariados.length > 0 && tarefas.length > 0 && " · "}
                    {tarefas.length > 0 && `${tarefas.length} a fazer`}
                  </span>
                  <span className="cabtoque-seta" aria-hidden="true">›</span>
                </button>
                {aberto && avariados.map((e) => {
                  const melhoriaLigada = melhorias.find((m) => m.equipamentoId === e.id && m.estado !== "resolvida");
                  return (
                    <div key={e.id}>
                    {/* Toca-se para ver o histórico da avaria, não a ficha
                      * do equipamento. Aqui já se sabe que está avariado —
                      * abrir uma folha com "Reportar avaria" à frente é
                      * oferecer outra vez o que já foi feito. Reportar tem
                      * o seu sítio: o botão do topo e a ficha do
                      * equipamento, nos grupos por ministério. */}
                    <div className="linha" style={{ cursor: "pointer" }}
                      onClick={() => (melhoriaLigada
                        ? setSheet({ tipo: "melhoria", melhoriaId: melhoriaLigada.id, editar: true })
                        : setSheet({ tipo: "detalheEquipamento", equipamentoId: e.id }))}>
                      {/* O estado vai no subtítulo, não numa etiqueta à
                        * direita: com nome + etiqueta + "Marcar resolvida"
                        * + seta na mesma linha, um nome como "Projetor
                        * principal" partia em duas a 375px. Aqui há espaço
                        * de sobra e lê-se igual. */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="nmt">{e.nome}</p>
                        <p className="ds">
                          {e.ministerioId && <span className="quadmin" style={{ background: ministerios.find((m) => m.id === e.ministerioId)?.cor }} />}
                          {e.ministerioId ? nomeMinisterio(e.ministerioId) : "Geral"}
                          {" · "}
                          <b className={e.estado === "em_reparacao" ? "lv-equip-reparacao" : "lv-equip-avaria"}>
                            {e.estado === "em_reparacao" ? "Em reparação" : "Avariado"}
                          </b>
                        </p>
                      </div>
                      <span className="seta">›</span>
                    </div>
                    {/* As duas saídas, à vista e sem sair daqui. Antes só
                      * havia "Marcar resolvida", e só quando existia uma
                      * melhoria ligada — desfazer um toque errado obrigava
                      * a ir à folha da melhoria, três telas adiante. */}
                    {melhoriaLigada && (
                      aConfirmarEngano === melhoriaLigada.id ? (
                        <div className="lv-equip-acoes">
                          <span className="ds" style={{ flex: 1 }}>Excluir? O equipamento volta a ok.</span>
                          <button className="btn perigo" style={{ padding: "8px 12px", fontSize: 12 }} onClick={() => foiEngano(melhoriaLigada)}>
                            Excluir
                          </button>
                          <button className="btn sec" style={{ padding: "8px 12px", fontSize: 12 }} onClick={() => setAConfirmarEngano(null)}>
                            Não
                          </button>
                        </div>
                      ) : (
                        <div className="lv-equip-acoes">
                          <button className="btn sec" style={{ flex: 1, padding: "9px 8px", fontSize: 12.5 }}
                            onClick={() => setSheet({ tipo: "melhoria", melhoriaId: melhoriaLigada.id, editar: true, resolver: true })}>
                            Concluir avaria
                          </button>
                          {/* Excluir é só do líder da base, por decisão dele:
                            * quem reportou pode concluir (com nota, que fica
                            * como histórico), mas apagar o registo não. */}
                          {souLiderBase && (
                            <button className="btn sec" style={{ flex: 1, padding: "9px 8px", fontSize: 12.5 }}
                              onClick={() => setAConfirmarEngano(melhoriaLigada.id)}>
                              Excluir avaria
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                  );
                })}
                {aberto && tarefas.map((m) => {
                  const eq = m.equipamentoId ? equipamentos.find((x) => x.id === m.equipamentoId) : null;
                  return (
                    <div className="linha" style={{ cursor: "pointer" }} key={m.id}
                      onClick={() => setSheet({ tipo: "melhoria", melhoriaId: m.id, editar: true })}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="nmt">{m.titulo}</p>
                        <p className="ds">
                          {eq ? `${eq.nome} · ` : ""}
                          {m.estado === "em_curso" ? "Em curso" : "A fazer"}
                        </p>
                      </div>
                      <span className="seta">›</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Grupos fechados, e cada um com TUDO o que é dele — avariados
            * incluídos, com etiqueta. Antes o filtro era `estado === "ok"`
            * e o projetor avariado sumia do grupo Projeção: quem fosse ver
            * "o que temos na projeção" recebia uma resposta incompleta. */}
          {aba === "equipamentos" && (ministerios.length ? [...ministerios, { id: null, nome: "Geral" }] : [{ id: null, nome: "Geral" }]).map((m) => {
            const doM = equipamentos.filter((e) => e.ministerioId === m.id);
            if (!doM.length) return null;
            const chave = m.id ?? "geral";
            const aberto = estaAberto(chave);
            const comAvaria = doM.filter((e) => e.estado !== "ok").length;
            const cor = m.cor || "var(--cinza)";
            return (
              <div className="mincartao lv-equip" key={chave}>
                <div className="mincartao-barra" style={{ background: cor }} />
                <button className="mincartao-cab cabtoque lv-min" data-aberto={aberto ? 1 : 0} aria-expanded={aberto} onClick={() => alternar(chave)}>
                  <span className="ponto" style={{ background: cor }} />
                  <span className="nome">{m.nome}</span>
                  <span className="conta">
                    {doM.length} {doM.length === 1 ? "item" : "itens"}
                    {comAvaria > 0 && <b className="lv-equip-avaria"> · {comAvaria} avariado{comAvaria > 1 ? "s" : ""}</b>}
                  </span>
                  <span className="cabtoque-seta" aria-hidden="true">›</span>
                </button>
                {aberto && doM.map((e) => (
                  <div className="linha" style={{ cursor: "pointer" }} key={e.id} onClick={() => setSheet({ tipo: "detalheEquipamento", equipamentoId: e.id })}>
                    <div style={{ flex: 1 }}>
                      <p className="nmt">{e.nome}</p>
                      <p className="ds">
                        {[
                          (e.quantidade ?? 1) > 1 ? `${e.quantidade} unidades` : null,
                          e.modelo, e.local,
                        ].filter(Boolean).join(" · ") || "Sem detalhes"}
                      </p>
                    </div>
                    {e.estado !== "ok" && (
                      <span className={`tag ${e.estado === "em_reparacao" ? "lim" : ""}`}>{e.estado === "em_reparacao" ? "Em reparação" : "Avariado"}</span>
                    )}
                    {souLiderBase && (
                      <button className="lapis" onClick={(ev) => { ev.stopPropagation(); setSheet({ tipo: "editarEquipamento", equipamentoId: e.id }); }}>✎</button>
                    )}
                    <span className="seta">›</span>
                  </div>
                ))}
              </div>
            );
          })}

          {/* O histórico fica no fim e fechado: já não pede nada a
            * ninguém, mas é o que alimenta os artigos da Wiki. */}
          {aba === "melhorias" && melhoriasResolvidas.length > 0 && (
            <div className="mincartao lv-equip">
              <div className="mincartao-barra" style={{ background: "var(--verde)" }} />
              <button className="mincartao-cab cabtoque" data-aberto={estaAberto("resolvidas") ? 1 : 0}
                aria-expanded={estaAberto("resolvidas")} onClick={() => alternar("resolvidas")}>
                <span className="ponto" style={{ background: "var(--verde)" }} />
                <span className="nome">Já resolvidas</span>
                <span className="conta">{melhoriasResolvidas.length}</span>
                <span className="cabtoque-seta" aria-hidden="true">›</span>
              </button>
              {estaAberto("resolvidas") && (
                <div className="lv-equip-corpo">
                  {ordenarMelhorias(melhoriasResolvidas, "data").map((m) => cartaoMelhoria(m))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {sheet?.tipo === "novoEquipamento" && (
        <SheetEquipamento
          equipamento={null} ministerios={ministerios}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "detalheEquipamento" && (
        <SheetEquipamentoDetalhe
          equipamento={equipamentoAtual} melhorias={melhorias} ministerios={ministerios}
          onFechar={() => setSheet(null)}
          onReportarAvaria={() => setSheet({ tipo: "novaMelhoria", equipamentoId: sheet.equipamentoId })}
          onAbrirMelhoria={(melhoriaId) => setSheet({ tipo: "melhoria", melhoriaId, editar: true })}
        />
      )}
      {sheet?.tipo === "editarEquipamento" && (
        <SheetEquipamento
          equipamento={equipamentoAtual} ministerios={ministerios}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "novaMelhoria" && (
        <SheetNovaMelhoria
          equipamento={equipamentoAtual} ministerios={ministerios}
          tipo={sheet.reportar ?? "avaria"}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
      {sheet?.tipo === "melhoria" && (
        <SheetMelhoria
          melhoriaId={sheet.melhoriaId} uid={uid} papel={papel} voluntarios={voluntarios} equipamentos={equipamentos}
          editarInicial={sheet.editar} resolverInicial={sheet.resolver}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}
