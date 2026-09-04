import { useState } from "react";
import { criarAviso, editarAviso, criarModelo } from "../../lib/avisos";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

const DURACAO_PADRAO = 3;

/**
 * Criar (ou editar, com `aviso`) um aviso — com uma lista de modelos
 * no topo (se houver) que só pré-preenche o formulário, nunca publica
 * sozinha (o líder confirma sempre com "Publicar"/"Guardar"). "Guardar
 * como modelo" só faz sentido a criar, não aparece a editar. Editar
 * (pedido do líder) reaproveita a mesma folha — o prazo (duração em
 * dias) conta sempre a partir de agora, mesmo padrão de criarAviso.
 */
export default function SheetAviso({ uid, aviso, modelos, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [texto, setTexto] = useState(aviso?.texto ?? "");
  const [urgencia, setUrgencia] = useState(aviso?.urgencia ?? "normal");
  const [duracaoDias, setDuracaoDias] = useState(String(aviso?.duracaoDias ?? DURACAO_PADRAO));
  const [guardarModelo, setGuardarModelo] = useState(false);
  const [nomeModelo, setNomeModelo] = useState("");
  const [aPublicar, setAPublicar] = useState(false);

  function usarModelo(m) {
    setTexto(m.texto);
    setUrgencia(m.urgencia);
    setDuracaoDias(String(m.duracaoDias));
  }

  async function publicar() {
    const t = texto.trim();
    if (!t) return torrada("Escreve o texto do aviso.");
    const dias = Number(duracaoDias);
    if (!dias || dias < 1) return torrada("A duração tem de ser pelo menos 1 dia.");
    if (!aviso && guardarModelo && !nomeModelo.trim()) return torrada("Dá um nome ao modelo, para o encontrares depois.");
    setAPublicar(true);
    try {
      if (aviso) {
        await editarAviso(aviso.id, { texto: t, urgencia, duracaoDias: dias });
      } else {
        await criarAviso(uid, { texto: t, urgencia, duracaoDias: dias });
        if (guardarModelo) {
          await criarModelo(uid, { nome: nomeModelo.trim(), texto: t, urgencia, duracaoDias: dias });
        }
      }
      onGuardado(aviso ? "Aviso atualizado" : "Aviso publicado");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    } finally {
      setAPublicar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{aviso ? "Editar aviso" : "Novo aviso"}</h2>

        {!aviso && modelos?.length > 0 && (
          <>
            <label className="rot" style={{ marginTop: 12 }}>Modelos guardados</label>
            <div className="bib-chips" style={{ margin: 0, padding: "4px 0" }}>
              {modelos.map((m) => (
                <button key={m.id} className="bib-chip" onClick={() => usarModelo(m)}>{m.nome}</button>
              ))}
            </div>
          </>
        )}

        <label className="rot" style={{ marginTop: 12 }}>Texto</label>
        <textarea
          className="campo" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex.: Domingo o ensaio passa para as 08:30."
        />

        <label className="rot">Urgência</label>
        <div className="subtabs">
          <button data-on={urgencia === "normal" ? 1 : 0} onClick={() => setUrgencia("normal")}>Normal</button>
          <button data-on={urgencia === "urgente" ? 1 : 0} onClick={() => setUrgencia("urgente")}>Urgente</button>
        </div>

        <label className="rot" style={{ marginTop: 12 }}>Duração (dias)</label>
        <input
          className="campo" inputMode="numeric" value={duracaoDias}
          onChange={(e) => setDuracaoDias(e.target.value.replace(/\D/g, ""))}
        />

        {!aviso && (
          <>
            <label className="opcao" style={{ marginTop: 14 }} onClick={() => setGuardarModelo((v) => !v)}>
              <span style={{ flex: 1 }}>Guardar como modelo, para reutilizar</span>
              <span className={`chk${guardarModelo ? " on" : ""}`}>✓</span>
            </label>
            {guardarModelo && (
              <input
                className="campo" style={{ marginTop: 8 }} value={nomeModelo} onChange={(e) => setNomeModelo(e.target.value)}
                placeholder="Nome do modelo, ex.: Sem ensaio"
              />
            )}
          </>
        )}

        <button className="btn full" style={{ marginTop: 18 }} disabled={aPublicar} onClick={publicar}>
          {aPublicar ? "A guardar…" : aviso ? "Guardar" : "Publicar"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
