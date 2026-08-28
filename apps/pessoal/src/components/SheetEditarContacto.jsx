import { useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { atualizarContacto } from "../lib/contactos";
import CamposLocalizacaoGD from "./CamposLocalizacaoGD";

export default function SheetEditarContacto({ contacto, gds, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const [nome, setNome] = useState(contacto.nome);
  const [telemovel, setTelemovel] = useState(contacto.telemovel);
  const [email, setEmail] = useState(contacto.email ?? "");
  const [concelho, setConcelho] = useState(contacto.concelho);
  const [freguesia, setFreguesia] = useState(contacto.freguesia);
  const [gdSugerido, setGdSugerido] = useState(contacto.gdSugerido ?? "");
  const [aGuardar, setAGuardar] = useState(false);

  async function guardar() {
    if (!nome.trim()) return torrada("Falta o nome.");
    if (telemovel.replace(/\D/g, "").length < 9) return torrada("Telemóvel inválido.");
    if (!concelho) return torrada("Escolhe o concelho.");
    if (!freguesia) return torrada("Escolhe a freguesia.");
    setAGuardar(true);
    try {
      await atualizarContacto(contacto.id, { nome, telemovel, email, concelho, freguesia, gdSugerido });
      onGuardado("Contacto atualizado");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
      setAGuardar(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-label="Editar visitante">
        <div className="pux" />
        <h2>Editar visitante</h2>

        <label className="rot" style={{ marginTop: 14 }}>Nome</label>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />

        <label className="rot">Telemóvel</label>
        <input
          className="campo" value={telemovel} inputMode="tel"
          onChange={(e) => setTelemovel(e.target.value)} placeholder="912 345 678"
        />

        <label className="rot">Email (opcional)</label>
        <input
          className="campo" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="nome@exemplo.com"
        />

        <CamposLocalizacaoGD
          concelho={concelho} setConcelho={setConcelho}
          freguesia={freguesia} setFreguesia={setFreguesia}
          gdSugerido={gdSugerido} setGdSugerido={setGdSugerido}
          gds={gds}
        />

        <button className="btn full" style={{ marginTop: 16 }} disabled={aGuardar} onClick={guardar}>
          {aGuardar ? "A guardar…" : "Guardar"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} disabled={aGuardar} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
