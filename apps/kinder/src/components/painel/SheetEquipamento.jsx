import { useRef, useState } from "react";
import {
  criarEquipamento, guardarEquipamento, desativarEquipamento,
  novoEquipamentoId, enviarFotoEquipamento, TIPOS_EQUIPAMENTO,
} from "../../lib/equipamentos";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { CATEGORIAS as SALAS, varsCategoria } from "../../lib/modelo";

const TAMANHO_MAX = 6 * 1024 * 1024;

/** Criar/editar um equipamento da Kinder (ver lib/equipamentos.js).
 *  Mesma cara do SheetItemInventario, sem mínimo nem unidade — um
 *  equipamento não se gasta. */
export default function SheetEquipamento({ item, salaInicial, restrita, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const idRef = useRef(item?.id ?? novoEquipamentoId());
  const inputFotoRef = useRef(null);
  const [nome, setNome] = useState(item?.nome ?? "");
  const [tipo, setTipo] = useState(item?.tipo ?? "equipamento");
  const [sala, setSala] = useState(item?.local || restrita || salaInicial || "partilhado");
  const [quantidade, setQuantidade] = useState(item?.quantidade ?? 1);
  const [modelo, setModelo] = useState(item?.modelo ?? "");
  const [foto, setFoto] = useState(item?.foto ?? null);
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
      setFoto(await enviarFotoEquipamento(idRef.current, ficheiro));
    } catch (e2) {
      torrada(e2.message || "Não foi possível enviar a foto.");
    } finally {
      setAEnviarFoto(false);
    }
  }

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("O equipamento precisa de um nome");
    setAEnviar(true);
    try {
      const dados = {
        itemId: idRef.current, nome: n, tipo, local: sala,
        quantidade: Math.max(1, Math.round(Number(quantidade) || 1)),
        modelo: modelo.trim(), foto,
      };
      if (item) {
        await guardarEquipamento(dados);
        onGuardado("Equipamento atualizado");
      } else {
        await criarEquipamento(dados);
        onGuardado("Equipamento adicionado");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function desativar() {
    try {
      await desativarEquipamento(item.id);
      onGuardado("Equipamento removido");
    } catch (e) {
      torrada(e.message || "Não foi possível remover.");
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{item ? "Editar equipamento" : "Novo equipamento"}</h2>
        <label className="rot" style={{ marginTop: 14 }}>Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Impressora, cadeiras pequenas, mesa redonda" />
        <label className="rot">Tipo</label>
        <div className="subtabs">
          {TIPOS_EQUIPAMENTO.map((t) => (
            <button key={t.id} data-on={tipo === t.id ? 1 : 0} onClick={() => setTipo(t.id)}>{t.nome}</button>
          ))}
        </div>
        <label className="rot">Sala</label>
        <div className="kin-cats" style={{ marginBottom: 4 }}>
          {SALAS.filter((s) => !restrita || s.id === restrita).map((s) => (
            <button key={s.id} type="button" className="kin-cat" style={varsCategoria(s.id)} data-on={sala === s.id ? 1 : 0} onClick={() => setSala(s.id)}>
              {s.nome}
            </button>
          ))}
          <button type="button" className="kin-cat" style={varsCategoria(null)} data-on={sala === "partilhado" ? 1 : 0} onClick={() => setSala("partilhado")}>
            Partilhado
          </button>
        </div>
        <label className="rot">Quantidade</label>
        <input className="campo" type="number" min="1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        <label className="rot">Marca ou modelo (opcional)</label>
        <input className="campo" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ex.: HP DeskJet 2720" />
        <label className="rot">Foto</label>
        {foto && <img src={foto} className="fotofn" alt="" />}
        <input ref={inputFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={escolherFoto} />
        <button className="btn sec full" style={{ marginTop: 8 }} disabled={aEnviarFoto} onClick={() => inputFotoRef.current.click()}>
          {aEnviarFoto ? "A enviar…" : foto ? "Trocar foto" : "Juntar foto"}
        </button>
        <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar || aEnviarFoto} onClick={guardar}>Guardar</button>
        {item && <button className="btn sec full" style={{ marginTop: 9 }} onClick={desativar}>Remover equipamento</button>}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
