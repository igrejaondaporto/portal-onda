import { useRef, useState } from "react";
import { criarEquipamento, guardarEquipamento, desativarEquipamento, novoEquipamentoId, enviarFotoEquipamento } from "../../lib/equipamentos";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import FotoRedonda from "@portal/shared/components/FotoRedonda.jsx";
import { TIPOS_PATRIMONIO } from "@portal/shared/lib/tiposPatrimonio.js";

const TAMANHO_MAX = 6 * 1024 * 1024;

export default function SheetEquipamento({ equipamento, ministerios, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const idRef = useRef(equipamento?.id ?? novoEquipamentoId());
  const inputFotoRef = useRef(null);
  const [nome, setNome] = useState(equipamento?.nome ?? "");
  const [modelo, setModelo] = useState(equipamento?.modelo ?? "");
  const [nSerie, setNSerie] = useState(equipamento?.nSerie ?? "");
  const [quantidade, setQuantidade] = useState(String(equipamento?.quantidade ?? 1));
  const [local, setLocal] = useState(equipamento?.local ?? "");
  const [ministerioId, setMinisterioId] = useState(equipamento?.ministerioId ?? null);
  const [foto, setFoto] = useState(equipamento?.foto ?? null);
  const [aEnviarFoto, setAEnviarFoto] = useState(false);
  const [tipo, setTipo] = useState(equipamento?.tipo ?? "instrumento");
  const [valorCompra, setValorCompra] = useState(equipamento?.valorCompra ? String(equipamento.valorCompra) : "");
  const [aEnviar, setAEnviar] = useState(false);

  async function escolherFoto(e) {
    const ficheiro = e.target.files[0];
    e.target.value = "";
    if (!ficheiro) return;
    if (!ficheiro.type.startsWith("image/")) return torrada("Tem de ser uma imagem.");
    if (ficheiro.size >= TAMANHO_MAX) return torrada("A imagem tem de ter menos de 6 MB.");
    setAEnviarFoto(true);
    try {
      const url = await enviarFotoEquipamento(idRef.current, ficheiro);
      setFoto(url);
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
        itemId: idRef.current, nome: n, modelo, nSerie, local, ministerioId, foto, tipo,
        quantidade: Number(quantidade || 1), valorCompra: valorCompra ? Number(valorCompra) : null,
      };
      if (equipamento) {
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
      await desativarEquipamento(equipamento.id);
      onGuardado("Equipamento removido do catálogo");
    } catch (e) {
      torrada(e.message || "Não foi possível remover.");
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{equipamento ? "Editar equipamento" : "Novo equipamento"}</h2>
        <label className="rot" style={{ marginTop: 14 }}>Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Mesa de som" />
        {/* Um registo por modelo, com quantas unidades há — não uma ficha
          * por unidade. Comprar um terceiro COB obrigaria a inventar um
          * "COB central", e o sítio onde está pendurado não é identidade
          * do equipamento. Qual delas avariou diz-se na avaria. */}
        <label className="rot">Quantas unidades</label>
        <input className="campo" type="number" inputMode="numeric" min="1" max="999"
          value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />

        <label className="rot">Modelo</label>
        <input className="campo" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ex.: Behringer X32" />
        <label className="rot">Nº de série</label>
        <input className="campo" value={nSerie} onChange={(e) => setNSerie(e.target.value)} placeholder="Opcional" />
        <label className="rot">Local</label>
        <input className="campo" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Armário do palco" />
        {/* Os dois campos abaixo só servem o Relatório do Financeiro
          * (quanto temos em quê, quanto vale) — não aparecem em mais
          * lado nenhum desta app. */}
        <label className="rot">Tipo de património</label>
        <select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS_PATRIMONIO.map(([id, rotulo]) => (
            <option key={id} value={id}>{rotulo}</option>
          ))}
        </select>
        <label className="rot">Valor de compra (opcional)</label>
        <input className="campo" type="number" inputMode="decimal" value={valorCompra} onChange={(e) => setValorCompra(e.target.value)} placeholder="0,00" />
        {ministerios?.length > 0 && (
          <>
            <label className="rot">Ministério</label>
            <div className="subtabs">
              {ministerios.map((m) => (
                <button key={m.id} data-on={ministerioId === m.id ? 1 : 0} onClick={() => setMinisterioId(m.id)}>{m.nome}</button>
              ))}
            </div>
          </>
        )}
        <label className="rot">Foto</label>
        {foto && <div style={{ marginTop: 6 }}><FotoRedonda src={foto} alt={nome} tamanho={90} /></div>}
        <input ref={inputFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={escolherFoto} />
        <button className="btn sec full" style={{ marginTop: 8 }} disabled={aEnviarFoto} onClick={() => inputFotoRef.current.click()}>
          {aEnviarFoto ? "A enviar…" : foto ? "Trocar foto" : "Juntar foto"}
        </button>
        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar || aEnviarFoto} onClick={guardar}>Guardar</button>
        {equipamento && (
          <button className="btn sec full" style={{ marginTop: 9, color: "var(--magenta)" }} onClick={desativar}>
            Remover do catálogo
          </button>
        )}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
