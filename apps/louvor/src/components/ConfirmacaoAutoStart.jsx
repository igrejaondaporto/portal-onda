import { useEffect, useState } from "react";
import { ouvirEventosDoMes, ouvirVoluntarios } from "../lib/painel";
import { ouvirConfirmacoesDoMes } from "../lib/confirmacao";
import SheetConfirmarPresenca from "./SheetConfirmarPresenca";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/** Monta-se uma vez em Sessao.jsx e força o popup de confirmação de
 *  presença assim que há um culto publicado (Fase C) em que a pessoa
 *  está escalada e ainda não respondeu — "o popup obrigatório da
 *  enquete, mas para a confirmação" (pedido do líder). Ao vivo
 *  (onSnapshot via ouvirConfirmacoesDoMes): publicar a meio da sessão
 *  já dispara, sem precisar sair e voltar a entrar.
 *
 *  Só olha para o mês corrente — mesma limitação prática do
 *  Calendário (não há uma coleção só de "escalas publicadas",
 *  escalas vivem por culto; ver CLAUDE.md desta base). Uma escala
 *  publicada com muita antecedência para o mês seguinte só dispara o
 *  popup automático quando esse mês chegar — o balão no Início
 *  continua a valer para esse caso enquanto isso. */
export default function ConfirmacaoAutoStart({ uid }) {
  const torrada = useTorrada();
  const hoje = new Date();
  const [eventosMes, setEventosMes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [respostas, setRespostas] = useState(new Map());

  useEffect(() => {
    if (!uid) return;
    return ouvirEventosDoMes(hoje.getFullYear(), hoje.getMonth(), setEventosMes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirConfirmacoesDoMes(eventosMes, uid, setRespostas), [eventosMes, uid]);

  const pendentes = eventosMes.filter(
    (ev) => ev.escala?.publicado && (ev.escala.pessoas || []).includes(uid) && !respostas.has(ev.id)
  );
  if (!pendentes.length) return null;

  const minhasRespostas = Object.fromEntries(
    pendentes.map((ev) => [ev.id, respostas.get(ev.id)]).filter(([, v]) => v)
  );

  return (
    <SheetConfirmarPresenca
      bloqueante
      cultos={pendentes}
      minhasRespostas={minhasRespostas}
      pessoaPorId={(id) => voluntarios.find((p) => p.id === id)}
      onGuardado={(msg) => torrada(msg)}
    />
  );
}
