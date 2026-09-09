import { useRef, useState } from "react";
import { criarEquipamento, guardarEquipamento, desativarEquipamento, novoEquipamentoId, enviarFotoEquipamento, enviarFaturaEquipamento } from "../../lib/equipamentos";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import FotoRedonda from "@portal/shared/components/FotoRedonda.jsx";

const TAMANHO_MAX = 6 * 1024 * 1024;
const TAMANHO_MAX_FATURA = 10 * 1024 * 1024;   // PDF de fatura é maior que uma foto comprimida

export default function SheetEquipamento({ equipamento, ministerios, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const idRef = useRef(equipamento?.id ?? novoEquipamentoId());
  const inputFotoRef = useRef(null);
  const inputFaturaRef = useRef(null);
  const [nome, setNome] = useState(equipamento?.nome ?? "");
  const [modelo, setModelo] = useState(equipamento?.modelo ?? "");
  const [nSerie, setNSerie] = useState(equipamento?.nSerie ?? "");
  const [quantidade, setQuantidade] = useState(String(equipamento?.quantidade ?? 1));
  const [local, setLocal] = useState(equipamento?.local ?? "");
  const [ministerioId, setMinisterioId] = useState(equipamento?.ministerioId ?? null);
  const [foto, setFoto] = useState(equipamento?.foto ?? null);
  const [aEnviarFoto, setAEnviarFoto] = useState(false);
  const [fatura, setFatura] = useState(equipamento?.fatura ?? null);
  const [aEnviarFatura, setAEnviarFatura] = useState(false);
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

  async function escolherFatura(e) {
    const ficheiro = e.target.files[0];
    e.target.value = "";
    if (!ficheiro) return;
    const tipoOk = ficheiro.type === "application/pdf" || ficheiro.type.startsWith("image/");
    if (!tipoOk) return torrada("A fatura tem de ser um PDF ou uma imagem.");
    if (ficheiro.size >= TAMANHO_MAX_FATURA) return torrada("A fatura tem de ter menos de 10 MB.");
    setAEnviarFatura(true);
    try {
      setFatura(await enviarFaturaEquipamento(idRef.current, ficheiro));
    } catch (e2) {
      torrada(e2.message || "Não foi possível enviar a fatura.");
    } finally {
      setAEnviarFatura(false);
    }
  }

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("O equipamento precisa de um nome");
    setAEnviar(true);
    try {
      const dados = { itemId: idRef.current, nome: n, modelo, nSerie, local, ministerioId, foto, quantidade: Number(quantidade || 1), fatura };
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
        {/* A fatura fica com o equipamento, não numa pasta à parte: é
          * ela que a loja pede quando o aparelho avaria dentro da
          * garantia, e é aqui que se vai procurar o aparelho. PDF ou
          * foto do papel — ver enviarFaturaEquipamento. */}
        <label className="rot">Fatura de compra</label>
        {fatura ? (
          <div className="linha" style={{ borderBottom: 0, paddingBottom: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <a href={fatura.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 13.5, color: "var(--azul)" }}>
                {fatura.nome || "Ver fatura"}
              </a>
              <p className="ds">Guardada com o equipamento, para a garantia.</p>
            </div>
            <button className="btn sec" style={{ padding: "7px 12px", fontSize: 12, color: "var(--magenta)" }} onClick={() => setFatura(null)}>
              Tirar
            </button>
          </div>
        ) : (
          <p className="ds" style={{ marginTop: 4 }}>Ainda sem fatura.</p>
        )}
        <input ref={inputFaturaRef} type="file" accept="application/pdf,image/*" style={{ display: "none" }} onChange={escolherFatura} />
        <button className="btn sec full" style={{ marginTop: 8 }} disabled={aEnviarFatura} onClick={() => inputFaturaRef.current.click()}>
          {aEnviarFatura ? "A enviar…" : fatura ? "Trocar fatura" : "Juntar fatura"}
        </button>

        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar || aEnviarFoto || aEnviarFatura} onClick={guardar}>Guardar</button>
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
