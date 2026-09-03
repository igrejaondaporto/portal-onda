import { useEffect, useState } from "react";
import { ouvirEnquetesAbertas, ouvirMinhaResposta, obterEventosPorIds } from "../lib/enquetes";
import SheetResponderEnquete from "./SheetResponderEnquete";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/** Monta-se uma vez em Sessao.jsx e força a folha de resposta assim
 *  que há enquete aberta e a pessoa ainda não respondeu — inspirado
 *  em TourAutoStart (packages/shared/lib/TourContext.jsx), mas ao
 *  vivo (onSnapshot) em vez de checagem única: se uma enquete abre a
 *  meio da sessão, a pessoa vê o popup sem precisar de sair e
 *  voltar a entrar. Bloqueante — ver bloqueante em
 *  SheetResponderEnquete. Fecha sozinho: depois de guardar,
 *  ouvirMinhaResposta atualiza `respostas` e `pendentes` esvazia —
 *  sem estado de "dispensado" para gerir. */
export default function EnqueteAutoStart({ uid }) {
  const torrada = useTorrada();
  const [enquetes, setEnquetes] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [eventosPorId, setEventosPorId] = useState({});

  useEffect(() => {
    if (!uid) return;
    return ouvirEnquetesAbertas(setEnquetes);
  }, [uid]);

  useEffect(() => {
    if (!uid || !enquetes.length) { setRespostas({}); return; }
    const paragens = enquetes.map((e) =>
      ouvirMinhaResposta(e.id, uid, (r) => setRespostas((s) => ({ ...s, [e.id]: r })))
    );
    return () => paragens.forEach((p) => p());
  }, [enquetes, uid]);

  useEffect(() => {
    const todosIds = [...new Set(enquetes.flatMap((e) => e.domingos || []))];
    if (!todosIds.length) { setEventosPorId({}); return; }
    obterEventosPorIds(todosIds).then(setEventosPorId);
  }, [enquetes]);

  const pendentes = enquetes.filter((e) => !respostas[e.id]);
  if (!pendentes.length) return null;

  return (
    <SheetResponderEnquete
      bloqueante
      enquetes={pendentes}
      eventosPorId={eventosPorId}
      minhasRespostas={respostas}
      onGuardado={(msg) => torrada(msg)}
    />
  );
}
