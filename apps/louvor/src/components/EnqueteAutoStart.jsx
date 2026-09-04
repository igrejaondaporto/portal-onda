import { useEffect, useState } from "react";
import { ouvirEnquetesAbertas, ouvirMinhaResposta, obterEventosPorIds, enqueteDispensada, dispensarEnquete } from "../lib/enquetes";
import SheetResponderEnquete from "./SheetResponderEnquete";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/** Monta-se uma vez em Sessao.jsx e força a folha de resposta assim
 *  que há enquete aberta e a pessoa ainda não respondeu — inspirado
 *  em TourAutoStart (packages/shared/lib/TourContext.jsx), mas ao
 *  vivo (onSnapshot) em vez de checagem única: se uma enquete abre a
 *  meio da sessão, a pessoa vê o popup sem precisar de sair e
 *  voltar a entrar. Bloqueante — ver bloqueante em
 *  SheetResponderEnquete. Fecha sozinho ao guardar: ouvirMinhaResposta
 *  atualiza `respostas` e `pendentes` esvazia. "Não sei ainda" fecha
 *  sem gravar resposta — dispensarEnquete grava no localStorage (não
 *  é voto, é só "agora não"), por isso sobrevive a recarregar a
 *  página; a pessoa continua a ver o balão fixo no Início (ver
 *  Inicio.jsx) até ao prazo. */
export default function EnqueteAutoStart({ uid }) {
  const torrada = useTorrada();
  const [enquetes, setEnquetes] = useState([]);
  const [respostas, setRespostas] = useState({});
  const [eventosPorId, setEventosPorId] = useState({});
  // localStorage não é reativo — este "forceUpdate" força reavaliar
  // `pendentes` (que lê enqueteDispensada a cada render) assim que
  // "Não sei ainda" grava uma dispensa nova. Valor em si nunca lido —
  // só o `set` importa, por isso fica sem nome (padrão comum do React).
  const [, forcarAtualizacao] = useState(0);

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

  const pendentes = enquetes.filter((e) => !respostas[e.id] && !enqueteDispensada(e.id));
  if (!pendentes.length) return null;

  return (
    <SheetResponderEnquete
      bloqueante
      enquetes={pendentes}
      eventosPorId={eventosPorId}
      minhasRespostas={respostas}
      onGuardado={(msg) => torrada(msg)}
      onNaoSeiAinda={() => {
        pendentes.forEach((e) => dispensarEnquete(e.id));
        forcarAtualizacao((v) => v + 1);
      }}
    />
  );
}
