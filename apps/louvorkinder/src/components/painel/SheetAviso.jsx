import { useState } from "react";
import { criarAviso, editarAviso, criarModelo } from "../../lib/avisos";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { hojeISO } from "@portal/shared/lib/data.js";

const DURACAO_PADRAO = 3;
const pad2 = (n) => String(n).padStart(2, "0");
const dataMaisDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/**
 * Criar (ou editar, com `aviso`) um aviso — com uma lista de modelos
 * no topo (se houver) que só pré-preenche o formulário, nunca publica
 * sozinha (o líder confirma sempre com "Publicar"/"Guardar"). "Guardar
 * como modelo" só faz sentido a criar, não aparece a editar. Editar
 * (pedido do líder) reaproveita a mesma folha.
 *
 * "Até que data" (pedido do líder, 2026-09) em vez de "Duração em
 * dias" — mais fácil de bater o olho e saber exatamente quando some.
 * Um modelo ainda guarda `duracaoDias` (relativo, para reutilizar
 * semanas depois faz sentido) — ao escolher um modelo, a data
 * pré-enche a partir de hoje + essa duração, mas continua editável.
 */
export default function SheetAviso({ uid, aviso, modelos, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [texto, setTexto] = useState(aviso?.texto ?? "");
  const [urgencia, setUrgencia] = useState(aviso?.urgencia ?? "normal");
  const [ateData, setAteData] = useState(
    aviso?.expiraEm ? aviso.expiraEm.toDate().toISOString().slice(0, 10) : dataMaisDias(DURACAO_PADRAO)
  );
  const [guardarModelo, setGuardarModelo] = useState(false);
  const [nomeModelo, setNomeModelo] = useState("");
  const [aPublicar, setAPublicar] = useState(false);

  function usarModelo(m) {
    setTexto(m.texto);
    setUrgencia(m.urgencia);
    setAteData(dataMaisDias(m.duracaoDias));
  }

  async function publicar() {
    const t = texto.trim();
    if (!t) return torrada("Escreve o texto do aviso.");
    if (!ateData || ateData < hojeISO()) return torrada("Escolhe uma data válida, a partir de hoje.");
    if (!aviso && guardarModelo && !nomeModelo.trim()) return torrada("Dá um nome ao modelo, para o encontrares depois.");
    setAPublicar(true);
    try {
      if (aviso) {
        await editarAviso(aviso.id, { texto: t, urgencia, ateData });
      } else {
        await criarAviso(uid, { texto: t, urgencia, ateData });
        if (guardarModelo) {
          const duracaoDias = Math.max(1, Math.round((new Date(ateData) - new Date(hojeISO())) / 86400000) + 1);
          await criarModelo(uid, { nome: nomeModelo.trim(), texto: t, urgencia, duracaoDias });
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

        <label className="rot" style={{ marginTop: 12 }}>Até que data</label>
        <input
          className="campo" type="date" value={ateData} min={hojeISO()}
          onChange={(e) => setAteData(e.target.value)}
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
