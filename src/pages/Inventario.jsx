import { useEffect, useState } from "react";
import { ouvirInventario, mexerQuantidade } from "../lib/inventario";
import { useTorrada } from "../lib/TorradaContext";
import ImagemExpandida from "../components/ImagemExpandida";
import SheetItemInventario from "../components/painel/SheetItemInventario";

export default function Inventario({ uid, papel, ativo, definirCabecalho, onIrReembolsos }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const [itens, setItens] = useState([]);
  const [expandida, setExpandida] = useState(null);
  const [sheet, setSheet] = useState(null);

  useEffect(() => ouvirInventario(setItens), []);

  const falta = itens.filter((i) => i.quantidade < i.minimo);
  const categorias = [...new Set(itens.map((i) => i.categoria))];

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Inventário",
      subtitulo: "O material da base, sempre atualizado",
      chips: [`${itens.length} itens`, falta.length ? `${falta.length} abaixo do mínimo` : "Tudo em ordem"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, itens.length, falta.length]);

  async function mexer(item, delta) {
    try {
      const nova = await mexerQuantidade(item, delta, uid);
      if (nova < item.minimo && delta < 0) torrada(`${item.nome} ficou abaixo do mínimo`);
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    }
  }

  return (
    <>
      {souLiderBase && (
        <button className="btn sec full" style={{ marginTop: 4 }} onClick={() => setSheet({ tipo: "item", item: null })}>
          Adicionar item
        </button>
      )}
      {categorias.map((cat) => (
        <div className="sect" key={cat}>
          <div className="cabecalho"><h3>{cat}</h3></div>
          {itens.filter((i) => i.categoria === cat).map((i) => (
            <div className="linha" key={i.id}>
              {i.foto && (
                <span
                  className="bola avfoto" style={{ width: 42, height: 42, backgroundImage: `url(${i.foto})`, cursor: "pointer" }}
                  onClick={() => setExpandida(i)}
                />
              )}
              <div style={{ flex: 1 }}>
                <p className="nmt">{i.nome}</p>
                <p className="ds">
                  {i.quantidade < i.minimo
                    ? <span style={{ color: "var(--magenta)", fontWeight: 600 }}>Abaixo do mínimo de {i.minimo}</span>
                    : `Mínimo ${i.minimo} ${i.unidade}`}
                </p>
              </div>
              {souLiderBase && (
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
          ))}
        </div>
      ))}
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
          onFechar={() => setSheet(null)}
          onGuardado={(msg) => { setSheet(null); torrada(msg); }}
        />
      )}
    </>
  );
}
