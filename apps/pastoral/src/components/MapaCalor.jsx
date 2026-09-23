import { useEffect, useState } from "react";
import { corAtraso, textoAtraso } from "./Atraso";

/**
 * Ocupação do auditório, domingo a domingo.
 *
 * Uma grelha de quadrados, um por culto, mais escuro quanto mais
 * cheio. É a forma certa para esta pergunta: uma linha responde "está
 * a subir?", mas a pergunta aqui é outra — "quais foram os domingos
 * cheios?" — e num quadriculado isso vê-se sem seguir uma linha.
 *
 * A rampa é de UM tom (a mesma família azul validada de `CORES_ETAPA`,
 * ver `lib/contactos.js`): magnitude é sempre um hue só, do claro ao
 * escuro. Um arco-íris aqui — verde "bom", vermelho "mau" — seria pior
 * do que inútil, porque um domingo cheio não é bom nem mau em si: 95%
 * quer dizer que faltam lugares, e é por isso que o número importa.
 *
 * A escala é FIXA em 0–100% da capacidade útil, nunca normalizada ao
 * máximo do período. Normalizar faria o domingo mais cheio de um mês
 * fraco ficar tão escuro como uma casa cheia, e o mapa passaria a
 * mentir de forma diferente em cada janela de datas.
 */
const RAMPA = ["#9aabee", "#7b8fe6", "#5d74db", "#4059cf", "#2640c5", "#0019be"];

/** 0–1 → um dos seis passos. Zero não é o passo mais claro: é um
 *  quadrado vazio, com contorno — "ninguém" e "poucos" são coisas
 *  diferentes, e no mapa têm de se distinguir sem contar tons. */
function passo(pct) {
  if (!pct) return null;
  return RAMPA[Math.min(RAMPA.length - 1, Math.floor(pct * RAMPA.length))];
}

export default function MapaCalor({ cultos, vazio = "Ainda não há mapas de auditório fechados." }) {
  const [foco, setFoco] = useState(null);
  // sem isto, trocar de período (3 meses/12 meses/Este ano) deixava o
  // quadrado tocado de um período anterior "preso" — a folha de baixo
  // continuava a mostrar o domingo antigo, e tocar num quadrado do
  // período novo parecia não fazer nada porque a informação já
  // esperada (o último domingo) só reaparecia ao tocar duas vezes
  useEffect(() => setFoco(null), [cultos]);

  // só do primeiro domingo com dados para a frente — antes disso são
  // domingos que existem no calendário mas nunca passaram por este
  // sistema, e mostrá-los como "por fechar" era ruído, não informação
  // (reportado 2026-09: "não quero que mostre cultos que não houveram
  // anteriormente")
  const primeiroComDados = cultos.findIndex((c) => c.acomodacao);
  const visiveis = primeiroComDados < 0 ? [] : cultos.slice(primeiroComDados);
  if (!visiveis.length) return <div className="vaz">{vazio}</div>;

  const comMapa = visiveis.filter((c) => c.acomodacao);
  const mostrado = foco ?? comMapa.at(-1) ?? null;
  const a = mostrado?.acomodacao ?? null;
  const pct = a ? Math.round(a.percentagem * 100) : null;

  return (
    <>
      <div className="pa-calor">
        {/* todos os domingos desde o primeiro com dados entram, não só
            os fechados — um domingo com o mapa começado mas nunca
            fechado tem os números na mesma (pedido 2026-09: "azar
            dela, os números vão pros painéis da mesma forma"); só
            fica cinzento quem não tem NENHUM dado */}
        {visiveis.map((c) => {
          if (!c.acomodacao) {
            return (
              <span
                key={c.eventoId}
                className="pa-calor-q porfechar"
                aria-label={`${c.data}: sem mapa nenhum`}
                title="Nenhum mapa foi começado para este domingo"
              />
            );
          }
          const cor = passo(c.acomodacao.percentagem);
          const ativo = mostrado && c.eventoId === mostrado.eventoId;
          return (
            <button
              key={c.eventoId}
              className={`pa-calor-q${ativo ? " on" : ""}${cor ? "" : " vazio"}`}
              style={cor ? { background: cor } : undefined}
              onClick={() => setFoco(c)}
              aria-label={`${c.data}: ${Math.round(c.acomodacao.percentagem * 100)}% de ocupação`}
            />
          );
        })}
      </div>

      {mostrado ? (() => {
        // tudo isto já vinha com o culto — mapa, voluntários, Kinder e
        // atraso vêm juntos de `historicoPastoral`, sem chamada nova
        // nenhuma. Pedido 2026-09: ordem e conteúdo do cartão trocados
        // — "de onde vêm os dados?" era a pergunta, porque a contagem
        // manual da Contagem (categorias, tela própria da Pessoal) e o
        // mapa lugar a lugar são DOIS sistemas diferentes que podem
        // discordar (a manual conta por categoria digitada; o mapa é
        // lugar a lugar) — por isso "Presença na igreja" passa a somar
        // só a partir do mapa + voluntários + Kinder, nunca da
        // contagem manual, que saiu deste cartão de propósito.
        const marcados = a.ocupados + a.visitantes; // lugares úteis ocupados, visitante incluído
        const foraDeContagem = a.reservados + a.bloqueados;
        const totalLugares = a.capacidadeUtil + foraDeContagem;
        const kinderTotal = mostrado.kinder?.total ?? null;
        const presenca = marcados + mostrado.voluntarios + (kinderTotal ?? 0);
        return (
          <div className="caixa" style={{ marginTop: 14 }}>
            <p className="ds" style={{ marginTop: 0 }}>{mostrado.data}</p>
            <p className="pa-num">{pct}%</p>
            <p className="ds" style={{ marginTop: 2 }}>de ocupação do auditório</p>

            <p className="ds" style={{ marginTop: 14 }}>Presença na igreja</p>
            <p className="pa-num">{presenca}</p>
            <p className="ds" style={{ marginTop: 2 }}>
              {marcados} no auditório + {mostrado.voluntarios} voluntários
              {kinderTotal !== null ? ` + ${kinderTotal} na Kinder` : ""}
            </p>

            <ul className="pa-lista" style={{ marginTop: 10 }}>
              <li>Lugares no auditório: {totalLugares}</li>
              <li>Lugares úteis marcados: {marcados} de {a.capacidadeUtil}</li>
              <li>Visitantes: {a.visitantes}</li>
              {kinderTotal !== null && <li>Crianças no Kinder: {kinderTotal}</li>}
            </ul>

            {mostrado.culto?.atrasoFinal != null && (
              <p className="ds" style={{ marginTop: 10 }}>
                No fim, o culto estava <b className={corAtraso(mostrado.culto.atrasoFinal)}>{textoAtraso(mostrado.culto.atrasoFinal)}</b>
              </p>
            )}
          </div>
        );
      })() : (
        <p className="ds" style={{ marginTop: 10 }}>
          Os quadrados cinzentos são domingos sem nenhum mapa começado.
        </p>
      )}
    </>
  );
}
