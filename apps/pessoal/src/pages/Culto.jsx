import { useEffect, useRef, useState } from "react";
import { ouvirVoluntarios, ouvirEventosDoMes, ouvirBase } from "../lib/painel";
import { obterOrdemCulto, obterMeuEvento } from "../lib/culto";
import { hojeISO } from "@portal/shared/lib/data.js";
import OrdemCultoCard from "../components/culto/OrdemCultoCard";
import ContagemCulto from "../components/ContagemCulto";
import Inventario from "./Inventario";

const SEM_CABECALHO = () => {};

const SUBTITULOS = {
  ordem: "A ordem do culto que o pastor envia",
  inventario: "O material da base, sempre atualizado",
  contagem: "Cada número tem o seu próprio significado",
};

/**
 * Três coisas que giram à volta do próprio domingo, antes vivendo
 * espalhadas (Contagem no Início, Inventário na sua própria aba,
 * Ordem do culto nem tinha interface): agrupadas aqui, a pedido do
 * dono do produto — o menu principal fica mais curto e cada uma
 * continua exatamente com a lógica que já tinha (Inventário e
 * Contagem são os mesmos componentes de sempre, só que embrulhados
 * numa subaba em vez de página própria).
 */
export default function Culto({
  uid, papel, mes, ano, abaInicial, ativo, definirCabecalho,
  onVerFuncoes, podePublicarCulto, onIrReembolsos,
}) {
  const souLiderBase = papel === "lider_base";
  const podePublicar = souLiderBase && podePublicarCulto;
  const [aba, setAba] = useState(abaInicial ?? "ordem");
  const [eventosMes, setEventosMes] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [base, setBase] = useState(null);
  const [ordens, setOrdens] = useState({});
  const [cardAberto, setCardAberto] = useState(null);
  const [meuEvento, setMeuEvento] = useState(null);

  useEffect(() => ouvirBase(setBase), []);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);
  useEffect(() => ouvirEventosDoMes(ano, mes, setEventosMes), [ano, mes]);
  useEffect(() => { obterMeuEvento(uid).then(setMeuEvento); }, [uid]);
  useEffect(() => { setAba(abaInicial ?? "ordem"); }, [abaInicial]);

  useEffect(() => {
    if (!eventosMes.length) return;
    let cancelado = false;
    Promise.all(eventosMes.map((ev) => obterOrdemCulto(ev.id).then((url) => [ev.id, url])))
      .then((pares) => { if (!cancelado) setOrdens(Object.fromEntries(pares)); });
    return () => { cancelado = true; };
  }, [eventosMes]);

  // um único cronograma aberto de cada vez, por defeito o do próximo
  // culto por data (ou o último, se já não houver nenhum por vir este
  // mês) — mas só na primeira vez; depois disso é o clique que manda.
  const escolheuPadrao = useRef(false);
  useEffect(() => { escolheuPadrao.current = false; setCardAberto(null); }, [mes, ano]);
  useEffect(() => {
    if (escolheuPadrao.current || !eventosMes.length) return;
    escolheuPadrao.current = true;
    const hoje = hojeISO();
    setCardAberto((eventosMes.find((e) => e.data >= hoje) ?? eventosMes.at(-1)).id);
  }, [eventosMes]);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({ titulo: "Culto", subtitulo: SUBTITULOS[aba], chips: [] });
  }, [ativo, aba, definirCabecalho]);

  return (
    <>
      <div className="subtabs">
        <button data-on={aba === "ordem" ? 1 : 0} onClick={() => setAba("ordem")}>Ordem do culto</button>
        <button data-on={aba === "inventario" ? 1 : 0} onClick={() => setAba("inventario")}>Inventário</button>
        <button data-on={aba === "contagem" ? 1 : 0} onClick={() => setAba("contagem")}>Contagem</button>
      </div>

      {aba === "ordem" && (
        <div style={{ marginTop: 16 }}>
          {eventosMes.map((ev) => (
            <OrdemCultoCard
              key={ev.id} evento={ev} podePublicar={podePublicar}
              aberto={cardAberto === ev.id} onAbrir={() => setCardAberto(cardAberto === ev.id ? null : ev.id)}
              chegada={ev.horaChegada || base?.horaChegada || "08:00"}
              pdfUrlExistente={ordens[ev.id]}
              onPdfEnviado={(eventoId, url) => setOrdens((o) => ({ ...o, [eventoId]: url }))}
              onNotasGuardadas={(eventoId, notas) => setEventosMes((lista) => lista.map((e) => (e.id === eventoId ? { ...e, notas } : e)))}
              onVerFuncoes={onVerFuncoes}
            />
          ))}
        </div>
      )}

      {aba === "inventario" && (
        <div style={{ marginTop: 16 }}>
          <Inventario uid={uid} papel={papel} ativo={false} definirCabecalho={SEM_CABECALHO} onIrReembolsos={onIrReembolsos} />
        </div>
      )}

      {aba === "contagem" && (
        <div style={{ marginTop: 16 }}>
          {meuEvento ? (
            <ContagemCulto eventoId={meuEvento.id} uid={uid} voluntarios={voluntarios} />
          ) : (
            <div className="vaz">Sem culto para contar ainda.</div>
          )}
        </div>
      )}
    </>
  );
}
