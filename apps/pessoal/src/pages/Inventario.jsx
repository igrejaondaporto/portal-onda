import { useEffect, useState } from "react";
import {
  ouvirInventario, mexerQuantidade, ouvirListaCompraAberta, ouvirListasComprasSalvas,
  adicionarItemListaCompras, fecharListaCompras, enviarListaCompras,
  linkListaComprasWhatsApp,
} from "../lib/inventario";
import { obterMeuEvento } from "../lib/culto";
import { singularizar, dataTimestamp } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import ImagemExpandida from "@portal/shared/components/ImagemExpandida.jsx";
import SheetItemInventario from "../components/painel/SheetItemInventario";

/** Estado de stock de um item — dá o texto, a cor e se mostra o
 *  atalho para a lista de compras, num sítio só. */
function estadoStock(item) {
  if (item.quantidade === 0) return { nivel: "esgotado", cor: "var(--magenta)", texto: "Esgotado" };
  if (item.quantidade <= item.minimo) return { nivel: "minimo", cor: "var(--magenta)", texto: `No mínimo (${item.minimo})` };
  if (item.quantidade === item.minimo + 1) return { nivel: "proximo", cor: "var(--laranja)", texto: `Quase no mínimo de ${item.minimo}` };
  return { nivel: "ok", cor: null, texto: `Mínimo ${item.minimo} ${singularizar(item.minimo, item.unidade)}` };
}

const ROTULO_ESTADO_LISTA = {
  aberta: "Lista aberta", fechada: "Lista fechada", enviada: "Lista enviada para compras",
};
const COR_ESTADO_LISTA = { aberta: "var(--azul)", fechada: "var(--laranja)", enviada: "var(--verde)" };

export default function Inventario({ uid, papel, ativo, definirCabecalho, onIrReembolsos }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const [itens, setItens] = useState([]);
  const [expandida, setExpandida] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [souLiderEscalaHoje, setSouLiderEscalaHoje] = useState(false);
  const [listaAberta, setListaAberta] = useState(null);
  const [listasSalvas, setListasSalvas] = useState([]);
  const [aProcessarLista, setAProcessarLista] = useState(false);

  useEffect(() => ouvirInventario(setItens), []);
  useEffect(() => ouvirListaCompraAberta(setListaAberta), []);
  useEffect(() => ouvirListasComprasSalvas(setListasSalvas), []);
  useEffect(() => {
    if (souLiderBase) return;
    obterMeuEvento(uid).then((ev) => {
      const hoje = new Date().toISOString().slice(0, 10);
      setSouLiderEscalaHoje(ev?.data === hoje && ev.escala.liderEscala === uid);
    });
  }, [uid, souLiderBase]);

  const podeGerir = souLiderBase || souLiderEscalaHoje;

  const falta = itens.filter((i) => i.quantidade <= i.minimo);
  const categorias = [...new Set(itens.map((i) => i.categoria))];

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Inventário",
      subtitulo: "O material da base, sempre atualizado",
      chips: [`${itens.length} itens`, falta.length ? `${falta.length} no mínimo ou esgotados` : "Tudo em ordem"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, itens.length, falta.length]);

  async function mexer(item, delta) {
    try {
      const nova = await mexerQuantidade(item, delta, uid);
      if (nova <= item.minimo && delta < 0) torrada(`${item.nome} ficou no mínimo`);
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    }
  }

  async function adicionarACompras(item) {
    if (!listaAberta) return torrada("Sem lista de compras aberta.");
    try {
      const { jaAdicionado } = await adicionarItemListaCompras(listaAberta.id, { itemId: item.id, nome: item.nome }, uid);
      torrada(jaAdicionado ? "Já estava na lista de compras" : `${item.nome} adicionado à lista de compras`);
    } catch (e) {
      torrada(e.message || "Não foi possível adicionar.");
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

  async function enviar(lista) {
    window.open(linkListaComprasWhatsApp(lista), "_blank", "noopener");
    setAProcessarLista(true);
    try {
      await enviarListaCompras(lista.id);
      torrada("Lista marcada como enviada");
    } catch (e) {
      torrada(e.message || "Não foi possível marcar como enviada.");
    } finally {
      setAProcessarLista(false);
    }
  }

  return (
    <>
      {podeGerir && (
        <button className="btn sec full" style={{ marginTop: 4 }} onClick={() => setSheet({ tipo: "item", item: null })}>
          Adicionar item
        </button>
      )}
      {categorias.map((cat) => (
        <div className="sect" key={cat}>
          <div className="cabecalho"><h3>{cat}</h3></div>
          {itens.filter((i) => i.categoria === cat).map((i) => {
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
                <div style={{ flex: 1 }}>
                  <p className="nmt">{i.nome}</p>
                  <p className="ds">
                    {estado.cor ? <span style={{ color: estado.cor, fontWeight: 600 }}>{estado.texto}</span> : estado.texto}
                  </p>
                  {i.observacoes && <p className="ds">{i.observacoes}</p>}
                  {estado.nivel !== "ok" && (
                    jaNaLista ? (
                      <button className="btn sec" disabled style={{ marginTop: 6, padding: "6px 10px", fontSize: 11.5, opacity: 0.7 }}>
                        Item já adicionado à lista de compras
                      </button>
                    ) : (
                      <button
                        className="btn sec" style={{ marginTop: 6, padding: "6px 10px", fontSize: 11.5 }}
                        onClick={() => adicionarACompras(i)}
                      >
                        Adicionar à lista de compras
                      </button>
                    )
                  )}
                </div>
                {podeGerir && (
                  <button className="btn sec" style={{ padding: "7px 12px", fontSize: 12, marginRight: 4 }} onClick={() => setSheet({ tipo: "item", item: i })}>
                    Editar
                  </button>
                )}
                <div className="qtd">
                  <button className="qb" onClick={() => mexer(i, -1)}>−</button>
                  <span className="qn">{i.quantidade}</span>
                  <button className="qb" onClick={() => mexer(i, 1)}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div className="sect">
        <div className="cabecalho" style={{ alignItems: "center", gap: 8 }}>
          <h3>Lista de compras</h3>
          {listaAberta && (
            <span className="tag" style={{ background: COR_ESTADO_LISTA.aberta, color: "#fff" }}>
              {ROTULO_ESTADO_LISTA.aberta}
            </span>
          )}
        </div>
        {listaAberta?.itens?.length ? (
          <>
            {listaAberta.itens.map((it) => (
              <div className="linha" key={it.itemId}>
                <div style={{ flex: 1 }}>
                  <p className="nmt">{it.nome}</p>
                </div>
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

      {listasSalvas.length > 0 && (
        <div className="sect">
          <div className="cabecalho"><h3>Listas salvas</h3></div>
          {listasSalvas.map((l) => (
            <div key={l.id} style={{ marginBottom: 12 }}>
              <div className="linha">
                <div style={{ flex: 1 }}>
                  <p className="nmt">{dataTimestamp(l.criadaEm)} · {(l.itens || []).length} {(l.itens || []).length === 1 ? "item" : "itens"}</p>
                  <p className="ds">{(l.itens || []).map((it) => it.nome).join(", ") || "Sem itens"}</p>
                </div>
                <span className="tag" style={{ background: COR_ESTADO_LISTA[l.estado], color: "#fff" }}>
                  {ROTULO_ESTADO_LISTA[l.estado]}
                </span>
              </div>
              {l.estado === "fechada" && podeGerir && (
                <button
                  className="btn sec full" style={{ marginTop: 4 }} disabled={aProcessarLista}
                  onClick={() => enviar(l)}
                >
                  Enviar para compras
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="destaque" onClick={onIrReembolsos} style={{ marginTop: 22, cursor: "pointer" }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>Compraste alguma coisa para a base?</p>
          <p style={{ fontSize: 17, fontWeight: 700, marginTop: 5, letterSpacing: "-.03em" }}>Pedir reembolso</p>
          <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 3 }}>Sobe a foto da nota e o valor. O líder trata do resto.</p>
        </div>
        <span style={{ fontSize: 24 }}>›</span>
      </div>
      <p className="nota">Cada alteração fica registada com o teu nome e a hora.</p>

      {expandida && (
        <ImagemExpandida src={expandida.foto} alt={expandida.nome} onFechar={() => setExpandida(null)} />
      )}
      {sheet?.tipo === "item" && (
        <SheetItemInventario
          item={sheet.item}
          podeFoto={souLiderBase}
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}
