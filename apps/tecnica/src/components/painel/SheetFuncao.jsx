import { useRef, useState } from "react";
import { criarFuncao, guardarFuncao, desativarFuncao, novoFuncaoId, enviarFotoFuncao } from "../../lib/painel";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { ICF, ICF_NOMES, svgFn } from "../../lib/iconesFuncao";
import { FASES } from "../../lib/modelo";
import { dataPorExtenso } from "@portal/shared/lib/data.js";

const TAMANHO_MAX = 6 * 1024 * 1024;

export default function SheetFuncao({ funcao, ministerios, ministerioAtual, eventosDisponiveis, eventoAtual, souLiderBase = true, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const idRef = useRef(funcao?.id ?? novoFuncaoId());
  const inputFotoRef = useRef(null);
  const [nome, setNome] = useState(funcao?.nome ?? "");
  const [descricao, setDescricao] = useState(funcao?.descricao ?? "");
  const [ministerioId, setMinisterioId] = useState(funcao?.ministerioId ?? ministerioAtual ?? ministerios?.[0]?.id ?? null);
  const [fase, setFase] = useState(funcao?.fase ?? "pre");
  const [icone, setIcone] = useState(funcao?.icone ?? "brilho");
  const [escopo, setEscopo] = useState(funcao?.eventoId ?? eventoAtual ?? null);
  const [foto, setFoto] = useState(funcao?.foto ?? null);
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
      const url = await enviarFotoFuncao(idRef.current, ficheiro);
      setFoto(url);
    } catch (e2) {
      torrada(e2.message || "Não foi possível enviar a foto.");
    } finally {
      setAEnviarFoto(false);
    }
  }

  async function guardar() {
    const n = nome.trim();
    if (!n) return torrada("A função precisa de um nome");
    setAEnviar(true);
    if (ministerios?.length && !ministerioId) return torrada("Falta o ministério.");
    try {
      const dados = { nome: n, descricao: descricao.trim(), fase, icone, eventoId: escopo || null, foto, ministerioId };
      if (funcao) {
        await guardarFuncao(funcao.id, dados);
        onGuardado(escopo ? "Função atualizada — só neste culto" : "Função atualizada");
      } else {
        await criarFuncao(idRef.current, dados);
        onGuardado(escopo ? "Função criada só para este culto" : "Função criada no catálogo");
      }
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAEnviar(false);
    }
  }

  async function desativar() {
    try {
      await desativarFuncao(funcao.id);
      onGuardado("Função desativada — o histórico mantém-se");
    } catch (e) {
      torrada(e.message || "Não foi possível desativar.");
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{funcao ? "Editar função" : "Nova função"}</h2>
        <label className="rot" style={{ marginTop: 14 }}>Nome curto</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Sala de amamentação" />
        <label className="rot">Onde aparece</label>
        {souLiderBase ? (
          <>
            <div className="subtabs">
              <button data-on={!escopo ? 1 : 0} onClick={() => setEscopo(null)}>Todos os cultos</button>
              <button
                data-on={escopo ? 1 : 0}
                disabled={!eventosDisponiveis.length}
                onClick={() => setEscopo(escopo || eventoAtual || eventosDisponiveis[0]?.id || null)}
              >
                Só um culto
              </button>
            </div>
            {escopo && (
              <div className="subtabs">
                {eventosDisponiveis.map((e) => (
                  <button key={e.id} data-on={escopo === e.id ? 1 : 0} onClick={() => setEscopo(e.id)}>
                    {e.tipo ? `✦ ${dataPorExtenso(e.data)}` : dataPorExtenso(e.data)}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="caixa" style={{ background: "var(--agua)", border: 0, marginTop: 8 }}>
            <p className="ds">
              Como líder de escala, esta função entra só no culto de{" "}
              {(() => {
                const ev = eventosDisponiveis.find((e) => e.id === eventoAtual);
                return ev ? (ev.tipo || dataPorExtenso(ev.data)) : "hoje";
              })()}.
            </p>
          </div>
        )}
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
        <label className="rot">Quando se faz</label>
        <div className="subtabs">
          {FASES.map(([k, t]) => (
            <button key={k} data-on={fase === k ? 1 : 0} onClick={() => setFase(k)}>{t}</button>
          ))}
        </div>
        <label className="rot">Símbolo</label>
        <div className="icgrid">
          {Object.keys(ICF).map((k) => (
            <button
              key={k}
              type="button"
              className="icbt"
              data-on={icone === k ? 1 : 0}
              title={ICF_NOMES[k]}
              onClick={() => setIcone(k)}
              dangerouslySetInnerHTML={{ __html: svgFn(k, 21) }}
            />
          ))}
        </div>
        <label className="rot">Como se faz</label>
        <textarea
          className="campo" rows={5} value={descricao} onChange={(e) => setDescricao(e.target.value)}
          placeholder="O passo a passo que a pessoa vê quando abre esta função"
        />
        <label className="rot">Foto de exemplo</label>
        {foto && <img src={foto} className="fotofn" alt="" />}
        <input ref={inputFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={escolherFoto} />
        <button
          className="btn sec full" style={{ marginTop: 8 }} disabled={aEnviarFoto}
          onClick={() => inputFotoRef.current.click()}
        >
          {aEnviarFoto ? "A enviar…" : foto ? "Trocar foto" : "Juntar foto"}
        </button>
        <button className="btn full" style={{ marginTop: 18 }} disabled={aEnviar || aEnviarFoto} onClick={guardar}>Guardar</button>
        {funcao && <button className="btn sec full" style={{ marginTop: 9 }} onClick={desativar}>Desativar função</button>}
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
