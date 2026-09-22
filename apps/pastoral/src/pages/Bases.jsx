import { useEffect, useMemo, useState } from "react";
import { panoramaPastoral, patrimonioPastoral } from "../lib/pastoral";
import { ouvirRecadosEnviados } from "../lib/culto";
import { eur, haAtras } from "@portal/shared/lib/data.js";
import Barras from "../components/Barras";
import SheetRecado from "../components/SheetRecado";

/**
 * Cada base, e o que nela está por resolver.
 *
 * O que torna isto útil não é a lista — é a ORDEM. Uma base sem nada
 * pendente não precisa de atenção nenhuma, e por isso desce; quem tem
 * um equipamento avariado ou uma melhoria que impede o culto sobe ao
 * topo sozinho. Uma grelha alfabética de dez cartões iguais obrigaria
 * a ler os dez todas as semanas para descobrir os dois que interessam.
 *
 * Tudo aqui é contagem, nunca lista: o `panoramaPastoral` devolve
 * números de propósito (é a chamada mais cara do sistema — nove
 * leituras por base). Quem quer saber QUAIS abre a app da base; este
 * painel responde "alguma base precisa de mim?", não substitui o
 * Painel do líder de ninguém.
 */

/** Quanto é que cada pendência pesa na ordem. Não é uma pontuação de
 *  qualidade da base — é "quão depressa isto estraga um domingo".
 *  Por isso o que impede o culto vale dez vezes uma dúvida na Wiki, e
 *  a escala por montar pesa mais do que tudo o resto junto: sem
 *  escala não há domingo nenhum. */
const PESOS = {
  semEscala: 100,
  melhoriaGrave: 40,
  equipamentoAvariado: 12,
  reembolsoPorAprovar: 8,
  inventarioEmFalta: 5,
  melhoriaAberta: 3,
  duvidaSemResposta: 2,
};

/** Dias até ao fim do mês corrente (hoje = dia 0). As escalas nascem
 *  uma vez por mês, perto do fim do mês anterior — por isso "ainda não
 *  tem escala" é o normal a meio do mês e só vira problema a sério na
 *  última semana. Sinalizar isto desde o dia 1 seria alarme falso
 *  todos os dias, e ensinaria a ignorar o cartão. */
function diasAteFimDoMes() {
  const h = new Date();
  const fim = new Date(h.getFullYear(), h.getMonth() + 1, 0);
  const hoje = new Date(h.getFullYear(), h.getMonth(), h.getDate());
  return Math.round((fim - hoje) / 86400000);
}

function urgencia(b) {
  return (b.semEscalaConta ? PESOS.semEscala : 0)
    + b.melhoriasGraves * PESOS.melhoriaGrave
    + b.equipamentosAvariados * PESOS.equipamentoAvariado
    + b.reembolsosPorAprovar * PESOS.reembolsoPorAprovar
    + b.inventarioEmFalta * PESOS.inventarioEmFalta
    + (b.melhoriasAbertas - b.melhoriasGraves) * PESOS.melhoriaAberta
    + b.duvidasSemResposta * PESOS.duvidaSemResposta;
}

/** As pendências de uma base, em texto, já ordenadas pela mesma régua.
 *  Só as que existem — uma lista com "0 avarias" a toda a largura
 *  ensina a saltar o cartão. Avarias, itens em falta e melhorias
 *  graves levam os NOMES, não só a contagem — "2 avariados" obriga a
 *  abrir a app da base só para saber o quê; são sempre um punhado, não
 *  o inventário inteiro, por isso cabem na linha. */
function pendencias(b) {
  const p = [];
  if (b.semEscalaConta) p.push({ chave: "escala", texto: "Escala por montar", grave: true });
  if (b.melhoriasGraves) p.push({ chave: "graves", texto: `Impede o culto: ${b.melhoriasGravesNomes.join(", ")}`, grave: true });
  if (b.equipamentosAvariados) p.push({ chave: "avarias", texto: `Avariado${b.equipamentosAvariados === 1 ? "" : "s"}: ${b.equipamentosAvariadosNomes.join(", ")}` });
  if (b.reembolsosPorAprovar) p.push({ chave: "reemb", texto: `${b.reembolsosPorAprovar} reembolso${b.reembolsosPorAprovar === 1 ? "" : "s"} à espera do líder` });
  if (b.inventarioEmFalta) p.push({ chave: "stock", texto: `Em falta: ${b.inventarioEmFaltaNomes.join(", ")}` });
  if (b.listasComprasAbertas) p.push({ chave: "compras", texto: "Lista de compras aberta" });
  if (b.duvidasSemResposta) p.push({ chave: "duvidas", texto: `${b.duvidasSemResposta} dúvida${b.duvidasSemResposta === 1 ? "" : "s"} sem resposta na Wiki` });
  return p;
}

export default function Bases({ ativo, definirCabecalho }) {
  const [panorama, setPanorama] = useState(null);     // null = a carregar
  const [patrimonio, setPatrimonio] = useState(null);
  const [recados, setRecados] = useState([]);
  const [aberto, setAberto] = useState(null);
  const [recadoPara, setRecadoPara] = useState(null);
  const [erro, setErro] = useState(null);

  // uma vez por montagem: são retratos, não estado ao vivo. A aba fica
  // montada em `display:none` ao trocar de separador, por isso isto
  // não repete a cada ida e volta — e é de propósito, dado o custo.
  useEffect(() => {
    let vivo = true;
    Promise.all([panoramaPastoral(), patrimonioPastoral()])
      .then(([p, pat]) => { if (vivo) { setPanorama(p.bases); setPatrimonio(pat.bases); } })
      .catch((e) => { if (vivo) setErro(e.message || "Não foi possível carregar as bases."); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => ouvirRecadosEnviados(setRecados), []);

  // calculado uma vez (não muda durante a sessão) — não precisa de
  // entrar nas deps do useMemo abaixo
  const diasParaFimDoMes = useMemo(diasAteFimDoMes, []);

  const ordenadas = useMemo(
    () => (panorama ?? [])
      .map((b) => ({ ...b, semEscalaConta: !b.escalaFeita && diasParaFimDoMes < 7 }))
      .map((b) => ({ ...b, urgencia: urgencia(b), pendencias: pendencias(b) }))
      .sort((a, b) => b.urgencia - a.urgencia || a.nome.localeCompare(b.nome, "pt")),
    [panorama, diasParaFimDoMes],
  );

  const totais = useMemo(() => {
    if (!panorama) return null;
    return {
      pessoas: panorama.reduce((t, b) => t + b.pessoasAtivas, 0),
      semEscala: diasParaFimDoMes < 7 ? panorama.filter((b) => !b.escalaFeita).length : 0,
      avarias: panorama.reduce((t, b) => t + b.equipamentosAvariados, 0),
      porAprovar: panorama.reduce((t, b) => t + b.reembolsosPorAprovar, 0),
    };
  }, [panorama, diasParaFimDoMes]);

  /** Valor do património, por base — só entra quem tem valor de compra
   *  gravado. É opcional em todo o repo, por isso o total é sempre um
   *  mínimo conhecido e nunca "o que a igreja tem"; dizê-lo é mais
   *  honesto do que apresentar um número que parece completo. */
  const valorPorBase = useMemo(() => {
    if (!patrimonio) return [];
    return patrimonio
      .map((b) => ({
        chave: b.baseId, rotulo: b.nome, cor: b.cor,
        valor: b.itens.reduce((t, i) => t + (i.valorCompra ?? 0), 0) / 100,
      }))
      .filter((l) => l.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [patrimonio]);

  const itensSemValor = useMemo(() => {
    if (!patrimonio) return 0;
    return patrimonio.reduce(
      (t, b) => t + b.itens.filter((i) => i.modo === "patrimonio" && i.valorCompra === null).length, 0,
    );
  }, [patrimonio]);

  const porLer = recados.filter((r) => !r.dispensado);

  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({
      titulo: "Bases",
      subtitulo: "As dez equipas e o que está por resolver",
      chips: totais ? [
        `${totais.pessoas} voluntários`,
        totais.semEscala ? `${totais.semEscala} sem escala` : "Escalas em dia",
      ] : [],
    });
  }, [ativo, definirCabecalho, totais]);

  if (erro) {
    return <div className="caixa destaque" style={{ marginTop: 14 }}><p className="ds" style={{ marginTop: 0 }}>{erro}</p></div>;
  }
  if (!panorama) return <div className="vaz" style={{ marginTop: 14 }}>A carregar as dez bases…</div>;

  return (
    <>
      <div className="dupla" style={{ marginTop: 14 }}>
        <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent", marginTop: 0 }}>
          <p className="ds" style={{ marginTop: 0 }}>Voluntários ativos</p>
          <p className="pa-num">{totais.pessoas}</p>
          <p className="ds" style={{ marginTop: 2 }}>nas {panorama.length} bases</p>
        </div>
        <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent", marginTop: 0 }}>
          <p className="ds" style={{ marginTop: 0 }}>Por aprovar</p>
          <p className="pa-num">{totais.porAprovar}</p>
          <p className="ds" style={{ marginTop: 2 }}>reembolsos com os líderes</p>
        </div>
      </div>

      {porLer.length > 0 && (
        <div className="caixa" style={{ marginTop: 10 }}>
          <p className="ds" style={{ marginTop: 0 }}>
            <b>{porLer.length} recado{porLer.length === 1 ? "" : "s"}</b> que os líderes ainda não dispensaram.
          </p>
        </div>
      )}

      <div className="sect">
        <div className="cabecalho">
          <h3>Por atenção</h3>
          <span className="cap">mais urgente primeiro</span>
        </div>
        {ordenadas.map((b) => (
          <div key={b.baseId}>
            <div
              className="linha cabtoque"
              onClick={() => setAberto(aberto === b.baseId ? null : b.baseId)}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setAberto(aberto === b.baseId ? null : b.baseId); }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="nmt" style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  {b.cor && <span className="quadmin" style={{ background: b.cor }} />}
                  {b.nome}
                </p>
                <p className="ds">
                  {b.pendencias.length === 0
                    ? "Nada pendente"
                    : b.pendencias.map((p) => p.texto).join(" · ")}
                </p>
              </div>
              {/* o número é a contagem de pendências, e a cor só marca
                  o que é grave — não é uma nota de 0 a 10 da base */}
              <span
                className="selo"
                style={{
                  flex: "none",
                  background: b.pendencias.some((p) => p.grave) ? "var(--magenta)" : b.pendencias.length ? "var(--laranja)" : "var(--verde)",
                }}
              >
                {b.pendencias.length || "ok"}
              </span>
            </div>

            {aberto === b.baseId && (
              <div className="aberto">
                <div className="dupla" style={{ marginTop: 8 }}>
                  <div className="caixa" style={{ marginTop: 0, padding: 14 }}>
                    <p className="ds" style={{ marginTop: 0 }}>Equipa</p>
                    <p className="nmt" style={{ marginTop: 3 }}>{b.pessoasAtivas} pessoas</p>
                    <p className="ds" style={{ marginTop: 2 }}>{b.funcoesAtivas} funções na checklist</p>
                  </div>
                  <div className="caixa" style={{ marginTop: 0, padding: 14 }}>
                    <p className="ds" style={{ marginTop: 0 }}>Material</p>
                    <p className="nmt" style={{ marginTop: 3 }}>{b.equipamentosTotal + b.inventarioTotal} itens</p>
                    <p className="ds" style={{ marginTop: 2 }}>
                      {b.equipamentosAvariados ? `${b.equipamentosAvariados} avariado${b.equipamentosAvariados === 1 ? "" : "s"}` : "sem avarias"}
                    </p>
                  </div>
                </div>

                {b.pendencias.length > 0 && (
                  <ul className="pa-lista">
                    {b.pendencias.map((p) => (
                      <li key={p.chave} className={p.grave ? "grave" : undefined}>{p.texto}</li>
                    ))}
                  </ul>
                )}

                <button className="btn sec full" style={{ marginTop: 12 }} onClick={() => setRecadoPara(b)}>
                  Mandar recado à {b.nome}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sect">
        <div className="cabecalho"><h3>Património por base</h3><span className="cap">valor de compra</span></div>
        <Barras
          linhas={valorPorBase}
          formatar={eur}
          vazio="Nenhum item tem valor de compra gravado."
        />
        {itensSemValor > 0 && (
          <p className="cap" style={{ marginTop: 10 }}>
            {itensSemValor} {itensSemValor === 1 ? "item não tem" : "itens não têm"} valor de compra gravado — o total acima é um mínimo, não o que a igreja tem.
          </p>
        )}
      </div>

      {recados.length > 0 && (
        <div className="sect">
          <div className="cabecalho"><h3>Recados enviados</h3><span className="cap">{porLer.length} por ler</span></div>
          {recados.slice(0, 15).map((r) => {
            const base = panorama.find((b) => b.baseId === r.baseId);
            return (
              <div className="linha" key={r.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="nmt" style={{ fontSize: 14 }}>{r.texto}</p>
                  <p className="ds">
                    {base?.nome ?? r.baseId} · {haAtras(r.criadoEm)}
                    {r.urgente ? " · urgente" : ""}
                  </p>
                </div>
                <span className="tag" style={{ flex: "none", background: r.dispensado ? "var(--cinza)" : "var(--azul)" }}>
                  {r.dispensado ? "lido" : "por ler"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {recadoPara && <SheetRecado base={recadoPara} onFechar={() => setRecadoPara(null)} />}
    </>
  );
}
