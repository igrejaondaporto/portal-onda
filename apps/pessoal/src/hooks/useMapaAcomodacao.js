import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";
import { cAtribuicaoDrive, cMapaAcomodacao } from "../lib/modelo";
import { estadoInicialLugares } from "../lib/geometriaAuditorio";

/**
 * Liga o estado ao vivo do mapa (eventos/{evento}/acomodacao/mapa) e
 * expõe `marcar(id, novoEstado)` — só tem efeito se `souDrive`; as
 * Firestore rules são a defesa real, isto é só para não desenhar
 * controlos que não fariam nada.
 */
export function useMapaAcomodacao(eventoId, uid, papel) {
  const [mapa, setMapa] = useState(null);
  const [carregado, setCarregado] = useState(false);
  const [souDrive, setSouDrive] = useState(false);
  const criouRef = useRef(false);

  useEffect(() => {
    if (!eventoId) return;
    return onSnapshot(cAtribuicaoDrive(eventoId), (s) => {
      const pessoas = s.exists() ? s.data().pessoas || [] : [];
      setSouDrive(papel === "lider_base" || pessoas.includes(uid));
    });
  }, [eventoId, uid, papel]);

  useEffect(() => {
    if (!eventoId) return;
    criouRef.current = false;
    setCarregado(false);
    return onSnapshot(cMapaAcomodacao(eventoId), (s) => {
      setMapa(s.exists() ? s.data() : null);
      setCarregado(true);
    });
  }, [eventoId]);

  /** Cria o doc do culto na 1ª vez que um Drive abre o mapa, copiando
   *  reservados/bloqueios permanentes da planta. */
  async function garantirMapa(planta) {
    if (mapa || criouRef.current || !souDrive || !eventoId || !planta) return;
    criouRef.current = true;
    await setDoc(doc(db, `eventos/${eventoId}/acomodacao/mapa`), {
      eventoId, fechado: false, lugares: estadoInicialLugares(planta),
      criadoEm: serverTimestamp(), iniciadoPor: uid,
    });
  }

  function marcar(id, novoEstado) {
    if (!souDrive || !eventoId || mapa?.fechado) return;
    updateDoc(cMapaAcomodacao(eventoId), { [`lugares.${id}`]: novoEstado, atualizadoEm: serverTimestamp() }).catch(() => {});
  }

  return { mapa, carregado, souDrive, marcar, garantirMapa };
}
