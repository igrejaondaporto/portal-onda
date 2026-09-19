import { useEffect, useMemo, useState } from "react";
import { ouvirReembolsosPorEstado, ouvirReembolsosPagos, faturaPorReceber } from "../lib/reembolsosFinanceiro";
import { ouvirContagens, emEuros, domingoMaisRecente } from "../lib/oferta";
import { ouvirBases } from "../lib/bases";
import Barras from "../components/Barras";
import { CATEGORIAS_DESPESA, ROTULO_CATEGORIA_DESPESA } from "@portal/shared/lib/categoriasDespesa.js";
import { eur, dataPorExtenso } from "@portal/shared/lib/data.js";
import RecadoPastoral from "@portal/shared/components/RecadoPastoral.jsx";

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_A_ESPERAR = 7;   // a partir daqui um pedido aprovado está a arrastar-se

const chaveMes = (d) => `${d.getFullYear()}-${d.getMonth()}`;
const dataDe = (ts) => (ts?.toDate ? ts.toDate() : null);
const dataDeIso = (iso) => {
  if (!iso) return null;
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
};

/** Cartão de aviso — o que está à espera de alguém. Sempre com o
 *  atalho para o sítio onde se resolve: um aviso que não leva a lado
 *  nenhum obriga a procurar o ecrã certo à mão. */
function Aviso({ texto, accao, onAccao }) {
  return (
    <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent", display: "flex", alignItems: "center", gap: 12 }}>
      <p className="ds" style={{ marginTop: 0, flex: 1 }}>{texto}</p>
      <button className="btn sec" style={{ flex: "none", padding: "9px 14px", fontSize: 13 }} onClick={onAccao}>
        {accao}
      </button>
    </div>
  );
}

/** Início — o que falta fazer agora, e um resumo curto. O histórico
 *  completo, os filtros e os gráficos a sério vivem em Relatórios;
 *  aqui só entra o que responde a "tenho alguma coisa para tratar?". */
export default function Inicio({ ativo, papel, irPara, definirCabecalho }) {
  const [porPagar, setPorPagar] = useState([]);
  const [devolvidos, setDevolvidos] = useState([]);
  const [pagos, setPagos] = useState([]);
  // null enquanto a primeira leitura não chega — sem isto, o aviso de
  // "oferta por contar" pisca sempre no arranque, mesmo quando ela já
  // está contada.
  const [contagens, setContagens] = useState(null);
  const [bases, setBases] = useState({});

  useEffect(() => ouvirReembolsosPorEstado("aprovado", setPorPagar), []);
  useEffect(() => ouvirReembolsosPorEstado("devolvido", setDevolvidos), []);
  useEffect(() => ouvirReembolsosPagos(setPagos), []);
  useEffect(() => ouvirContagens(setContagens), []);
  useEffect(() => ouvirBases(setBases), []);

  const hoje = useMemo(() => new Date(), []);
  const chaveMesAtual = chaveMes(hoje);

  const totalPorPagar = porPagar.reduce((s, r) => s + r.valor, 0);
  const basesPorPagar = new Set(porPagar.map((r) => r.baseId)).size;
  const aArrastar = porPagar.filter((r) => {
    const d = dataDe(r.criadoEm);
    return d && (hoje - d) / 86400000 >= DIAS_A_ESPERAR;
  });

  const pagoEsteMes = useMemo(
    () => pagos.filter((r) => { const d = dataDe(r.pagoEm); return d && chaveMes(d) === chaveMesAtual; }),
    [pagos, chaveMesAtual],
  );
  const ofertaEsteMes = useMemo(
    () => (contagens ?? []).filter((c) => { const d = dataDeIso(c.data); return d && chaveMes(d) === chaveMesAtual; }),
    [contagens, chaveMesAtual],
  );
  const totalOfertaMes = emEuros(ofertaEsteMes.reduce((s, c) => s + (c.total ?? 0), 0));

  const domingo = domingoMaisRecente(hoje);
  const ofertaPorContar = contagens !== null && !contagens.some((c) => c.data === domingo);

  // a fatura em papel anda a outro ritmo que o dinheiro — pagar não
  // fecha o processo enquanto o papel não estiver conferido.
  const faturasPorConferir = useMemo(
    () => [...porPagar, ...pagos].filter(faturaPorReceber).length,
    [porPagar, pagos],
  );

  const anoAtual = hoje.getFullYear();
  const porCategoria = useMemo(() => {
    const mapa = new Map();
    for (const r of pagos) {
      const d = dataDe(r.pagoEm);
      if (!d || d.getFullYear() !== anoAtual || !r.categoria) continue;
      mapa.set(r.categoria, (mapa.get(r.categoria) ?? 0) + r.valor);
    }
    return CATEGORIAS_DESPESA
      .map(([id]) => ({ chave: id, rotulo: ROTULO_CATEGORIA_DESPESA[id], valor: mapa.get(id) ?? 0 }))
      .filter((l) => l.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }, [pagos, anoAtual]);

  // só recalcula o cabeçalho quando esta aba fica ativa — as abas
  // ficam sempre montadas (display:none), e sem o `ativo` na
  // dependência o efeito de cada uma corria uma vez à toa no arranque
  // e o título deixava de seguir a navegação.
  useEffect(() => {
    if (!ativo) return;
    definirCabecalho({ titulo: <em>Início</em>, subtitulo: "O que está à tua espera", chips: [] });
  }, [ativo, definirCabecalho]);

  return (
    <>
      <RecadoPastoral papel={papel} />
      <div className="destaque" onClick={() => irPara("reembolsos")}>
        <div>
          <p style={{ fontSize: 12.5, opacity: 0.85 }}>Por pagar agora</p>
          <p style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.035em", marginTop: 2 }}>{eur(totalPorPagar)}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 12.5, opacity: 0.85 }}>{porPagar.length} pedido{porPagar.length !== 1 ? "s" : ""}</p>
          <p style={{ fontSize: 12.5, opacity: 0.85, marginTop: 2 }}>{basesPorPagar} base{basesPorPagar !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {aArrastar.length > 0 && (
        <Aviso
          texto={`${aArrastar.length} pedido${aArrastar.length !== 1 ? "s" : ""} aprovado${aArrastar.length !== 1 ? "s" : ""} há mais de ${DIAS_A_ESPERAR} dias à espera de pagamento.`}
          accao="Ver" onAccao={() => irPara("reembolsos")}
        />
      )}
      {devolvidos.length > 0 && (
        <Aviso
          texto={`${devolvidos.length} pedido${devolvidos.length !== 1 ? "s" : ""} que devolveste continua${devolvidos.length !== 1 ? "m" : ""} à espera da líder da base.`}
          accao="Ver" onAccao={() => irPara("reembolsos")}
        />
      )}
      {ofertaPorContar && (
        <Aviso
          texto={`A oferta de ${dataPorExtenso(domingo)} ainda não foi contada.`}
          accao="Contar" onAccao={() => irPara("oferta")}
        />
      )}
      {faturasPorConferir > 0 && (
        <Aviso
          texto={`${faturasPorConferir} fatura${faturasPorConferir !== 1 ? "s" : ""} em papel por conferir.`}
          accao="Conferir" onAccao={() => irPara("reembolsos")}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent", marginTop: 0 }}>
          <p className="ds" style={{ marginTop: 0 }}>Pago em {MESES_PT[hoje.getMonth()]}</p>
          <p style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.03em", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            {eur(pagoEsteMes.reduce((s, r) => s + r.valor, 0))}
          </p>
          <p className="ds" style={{ marginTop: 2 }}>{pagoEsteMes.length} pedido{pagoEsteMes.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="caixa" style={{ background: "var(--agua)", borderColor: "transparent", marginTop: 0 }}>
          <p className="ds" style={{ marginTop: 0 }}>Oferta em {MESES_PT[hoje.getMonth()]}</p>
          <p style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.03em", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            {eur(totalOfertaMes)}
          </p>
          <p className="ds" style={{ marginTop: 2 }}>{ofertaEsteMes.length} contagem{ofertaEsteMes.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="sect">
        <div className="cabecalho">
          <h3>Onde foi o dinheiro</h3>
          <button className="cap" style={{ background: "none", border: 0, cursor: "pointer" }} onClick={() => irPara("relatorios")}>
            Ver tudo
          </button>
        </div>
        <Barras linhas={porCategoria} vazio="Ainda não há reembolsos pagos com categoria este ano." />
      </div>

      {porPagar.length > 0 && (
        <div className="sect">
          <div className="cabecalho"><h3>Fila de pagamento</h3><span className="cap">{porPagar.length}</span></div>
          {porPagar.slice(0, 5).map((r) => (
            <div className="linha" key={`${r.baseId}-${r.id}`} style={{ cursor: "pointer" }} onClick={() => irPara("reembolsos")}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="nmt">{eur(r.valor)}</p>
                <p className="ds">{r.pessoaNome ?? "…"} · {bases[r.baseId]?.nome ?? r.baseId}</p>
              </div>
              <span className="seta">›</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
