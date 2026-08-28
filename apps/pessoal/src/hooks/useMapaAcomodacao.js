import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@portal/shared/lib/firebase.js";
import { cAtribuicaoDrive, cEscala, cMapaAcomodacao } from "../lib/modelo";
import { estadoInicialLugares } from "../lib/geometriaAuditorio";

/**
 * Liga o estado ao vivo do mapa (eventos/{evento}/acomodacao/mapa) e
 * expõe `marcar(id, novoEstado)` — só tem efeito se `souDrive`; as
 * Firestore rules são a defesa real, isto é só para não desenhar
 * controlos que não fariam nada. Três perfis têm acesso: a líder da
 * base, quem tem a função "Mapa" nesse culto, e o Responsável do
 * culto (`escala.liderEscala`) — pedido explícito, o Responsável
 * manda no domingo dele mesmo sem ter a função Mapa atribuída.
 */
export function useMapaAcomodacao(eventoId, uid, papel) {
  const [mapa, setMapa] = useState(null);
  const [carregado, setCarregado] = useState(false);
  // A líder tem sempre acesso ao mapa — isto não depende de nenhum
  // documento, dá para saber já no 1º render. Só quem não é líder
  // precisa de esperar pela leitura de eventos/{evento}/atribuicoes/
  // drive (id fixo da função "Mapa") e de eventos/{evento}/escalas/
  // pessoal (para saber se é o Responsável) — aí sim, sem isso, um
  // toque logo a seguir a abrir a página não fazia nada — a leitura
  // ainda não tinha voltado e `souDrive` ainda estava a false).
  const [souDrive, setSouDrive] = useState(papel === "lider_base");
  const [temFuncaoMapa, setTemFuncaoMapa] = useState(false);
  const [souResponsavel, setSouResponsavel] = useState(false);

  const criouRef = useRef(false);

  useEffect(() => {
    if (!eventoId) { setTemFuncaoMapa(false); return; }
    return onSnapshot(cAtribuicaoDrive(eventoId), (s) => {
      const pessoas = s.exists() ? s.data().pessoas || [] : [];
      setTemFuncaoMapa(pessoas.includes(uid));
    });
  }, [eventoId, uid]);

  useEffect(() => {
    if (!eventoId) { setSouResponsavel(false); return; }
    return onSnapshot(cEscala(eventoId), (s) => {
      setSouResponsavel(s.exists() && s.data().liderEscala === uid);
    });
  }, [eventoId, uid]);

  useEffect(() => {
    setSouDrive(papel === "lider_base" || temFuncaoMapa || souResponsavel);
  }, [papel, temFuncaoMapa, souResponsavel]);

  useEffect(() => {
    if (!eventoId) return;
    criouRef.current = false;
    setCarregado(false);
    return onSnapshot(cMapaAcomodacao(eventoId), (s) => {
      setMapa(s.exists() ? s.data() : null);
      setCarregado(true);
    });
  }, [eventoId]);

  /** Cria o doc do culto na 1ª vez que quem tem a função Mapa abre o
   *  mapa, copiando reservados/bloqueios permanentes da planta. */
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

  /** Repõe todos os lugares ao estado de repouso da planta — para
   *  limpar dados de teste ou recomeçar a contagem de um culto. */
  function limparMapa(planta) {
    if (!souDrive || !eventoId || mapa?.fechado || !planta) return;
    updateDoc(cMapaAcomodacao(eventoId), {
      lugares: estadoInicialLugares(planta), atualizadoEm: serverTimestamp(),
    }).catch(() => {});
  }

  return { mapa, carregado, souDrive, marcar, garantirMapa, limparMapa };
}
