import { useEffect, useState } from "react";
import {
  ouvirInventario, mexerQuantidade, definirQuantidade, ouvirListaCompraAberta,
  adicionarItemListaCompras, alterarQuantidadeItemListaCompras, removerItemListaCompras,
  fecharListaCompras,
} from "../lib/inventario";
import { obterMeuEvento } from "../lib/culto";
import { singularizar } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import ImagemExpandida from "@portal/shared/components/ImagemExpandida.jsx";
import SheetItemInventario from "../components/painel/SheetItemInventario";
import ListasComprasSalvas from "../components/ListasComprasSalvas";
import SeletorCategoria from "../components/SeletorCategoria";
import { categoriaInicial, minhaSalaRestrita, nomeCategoria, souLider, varsCategoria } from "../lib/modelo";

/** Estado de stock de um item — dá o texto, a cor e se mostra o
 *  atalho para a lista de compras, num sítio só. */
function estadoStock(item) {
  if (item.quantidade === 0) return { nivel: "esgotado", cor: "var(--magenta)", texto: "Esgotado" };
  if (item.quantidade <= item.minimo) return { nivel: "minimo", cor: "var(--magenta)", texto: `No mínimo (${item.minimo})` };
  if (item.quantidade === item.minimo + 1) return { nivel: "proximo", cor: "var(--laranja)", texto: `Quase no mínimo de ${item.minimo}` };
  return { nivel: "ok", cor: null, texto: `Mínimo ${item.minimo} ${singularizar(item.minimo, item.unidade)}` };
}

export default function Inventario({ uid, papel, pessoa, ativo, definirCabecalho, onIrReembolsos }) {
  const torrada = useTorrada();
  const souLiderBase = souLider(papel);
  const restrita = minhaSalaRestrita(papel, pessoa);
  const [itens, setItens] = useState([]);
  const [expandida, setExpandida] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [souLiderEscalaHoje, setSouLiderEscalaHoje] = useState(false);
  const [listaAberta, setListaAberta] = useState(null);
  const [aProcessarLista, setAProcessarLista] = useState(false);
  const [aEditarQtd, setAEditarQtd] = useState(null);
  const [sala, setSala] = useState(null);
  const [salaDefinida, setSalaDefinida] = useState(false);

  useEffect(() => {
    if (salaDefinida || !pessoa) return;
    setSala(categoriaInicial(papel, pessoa));
    setSalaDefinida(true);
  }, [pessoa, papel, salaDefinida]);
  useEffect(() => { if (restrita) setSala(restrita); }, [restrita]);

  useEffect(() => ouvirInventario(setItens), []);
  useEffect(() => ouvirListaCompraAberta(setListaAberta), []);
  useEffect(() => {
    if (souLiderBase) return;
    obterMeuEvento(uid).then((ev) => {
      const hoje = new Date().toISOString().slice(0, 10);
      setSouLiderEscalaHoje(ev?.data === hoje && ev.escala.liderEscala === uid);
    });
  }, [uid, souLiderBase]);

  const podeGerir = souLiderBase || souLiderEscalaHoje;

  const itensDaSala = sala ? itens.filter((i) => !i.sala || i.sala === sala || i.sala === "partilhado") : itens;
  const falta = itensDaSala.filter((i) => i.quantidade <= i.minimo);
  const categorias = [...new Set(itensDaSala.map((i) => i.categoria))];

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: <em>Compras</em>,
      subtitulo: "O material de cada sala e a lista de compras, sempre atualizados",
      chips: [`${itensDaSala.length} itens`, falta.length ? `${falta.length} no mínimo ou esgotados` : "Tudo em ordem"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, itensDaSala.length, falta.length]);

  async function mexer(item, delta) {
    try {
      const nova = await mexerQuantidade(item, delta, uid);
      if (nova <= item.minimo && delta < 0) torrada(`${item.nome} ficou no mínimo`);
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    }
  }

  async function guardarQtd(item, valor) {
    setAEditarQtd(null);
    const nova = Number(valor);
    if (!Number.isFinite(nova) || nova === item.quantidade) return;
    try {
      await definirQuantidade(item, nova, uid);
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    }
  }

  async function adicionarACompras(item) {
    try {
      const { jaAdicionado } = await adicionarItemListaCompras(item, listaAberta?.id, uid);
      torrada(jaAdicionado ? "Já estava na lista de compras" : `${item.nome} adicionado à lista de compras`);
    } catch (e) {
      torrada(e.message || "Não foi possível adicionar.");
    }
  }

  async function mexerQtdCompras(itemId, delta) {
    if (!listaAberta) return;
    try {
      await alterarQuantidadeItemListaCompras(listaAberta.id, itemId, delta);
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    }
  }

  async function removerDeCompras(itemId) {
    if (!listaAberta) return;
    try {
      await removerItemListaCompras(listaAberta.id, itemId);
    } catch (e) {
      torrada(e.message || "Não foi possível remover.");
    }
  }

  async function fechar(listaId) {
    setAProcessarLista(true);
    try {
      await fecharListaCompras(listaId);
      torrada("Lista fechada");
    } catch (e) {
      torrada(e.message || "Não foi possível fechar.");
    } finally {
      setAProcessarLista(false);
    }
  }

  return (
    <>
      <div className="sect" style={{ marginBottom: 0 }}>
        {restrita ? (
          <p className="kin-tagcat" style={varsCategoria(restrita)}>{nomeCategoria(restrita)}</p>
        ) : (
          <SeletorCategoria valor={sala} onMudar={setSala} rotuloTodas="Todas as salas" />
        )}
      </div>
      {podeGerir && (
        <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => setSheet({ tipo: "item", item: null, sala })}>
          Adicionar item
        </button>
      )}
      {categorias.map((cat) => (
        <div className="sect" key={cat}>
          <div className="cabecalho"><h3>{cat}</h3></div>
          {itensDaSala.filter((i) => i.categoria === cat).map((i) => {
            const estado = estadoStock(i);
            const jaNaLista = listaAberta?.itens?.some((it) => it.itemId === i.id);
            return (
              <div
                className="linha" key={i.id}
                style={estado.nivel === "esgotado" ? { background: "rgba(255,46,136,0.08)", borderRadius: 12, padding: "8px 6px" } : undefined}
              >
                {i.foto && (
                  <span
                    className="bola avfoto" style={{ width: 42, height: 42, backgroundImage: `url(${i.foto})`, cursor: "pointer" }}
                    onClick={() => setExpandida(i)}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <p className="nmt" style={{ minWidth: 0, flex: "0 1 auto" }}>{i.nome}</p>
                    {estado.nivel !== "ok" && (
                      jaNaLista ? (
                        <span
                          style={{
                            flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4,
                            padding: "4px 8px", fontSize: 10.5, fontWeight: 700, borderRadius: 8,
                            background: "rgba(0,25,190,0.1)", color: "var(--azul)",
                          }}
                        >
                          ✓ Adicionado
                        </span>
                      ) : (
                        <button
                          aria-label="Adicionar à lista de compras" title="Adicionar à lista de compras"
                          style={{
                            flexShrink: 0, whiteSpace: "nowrap", border: 0, cursor: "pointer",
                            padding: "5px 10px", fontSize: 14, borderRadius: 8, lineHeight: 1,
                            background: "rgba(106,113,146,0.12)", color: "var(--azul)",
                          }}
                          onClick={() => adicionarACompras(i)}
                        >
                          ➕🛒
                        </button>
                      )
                    )}
                  </div>
                  <p className="ds">
                    {estado.cor ? <span style={{ color: estado.cor, fontWeight: 600 }}>{estado.texto}</span> : estado.texto}
                  </p>
                  {i.observacoes && <p className="ds">{i.observacoes}</p>}
                  {i.sala && i.sala !== "partilhado" && <span className="kin-tagcat" style={{ marginTop: 4, display: "inline-block" }}>{nomeCategoria(i.sala)}</span>}
                  {podeGerir && (
                    <button
                      className="btn sec" style={{ marginTop: 8, padding: "6px 12px", fontSize: 12 }}
                      onClick={() => setSheet({ tipo: "item", item: i })}
                    >
                      Editar
                    </button>
                  )}
                </div>
                <div className="qtd">
                  <button className="qb" onClick={() => mexer(i, -1)}>−</button>
                  {aEditarQtd === i.id ? (
                    <input
                      className="qn" type="number" min="0" autoFocus defaultValue={i.quantidade}
                      style={{ width: 40, textAlign: "center", border: 0, background: "transparent" }}
                      onBlur={(e) => guardarQtd(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setAEditarQtd(null); }}
                    />
                  ) : (
                    <span className="qn" style={{ cursor: "pointer" }} onClick={() => setAEditarQtd(i.id)}>{i.quantidade}</span>
                  )}
                  <button className="qb" onClick={() => mexer(i, 1)}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ height: 8, background: "var(--agua)", borderRadius: 6, margin: "26px -4px 0" }} />

      <div className="sect">
        <div className="cabecalho" style={{ alignItems: "center", gap: 8 }}>
          <h3>Lista de compras</h3>
          {listaAberta && (
            <span className="tag" style={{ background: "var(--azul)", color: "#fff" }}>Lista aberta</span>
          )}
        </div>
        {listaAberta?.itens?.length ? (
          <>
            {listaAberta.itens.map((it) => (
              <div className="linha" key={it.itemId}>
                <div style={{ flex: 1 }}>
                  <p className="nmt">{it.nome}</p>
                </div>
                <div className="qtd">
                  <button className="qb" onClick={() => mexerQtdCompras(it.itemId, -1)}>−</button>
                  <span className="qn">{it.quantidade ?? 1}</span>
                  <button className="qb" onClick={() => mexerQtdCompras(it.itemId, 1)}>+</button>
                </div>
                <button
                  className="oc-icobt mag" aria-label={`Remover ${it.nome}`} title="Remover"
                  onClick={() => removerDeCompras(it.itemId)}
                >
                  ✕
                </button>
              </div>
            ))}
            {podeGerir && (
              <button
                className="btn sec full" style={{ marginTop: 10 }} disabled={aProcessarLista}
                onClick={() => fechar(listaAberta.id)}
              >
                Fechar lista
              </button>
            )}
          </>
        ) : (
          <div className="vaz">Aguardando itens.</div>
        )}
      </div>

      <ListasComprasSalvas podeGerir={podeGerir} />

      <div className="convite" onClick={onIrReembolsos} style={{ marginTop: 22 }}>
        <p className="cap">Compraste alguma coisa para a base?</p>
        <p style={{ fontSize: 17, fontWeight: 700, marginTop: 7, letterSpacing: "-.03em" }}>Pedir reembolso</p>
        <p className="ds" style={{ marginTop: 5 }}>Sobe a foto da nota e o valor. O líder trata do resto.</p>
      </div>
      <p className="nota">Cada alteração fica registada com o teu nome e a hora.</p>

      {expandida && (
        <ImagemExpandida src={expandida.foto} alt={expandida.nome} onFechar={() => setExpandida(null)} />
      )}
      {sheet?.tipo === "item" && (
        <SheetItemInventario
          item={sheet.item}
          salaInicial={sheet.sala}
          restrita={restrita}
          podeFoto={souLiderBase}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}
