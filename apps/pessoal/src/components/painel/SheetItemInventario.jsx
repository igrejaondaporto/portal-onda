import { useRef, useState } from "react";
import {
  criarItemInventario, guardarItemInventario, desativarItemInventario,
  novoItemInventarioId, enviarFotoItemInventario,
} from "../../lib/inventario";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const TAMANHO_MAX = 6 * 1024 * 1024;
const CATEGORIAS = ["Consumíveis", "Ceia", "Alimentação", "Branding"];

export default function SheetItemInventario({ item, podeFoto = true, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const idRef = useRef(item?.id ?? novoItemInventarioId());
  const inputFotoRef = useRef(null);
  const [nome, setNome] = useState(item?.nome ?? "");
  const [categoria, setCategoria] = useState(item?.categoria ?? CATEGORIAS[0]);
  // se o item já tiver uma categoria antiga fora da lista fixa, mantém-na visível
  const categorias = categoria && !CATEGORIAS.includes(categoria) ? [...CATEGORIAS, categoria] : CATEGORIAS;
  const [unidade, setUnidade] = useState(item?.unidade ?? "unidades");
  const [minimo, setMinimo] = useState(item?.minimo ?? 1);
  const [quantidade, setQuantidade] = useState(item?.quantidade ?? 0);
  const [foto, setFoto] = useState(item?.foto ?? null);
  const [observacoes, setObservacoes] = useState(item?.observacoes ?? "");
  const [aEnviarFoto, setAEnviarFoto] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  async function escolherFoto(e) {
    const ficheiro = e.target.files[0];
    e.target.value = "";
    if (!ficheiro) return;
    if (!ficheiro.type.startsWith("image/")) return torrada("Tem de ser uma imagem.");
    if (ficheiro.size >= TAMANHO_MAX) return torrada("A imagem tem de ter menos de 6 MB.");
    setAEnviarFoto(true);
    try {
      const url = await enviarFotoItemInventario(idRef.current, ficheiro);
      setFoto(url);
    } catch (e2) {
      torrada(e2.message || "Não foi possível enviar a foto.");
    } finally {
      setAEnviarFoto(false);
    }
  }

  async function guardar() {
    const n = nome.trim();
    const c = categoria.trim();
    if (!n) return torrada("O item precisa de um nome");
    if (!c) return torrada("Falta a categoria");
    setAEnviar(true);
    try {
      const dados = {
        nome: n, categoria: c, unidade: unidade.trim() || "unidades",
        minimo: Number(minimo) || 0, quantidade: Number(quantidade) || 0, foto,
        observacoes: observacoes.trim() || null,
      };
      if (item) {
        await guardarItemInventario(item.id, dados);
        onGuardado("Item atualizado");
      } else {
        await criarItemInventario(idRef.current, dados);
        onGuardado("Item criado no inventário");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function desativar() {
    try {
      await desativarItemInventario(item.id);
      onGuardado("Item removido do inventário");
    } catch (e) {
      torrada(e.message || "Não foi possível remover.");
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{item ? "Editar item" : "Novo item"}</h2>
        <label className="rot" style={{ marginTop: 14 }}>Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Detergente multiusos" />
        <label className="rot">Categoria</label>
        <div className="subtabs">
          {categorias.map((c) => (
            <button key={c} data-on={categoria === c ? 1 : 0} onClick={() => setCategoria(c)}>{c}</button>
          ))}
        </div>
        <div className="campos" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
          <div>
            <label className="rot">Unidade</label>
            <input className="campo" value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="unidades" />
          </div>
          <div>
            <label className="rot">Mínimo</label>
            <input className="campo" type="number" min="0" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
          </div>
        </div>
        <label className="rot">Quantidade atual</label>
        <input className="campo" type="number" min="0" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        <label className="rot">Observações (opcional)</label>
        <textarea
          className="campo" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Ex.: 2 pacotes fechados, um aberto"
        />
        {(podeFoto || foto) && (
          <>
            <label className="rot">Foto</label>
            {foto && <img src={foto} className="fotofn" alt="" />}
            {podeFoto && (
              <>
                <input ref={inputFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={escolherFoto} />
                <button
                  className="btn sec full" style={{ marginTop: 8 }} disabled={aEnviarFoto}
                  onClick={() => inputFotoRef.current.click()}
                >
                  {aEnviarFoto ? "A enviar…" : foto ? "Trocar foto" : "Juntar foto"}
                </button>
                <p className="ds" style={{ marginTop: 10 }}>
                  A foto ajuda quem não conhece o material a saber do que se trata.
                </p>
              </>
            )}
          </>
        )}
        <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar || aEnviarFoto} onClick={guardar}>Guardar</button>
        {item && <button className="btn sec full" style={{ marginTop: 9 }} onClick={desativar}>Remover do inventário</button>}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
