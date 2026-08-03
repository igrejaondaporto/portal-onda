import { useEffect, useState } from "react";
import { ouvirInventario, mexerQuantidade } from "../lib/inventario";
import { useTorrada } from "../lib/TorradaContext";

export default function Inventario({ uid, definirCabecalho, onIrReembolsos }) {
  const torrada = useTorrada();
  const [itens, setItens] = useState([]);

  useEffect(() => ouvirInventario(setItens), []);

  const falta = itens.filter((i) => i.quantidade < i.minimo);
  const categorias = [...new Set(itens.map((i) => i.categoria))];

  useEffect(() => {
    definirCabecalho({
      titulo: "Inventário",
      subtitulo: "O material da base, sempre atualizado",
      chips: [`${itens.length} itens`, falta.length ? `${falta.length} abaixo do mínimo` : "Tudo em ordem"],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens.length, falta.length]);

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
      {categorias.map((cat) => (
        <div className="sect" key={cat}>
          <div className="cabecalho"><h3>{cat}</h3></div>
          {itens.filter((i) => i.categoria === cat).map((i) => (
            <div className="linha" key={i.id}>
              <div style={{ flex: 1 }}>
                <p className="nmt">{i.nome}</p>
                <p className="ds">
                  {i.quantidade < i.minimo
                    ? <span style={{ color: "var(--magenta)", fontWeight: 600 }}>Abaixo do mínimo de {i.minimo}</span>
                    : `Mínimo ${i.minimo} ${i.unidade}`}
                </p>
              </div>
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
    </>
  );
}
