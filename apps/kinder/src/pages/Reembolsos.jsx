import { useEffect, useRef, useState } from "react";
import {
  ouvirReembolsos, criarReembolso, aprovarReembolso, indeferirReembolso,
  lerPagamentoGuardado, guardarPagamento, normalizarDestino, mostrarDestino,
} from "../lib/reembolsos";
import { ouvirVoluntarios } from "../lib/painel";
import { souLider } from "../lib/modelo";
import { CATEGORIAS_DESPESA, ROTULO_CATEGORIA_DESPESA } from "@portal/shared/lib/categoriasDespesa.js";
import { eur, dataTimestamp } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import Avatar from "@portal/shared/components/Avatar.jsx";

// submetido → aprovado|indeferido (líder) → pago|devolvido (Financeiro,
// na app dele). "Devolvido" volta à mesa do líder: o Financeiro viu que
// falta alguma coisa na nota e o pedido precisa de nova decisão.
const ROTULOS = {
  submetido: { texto: { lider: "Pendente", voluntario: "Em aberto" }, tag: "cinz" },
  aprovado: { texto: { lider: "Aprovado", voluntario: "À espera do Financeiro" }, tag: "verd" },
  devolvido: { texto: { lider: "Devolvido", voluntario: "Por corrigir" }, tag: "lim" },
  indeferido: { texto: { lider: "Indeferido", voluntario: "Indeferido" }, tag: "" },
  pago: { texto: { lider: "Pago", voluntario: "Pago" }, tag: "verd" },
};

const POR_DECIDIR = new Set(["submetido", "devolvido"]);

// Enquanto a fatura em papel não chega à mão do líder o pedido não
// anda — e é isso que a pessoa precisa de ver, não um "em aberto" que
// parece que está tudo tratado. Só vale enquanto está por decidir:
// depois de aprovado ou indeferido, o que importa é a decisão.
const ROTULO_SEM_FATURA = { texto: { lider: "Falta a fatura", voluntario: "Ag. fatura física" }, tag: "lim" };

const rotuloDe = (r) =>
  r.estado === "submetido" && r.fatura && !r.fatura.comLider
    ? ROTULO_SEM_FATURA
    : ROTULOS[r.estado] ?? { texto: { lider: r.estado, voluntario: r.estado }, tag: "" };

/** O que dizer sobre o papel, depois de o líder decidir o que lhe faz.
 *  `null` quando não há nada de novo a dizer. */
function textoFatura(r) {
  if (r.fatura?.recebida) return "Fatura em papel já entregue ao Financeiro ✓";
  if (r.fatura?.paraFinanceiro === "entregue") return "O líder entregou a fatura ao Financeiro — falta o Financeiro confirmar.";
  if (r.fatura?.paraFinanceiro === "proximo_culto") return "O líder leva a fatura em papel ao Financeiro no próximo culto.";
  return null;
}

const OPCOES_FATURA = [
  ["entregue", "Já entreguei ao Financeiro"],
  ["proximo_culto", "Entrego no próximo culto"],
];

const METODOS = [
  ["mbway", "MB Way"],
  ["transferencia", "Transferência"],
];

export default function Reembolsos({ uid, papel, definirCabecalho }) {
  const torrada = useTorrada();
  const souLiderBase = souLider(papel);
  const inputRef = useRef(null);
  const [reembolsos, setReembolsos] = useState([]);
  const [voluntarios, setVoluntarios] = useState([]);
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS_DESPESA[0][0]);
  const [valor, setValor] = useState("");
  const [ficheiro, setFicheiro] = useState(null);
  // null = ainda não respondeu. Obrigatório escolher antes de enviar —
  // um checkbox por marcar não distingue "não entreguei" de "não li".
  const [faturaComLider, setFaturaComLider] = useState(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [aIndeferir, setAIndeferir] = useState(null);
  const [aAprovar, setAAprovar] = useState(null);
  const [paraFinanceiro, setParaFinanceiro] = useState(null);
  const [comentario, setComentario] = useState("");
  const [aProcessar, setAProcessar] = useState(false);
  // onde a pessoa recebe: lido uma vez, editável enquanto não houver
  // nada guardado (ou quando ela toca em "Mudar")
  const [pagamento, setPagamento] = useState(null);
  const [aMudarPagamento, setAMudarPagamento] = useState(false);
  const [metodo, setMetodo] = useState("mbway");
  const [destino, setDestino] = useState("");

  useEffect(() => ouvirReembolsos(souLiderBase, uid, setReembolsos), [souLiderBase, uid]);
  useEffect(() => ouvirVoluntarios(setVoluntarios), []);

  const eu = voluntarios.find((x) => x.id === uid);

  useEffect(() => {
    let vivo = true;
    lerPagamentoGuardado(uid).then((p) => {
      if (!vivo) return;
      setPagamento(p);
      if (p) { setMetodo(p.metodo); setDestino(p.destino); }
    });
    return () => { vivo = false; };
  }, [uid]);

  // o MB Way é o telemóvel dela — poupa-lhe escrever o número que a
  // base já conhece. Só sugere: se ela apagar, fica apagado.
  useEffect(() => {
    if (pagamento || destino || metodo !== "mbway" || !eu?.telefone) return;
    setDestino(eu.telefone);
  }, [pagamento, destino, metodo, eu?.telefone]);

  const pendentes = reembolsos.filter((r) => POR_DECIDIR.has(r.estado));
  const nomeLiderBase = voluntarios.find((p) => p.papel === "lider_base")?.nome ?? "líder do Kinder";

  useEffect(() => {
    definirCabecalho({
      titulo: <em>Reembolsos</em>,
      subtitulo: "Sobe a nota e o líder trata do resto",
      chips: souLiderBase
        ? [`${pendentes.length} por tratar`]
        : [`${reembolsos.length} pedido${reembolsos.length !== 1 ? "s" : ""}`],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [souLiderBase, pendentes.length, reembolsos.length]);

  function escolherFicheiro(e) {
    const f = e.target.files[0];
    e.target.value = "";
    if (f) setFicheiro(f);
  }

  function trocarMetodo(m) {
    setMetodo(m);
    setDestino(m === "mbway" ? (eu?.telefone ?? "") : "");
  }

  async function submeter() {
    if (!descricao.trim()) return torrada("Escreve o que compraste");
    const v = parseFloat(String(valor).replace(",", "."));
    if (!v || v <= 0) return torrada("Falta o valor");
    if (!ficheiro) return torrada("Junta a foto da nota");
    if (faturaComLider === null) return torrada("Diz se já entregaste a fatura em mãos ao líder");

    // sem isto ninguém te consegue pagar — é por isso que é obrigatório
    const usarGuardado = pagamento && !aMudarPagamento;
    const aValidar = usarGuardado ? pagamento : { metodo, destino };
    const { destino: limpo, erro } = normalizarDestino(aValidar.metodo, aValidar.destino);
    if (erro) return torrada(erro);
    const paraPagar = { metodo: aValidar.metodo, destino: limpo };

    setAEnviar(true);
    try {
      if (!usarGuardado) await guardarPagamento(uid, paraPagar);
      await criarReembolso(uid, {
        descricao: descricao.trim(), valor: v, ficheiro, categoria,
        pessoaNome: eu?.nome ?? null, pagamento: paraPagar, faturaComLider,
      });
      setDescricao(""); setValor(""); setFicheiro(null); setFaturaComLider(null);
      setPagamento(paraPagar); setAMudarPagamento(false);
      torrada(`Pedido enviado ao ${nomeLiderBase}`);
    } catch (e) {
      torrada(e.message || "Não foi possível enviar.");
    } finally {
      setAEnviar(false);
    }
  }

  async function confirmarAprovacao() {
    if (!paraFinanceiro) return torrada("Diz o que vais fazer à fatura em papel");
    setAProcessar(true);
    try {
      await aprovarReembolso(aAprovar, paraFinanceiro);
      setAAprovar(null);
      setParaFinanceiro(null);
      torrada("Pedido aprovado");
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    } finally {
      setAProcessar(false);
    }
  }

  async function confirmarIndeferir() {
    if (!comentario.trim()) return torrada("Escreve o motivo");
    setAProcessar(true);
    try {
      await indeferirReembolso(aIndeferir, comentario.trim());
      setAIndeferir(null);
      setComentario("");
      torrada("Pedido indeferido");
    } catch (e) {
      torrada(e.message || "Não foi possível atualizar.");
    } finally {
      setAProcessar(false);
    }
  }

  const mostrarFormPagamento = !pagamento || aMudarPagamento;

  return (
    <div className="duas">
      <div>
        <div className="sect">
          <div className="cabecalho"><h3>Novo pedido</h3></div>
          <div className="caixa">
            <label className="rot" style={{ marginTop: 0 }}>Descrição</label>
            <input className="campo" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: papel higiénico e lixívia" />
            <label className="rot">Categoria</label>
            <select className="campo" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CATEGORIAS_DESPESA.map(([id, rotulo]) => (
                <option key={id} value={id}>{rotulo}</option>
              ))}
            </select>
            <label className="rot">Valor</label>
            <input className="campo" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
            <label className="rot">Nota ou fatura</label>
            <p className="ds" style={{ marginTop: -4, marginBottom: 8 }}>
              Se pedires fatura, pede com o NIF da igreja: 517643340 (Igreja Onda).
            </p>
            <input ref={inputRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={escolherFicheiro} />
            <button className="btn sec full" style={{ marginTop: 8 }} onClick={() => inputRef.current.click()}>
              {ficheiro ? "Nota anexada ✓" : "Escolher ficheiro"}
            </button>

            {/* A foto não chega: a contabilidade precisa do papel. Quem
              * ainda não o entregou pode pedir na mesma — o pedido fica
              * "Ag. fatura física" até o líder a ter em mãos. */}
            <label className="rot">Já entregaste a fatura em mãos ao líder?</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 8 }}>
              {[[true, "Sim, já entreguei"], [false, "Ainda não"]].map(([v, rotulo]) => (
                <button
                  key={String(v)}
                  className="btn sec"
                  style={{
                    padding: "12px 10px", fontSize: 13.5,
                    ...(faturaComLider === v ? { background: "var(--azul)", color: "#fff" } : null),
                  }}
                  onClick={() => setFaturaComLider(v)}
                >
                  {rotulo}
                </button>
              ))}
            </div>

            <label className="rot">Onde queres receber</label>
            {mostrarFormPagamento ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 8 }}>
                  {METODOS.map(([m, rotulo]) => (
                    <button
                      key={m}
                      className="btn sec"
                      style={{
                        padding: "12px 10px", fontSize: 13.5,
                        ...(metodo === m ? { background: "var(--azul)", color: "#fff" } : null),
                      }}
                      onClick={() => trocarMetodo(m)}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
                <input
                  className="campo" value={destino} onChange={(e) => setDestino(e.target.value)}
                  inputMode={metodo === "mbway" ? "numeric" : "text"}
                  placeholder={metodo === "mbway" ? "912 345 678" : "PT50 0000 0000 0000 0000 0000 0"}
                />
                <p className="ds" style={{ marginTop: 8 }}>
                  Fica guardado — nos próximos pedidos já não tens de escrever. Ninguém da base vê isto, só o Financeiro.
                </p>
                {pagamento && (
                  <button className="btn sec full" style={{ marginTop: 10 }} onClick={() => {
                    setAMudarPagamento(false);
                    setMetodo(pagamento.metodo); setDestino(pagamento.destino);
                  }}>
                    Manter o que estava
                  </button>
                )}
              </>
            ) : (
              <div className="linha" style={{ borderBottom: 0, paddingBottom: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="nmt">
                    {METODOS.find(([m]) => m === pagamento.metodo)?.[1]} · {mostrarDestino(pagamento.metodo, pagamento.destino)}
                  </p>
                  <p className="ds">O teu método guardado</p>
                </div>
                <button className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5, flex: "none" }} onClick={() => setAMudarPagamento(true)}>
                  Mudar
                </button>
              </div>
            )}

            <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar} onClick={submeter}>Enviar ao líder</button>
            <p className="ds" style={{ marginTop: 12 }}>O {nomeLiderBase} recebe o pedido e encaminha para o Financeiro.</p>
          </div>
        </div>
      </div>
      <div>
        <div className="sect">
          <div className="cabecalho"><h3>{souLiderBase ? "Todos os pedidos" : "Os teus pedidos"}</h3></div>
          {reembolsos.length ? (
            reembolsos.map((r) => {
              const p = voluntarios.find((x) => x.id === r.pessoaId);
              const rotulo = rotuloDe(r);
              const aviso = textoFatura(r);
              return (
                <div key={r.id}>
                  <div className="linha">
                    {p && <Avatar pessoa={p} tamanho={38} fonte={15} />}
                    <div style={{ flex: 1 }}>
                      <p className="nmt">{eur(r.valor)}</p>
                      <p className="ds">
                        {r.descricao}{r.categoria ? ` · ${ROTULO_CATEGORIA_DESPESA[r.categoria] ?? r.categoria}` : ""} · {dataTimestamp(r.criadoEm)}{souLiderBase && p ? ` · ${p.nome}` : ""}
                      </p>
                    </div>
                    {souLiderBase && POR_DECIDIR.has(r.estado) ? (
                      aIndeferir === r.id || aAprovar === r.id ? null : (
                        <div style={{ display: "flex", gap: 8, flex: "none" }}>
                          <button
                            className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5 }}
                            disabled={aProcessar} onClick={() => { setAAprovar(r.id); setParaFinanceiro(null); setAIndeferir(null); }}
                          >
                            Aprovar
                          </button>
                          <button
                            className="btn sec" style={{ padding: "8px 14px", fontSize: 12.5, color: "var(--magenta)" }}
                            disabled={aProcessar} onClick={() => { setAIndeferir(r.id); setComentario(""); }}
                          >
                            Indeferir
                          </button>
                        </div>
                      )
                    ) : (
                      <span className={`tag${rotulo.tag ? ` ${rotulo.tag}` : ""}`}>
                        {souLiderBase ? rotulo.texto.lider : rotulo.texto.voluntario}
                      </span>
                    )}
                  </div>
                  {aIndeferir === r.id && (
                    <div className="caixa" style={{ marginTop: -6, marginBottom: 14 }}>
                      <label className="rot" style={{ marginTop: 0 }}>Motivo do indeferimento</label>
                      <textarea
                        className="campo" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)}
                        placeholder="O que falta ou porque não pode ser reembolsado"
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button className="btn full" disabled={aProcessar} onClick={confirmarIndeferir}>Confirmar indeferimento</button>
                        <button className="btn sec full" onClick={() => setAIndeferir(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  {aAprovar === r.id && (
                    <div className="caixa" style={{ marginTop: -6, marginBottom: 14 }}>
                      {r.fatura && !r.fatura.comLider && (
                        <p className="ds" style={{ marginTop: 0, color: "var(--laranja)" }}>
                          Quem pediu disse que ainda não te entregou a fatura em papel. Confirma que já a tens antes de aprovar.
                        </p>
                      )}
                      <label className="rot" style={{ marginTop: r.fatura && !r.fatura.comLider ? 12 : 0 }}>
                        A fatura em papel
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 8 }}>
                        {OPCOES_FATURA.map(([v, texto]) => (
                          <button
                            key={v}
                            className="btn sec"
                            style={{
                              padding: "12px 10px", fontSize: 13.5,
                              ...(paraFinanceiro === v ? { background: "var(--azul)", color: "#fff" } : null),
                            }}
                            onClick={() => setParaFinanceiro(v)}
                          >
                            {texto}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button className="btn full" disabled={aProcessar} onClick={confirmarAprovacao}>Confirmar aprovação</button>
                        <button className="btn sec full" onClick={() => setAAprovar(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  {aviso && (
                    <p className="ds" style={{ marginTop: -8, marginBottom: 14 }}>{aviso}</p>
                  )}
                  {r.estado === "devolvido" && r.devolvidoPorFinanceiro && (
                    <p className="ds" style={{ marginTop: -8, marginBottom: 14, color: "var(--laranja)" }}>
                      O Financeiro devolveu: {r.devolvidoPorFinanceiro}
                    </p>
                  )}
                  {r.estado === "pago" && r.comprovativoPagamento && (
                    <p className="ds" style={{ marginTop: -8, marginBottom: 14 }}>
                      <a href={r.comprovativoPagamento} target="_blank" rel="noreferrer">Ver comprovativo de pagamento</a>
                    </p>
                  )}
                  {r.estado === "indeferido" && r.comentarioLider && (
                    <p className="ds" style={{ marginTop: -8, marginBottom: 14, color: "var(--magenta)" }}>
                      Motivo: {r.comentarioLider}
                    </p>
                  )}
                </div>
              );
            })
          ) : (
            <div className="vaz">{souLiderBase ? "Ainda não há pedidos." : "Ainda não submeteste nenhum pedido."}</div>
          )}
        </div>
      </div>
    </div>
  );
}
