import { useCallback, useEffect, useState } from "react";
import { TorradaProvider, useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import AvisoOffline from "@portal/shared/components/AvisoOffline.jsx";
import { dataPorExtenso } from "@portal/shared/lib/data.js";
import FormFamilia from "../components/FormFamilia";
import CodigoQR from "../components/CodigoQR";
import { CabecalhoPublico, CHAVE_TOKEN_FAMILIA } from "./RegistoFamilia";
import { dadosFamilia, editarFamilia, conteudoQR, hora } from "../lib/kinder";
import { nomeCategoria, varsCategoria } from "../lib/modelo";

const ATUALIZAR_MS = 20000;

/**
 * /familia/<token> — o que os pais têm em vez de uma conta. Mostra o
 * QR para a entrada (e, depois do check-in, o código de levantamento
 * do dia), onde está cada criança, o resumo da lição e os dados para
 * corrigir. O token no caminho é o único segredo: só esta família.
 */
export default function LinkFamilia({ token }) {
  return (
    <TorradaProvider>
      <div className="kin-publico">
        <Conteudo token={token} />
      </div>
    </TorradaProvider>
  );
}

function Conteudo({ token }) {
  const torrada = useTorrada();
  const [f, setF] = useState(null);
  const [erro, setErro] = useState("");
  const [aEditar, setAEditar] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  const carregar = useCallback(() => {
    return dadosFamilia(token)
      .then((d) => { setF(d); setErro(""); })
      .catch((e) => setErro(e.code === "functions/not-found"
        ? "Este link já não funciona. Pede um novo a um voluntário do Kinder."
        : "Não foi possível carregar. Verifica a ligação."));
  }, [token]);

  useEffect(() => {
    try { localStorage.setItem(CHAVE_TOKEN_FAMILIA, token); } catch { /* sem armazenamento */ }
    carregar();
    // o código aparece quando o voluntário faz o check-in — sem isto os
    // pais tinham de recarregar a página à mão para o ver
    const t = setInterval(() => { if (document.visibilityState === "visible" && !aEditar) carregar(); }, ATUALIZAR_MS);
    return () => clearInterval(t);
  }, [token, carregar, aEditar]);

  async function guardar(dados) {
    setAEnviar(true);
    try {
      await editarFamilia({ token, ...dados });
      await carregar();
      setAEditar(false);
      torrada("Dados atualizados");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.", true);
    } finally {
      setAEnviar(false);
    }
  }

  if (erro && !f) {
    return (
      <>
        <CabecalhoPublico titulo={<>Kinder</>} />
        <main className="folha"><p className="aviso" style={{ marginTop: 16 }}>{erro}</p></main>
      </>
    );
  }
  if (!f) {
    return (
      <>
        <CabecalhoPublico titulo={<>Kinder</>} />
        <main className="folha"><div className="vaz" style={{ marginTop: 16 }}>A carregar…</div></main>
      </>
    );
  }

  const nomes = f.criancas.map((c) => c.nome.split(" ")[0]).join(", ");
  const checkins = f.hoje.checkins;
  const algumaNaSala = f.criancas.some((c) => checkins[c.id] && !checkins[c.id].saidaEm);

  if (aEditar) {
    return (
      <>
        <CabecalhoPublico titulo={<>Os vossos <em>dados</em></>} subtitulo={nomes} />
        <main className="folha">
          <FormFamilia
            inicial={f} aEnviar={aEnviar} textoBotao="Guardar"
            onSubmeter={guardar} onCancelar={() => setAEditar(false)}
            avisar={(m) => torrada(m, true)}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <AvisoOffline />
      <CabecalhoPublico titulo={<>Olá, <em>família</em></>} subtitulo={nomes} />
      <main className="folha">
        <div className="sect" style={{ textAlign: "center" }}>
          {f.hoje.codigo && algumaNaSala ? (
            <>
              <p className="cap">Código para ir buscar hoje</p>
              <p className="kin-codigo">{f.hoje.codigo}</p>
              <CodigoQR texto={conteudoQR(f.familiaId, f.hoje.codigo)} rotulo="QR de saída" />
              <p className="ds">Diz o código ou mostra este QR na saída do Kinder.</p>
            </>
          ) : (
            <>
              <p className="cap">Entrada no Kinder</p>
              <CodigoQR texto={conteudoQR(f.familiaId)} rotulo="QR da família" />
              <p className="ds">Mostra este QR na receção do Kinder para entrarem mais depressa.</p>
              {f.estado === "pendente" && (
                <p className="ds" style={{ marginTop: 6 }}>O registo é confirmado no primeiro domingo, à entrada.</p>
              )}
            </>
          )}
        </div>

        <div className="sect">
          <div className="cabecalho"><h3>Hoje</h3><button className="btn sec" style={{ padding: "7px 13px", fontSize: 12.5 }} onClick={carregar}>Atualizar</button></div>
          {f.criancas.map((c) => {
            const ck = checkins[c.id];
            const estado = !ck ? "Ainda não entrou hoje"
              : ck.saidaEm ? `Saiu às ${hora(ck.saidaEm)}${ck.levantadoPor ? ` com ${ck.levantadoPor}` : ""}`
              : `Na sala desde as ${hora(ck.entradaEm)}`;
            return (
              <div className="linha" key={c.id}>
                <div style={{ flex: 1 }}>
                  <p className="nmt">{c.nome}</p>
                  <p className="ds">{estado}</p>
                </div>
                {c.categoria && <span className="kin-tagcat" style={varsCategoria(c.categoria)}>{nomeCategoria(c.categoria)}</span>}
              </div>
            );
          })}
        </div>

        {f.licoes.length > 0 && (
          <div className="sect">
            <div className="cabecalho"><h3>O que aprenderam</h3></div>
            {f.licoes.map((l) => (
              <div className="kin-faixa" key={l.id} style={varsCategoria(l.categorias?.[0])}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <p className="nmt">{l.titulo}</p>
                  {l.eventoId && <p className="ds" style={{ whiteSpace: "nowrap" }}>{dataPorExtenso(l.eventoId)}</p>}
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 6, whiteSpace: "pre-line" }}>{l.resumoPais}</p>
              </div>
            ))}
          </div>
        )}

        <div className="sect">
          <div className="cabecalho"><h3>Os vossos dados</h3></div>
          {f.criancas.map((c) => (
            <div className="linha" key={c.id}>
              <div style={{ flex: 1 }}>
                <p className="nmt">{c.nome}</p>
                <div>
                  {c.alergias && <span className="kin-alerta">Alergias: {c.alergias}</span>}
                  {c.restricoesAlimentares && <span className="kin-alerta info">{c.restricoesAlimentares}</span>}
                  {c.necessidades && <span className="kin-alerta info">{c.necessidades}</span>}
                </div>
              </div>
            </div>
          ))}
          <p className="ds" style={{ marginTop: 10 }}>
            Responsáveis: {f.responsaveis.map((r) => r.nome).join(", ")}
            {f.autorizados.length > 0 && <> · Podem ir buscar: {f.autorizados.map((a) => a.nome).join(", ")}</>}
          </p>
          <button className="btn sec full" style={{ marginTop: 12 }} onClick={() => setAEditar(true)}>Corrigir dados</button>
        </div>
        <p className="nota">Guarda este link no ecrã principal do telemóvel. Não o partilhes fora da família.</p>
      </main>
    </>
  );
}
