import { useRef, useState } from "react";
import { lerOrdemCulto, lerEEnviarOrdemCulto, removerOrdemCulto, limparOrdemCulto } from "../../lib/culto";
import { useTorrada } from "../../lib/TorradaContext";
import { nomeEvento, hojeISO } from "../../lib/data";
import OrdemCultoTimeline from "./OrdemCultoTimeline";
import SheetRevisaoOrdem from "./SheetRevisaoOrdem";

/** Um culto no separador Culto → Ordem. Fechado mostra só a data e o
 *  estado; aberto mostra a cronologia publicada, ou o botão de subir/
 *  rever o PDF enquanto o líder ainda não publicou. */
export default function OrdemCultoCard({ evento, aberto, onAbrir, souLiderBase, chegada, pdfUrlExistente, onPdfEnviado, onVerFuncoes }) {
  const torrada = useTorrada();
  const inputRef = useRef(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [aConfirmarRemover, setAConfirmarRemover] = useState(false);
  const [aConfirmarLimpar, setAConfirmarLimpar] = useState(false);
  const [revisao, setRevisao] = useState(null);
  const [sugestao, setSugestao] = useState(null);

  const publicado = !!evento.ordem;
  const pdfUrl = evento.ordem?.pdfUrl ?? pdfUrlExistente;

  async function escolherPdf(ficheiro) {
    if (ficheiro.type !== "application/pdf") return torrada("Tem de ser um PDF.");
    setAEnviar(true);
    try {
      const resultado = await lerEEnviarOrdemCulto(evento.id, ficheiro);
      onPdfEnviado?.(evento.id, resultado.pdfUrl);
      if (!aberto) onAbrir();
      setRevisao(resultado);
      if (resultado.falhou) torrada("Não consegui ler a tabela — o PDF ficou guardado, preenche à mão.");
    } catch (e) {
      torrada(e.message || "Não foi possível subir o ficheiro.");
    } finally {
      setAEnviar(false);
    }
  }

  async function reverExistente() {
    setAEnviar(true);
    try {
      const resultado = await lerOrdemCulto(evento.id);
      setRevisao({ ...resultado, pdfUrl });
    } catch (e) {
      torrada(e.message || "Não foi possível ler o PDF.");
    } finally {
      setAEnviar(false);
    }
  }

  async function remover() {
    setAEnviar(true);
    try {
      await removerOrdemCulto(evento.id);
      onPdfEnviado?.(evento.id, null);
      setAConfirmarRemover(false);
      torrada("Ficheiro removido");
    } catch (e) {
      torrada(e.message || "Não foi possível remover o ficheiro.");
    } finally {
      setAEnviar(false);
    }
  }

  async function limpar() {
    setAEnviar(true);
    try {
      await limparOrdemCulto(evento.id);
      onPdfEnviado?.(evento.id, null);
      setAConfirmarLimpar(false);
      torrada("Ordem limpa — volta a estar à espera do PDF");
    } catch (e) {
      torrada(e.message || "Não foi possível limpar a ordem.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <div className="oc-cartao">
      <button className="oc-cab" data-aberto={aberto ? 1 : 0} onClick={onAbrir}>
        <div>
          <p className="nm">{nomeEvento(evento)}</p>
          <p className="ds">
            {publicado
              ? `Publicado · ${evento.ordem.momentos.length} momentos`
              : pdfUrl ? "PDF enviado · por rever e publicar" : "À espera do PDF"}
          </p>
        </div>
        <span className="seta">›</span>
      </button>

      {aberto && (
        <div className="oc-corpo">
          {publicado ? (
            <>
              <OrdemCultoTimeline ordem={evento.ordem} chegada={chegada} hoje={evento.data === hojeISO()} />
              {souLiderBase && !aConfirmarLimpar && (
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button
                    className="btn sec" style={{ flex: 1, fontSize: 13 }} disabled={aEnviar}
                    onClick={() => inputRef.current.click()}
                  >
                    {aEnviar ? "A enviar…" : "Substituir por um novo PDF"}
                  </button>
                  <button
                    className="btn sec" style={{ flex: 1, fontSize: 13, color: "var(--magenta)" }} disabled={aEnviar}
                    onClick={() => setAConfirmarLimpar(true)}
                  >
                    Limpar Ordem
                  </button>
                </div>
              )}
              {souLiderBase && aConfirmarLimpar && (
                <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>Limpar a ordem publicada?</p>
                  <p className="ds" style={{ marginTop: 4 }}>
                    Apaga a ordem publicada e o PDF — volta ao estado "à espera do PDF", como se nada tivesse sido enviado.
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      className="btn" style={{ flex: 1, background: "var(--magenta)", fontSize: 12.5 }}
                      disabled={aEnviar} onClick={limpar}
                    >
                      {aEnviar ? "A limpar…" : "Limpar"}
                    </button>
                    <button
                      className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aEnviar}
                      onClick={() => setAConfirmarLimpar(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {pdfUrl ? (
                <a className="linha" href={pdfUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className="bola" style={{ background: "var(--violeta)" }}>▤</span>
                  <div style={{ flex: 1 }}><p className="nmt">Ordem do culto</p><p className="ds">Abrir PDF</p></div>
                  <span className="seta">›</span>
                </a>
              ) : (
                <div className="vaz">O líder costuma subir o ficheiro à quinta-feira.</div>
              )}
              {souLiderBase && (
                <button
                  className="btn sec full" style={{ marginTop: 12 }} disabled={aEnviar}
                  onClick={() => (pdfUrl ? reverExistente() : inputRef.current.click())}
                >
                  {aEnviar ? "A ler o ficheiro…" : pdfUrl ? "Rever e publicar" : "Subir ficheiro"}
                </button>
              )}
              {souLiderBase && pdfUrl && !aConfirmarRemover && (
                <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                  <button
                    className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aEnviar}
                    onClick={() => inputRef.current.click()}
                  >
                    Substituir o ficheiro
                  </button>
                  <button
                    className="btn sec" style={{ flex: 1, fontSize: 12.5, color: "var(--magenta)" }} disabled={aEnviar}
                    onClick={() => setAConfirmarRemover(true)}
                  >
                    Remover ficheiro
                  </button>
                </div>
              )}
              {souLiderBase && pdfUrl && aConfirmarRemover && (
                <div className="caixa" style={{ background: "#FFF0F4", border: 0, marginTop: 9 }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>Remover este PDF?</p>
                  <p className="ds" style={{ marginTop: 4 }}>
                    Fica sem ficheiro nenhum para os voluntários até subires outro.
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      className="btn" style={{ flex: 1, background: "var(--magenta)", fontSize: 12.5 }}
                      disabled={aEnviar} onClick={remover}
                    >
                      {aEnviar ? "A remover…" : "Remover"}
                    </button>
                    <button
                      className="btn sec" style={{ flex: 1, fontSize: 12.5 }} disabled={aEnviar}
                      onClick={() => setAConfirmarRemover(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {sugestao?.length > 0 && (
            <div className="oc-sugestao">
              <p className="nm">
                Criámos {sugestao.length} culto{sugestao.length === 1 ? "" : "s"} especial{sugestao.length === 1 ? "" : "is"} a partir dos avisos
              </p>
              <p className="ds">Já podes configurar quem serve e as funções de cada um.</p>
              <div className="lin">
                {sugestao.map((c) => (
                  <button key={c.id} className="btn sec" style={{ padding: "9px 14px", fontSize: 12.5 }} onClick={() => onVerFuncoes?.(c.id)}>
                    {c.tipo} ›
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {souLiderBase && (
        <input
          ref={inputRef} type="file" accept="application/pdf" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) escolherPdf(f); }}
        />
      )}

      {revisao && (
        <SheetRevisaoOrdem
          evento={evento} inicial={revisao}
          onFechar={() => setRevisao(null)}
          onPublicado={(criados) => { setRevisao(null); setSugestao(criados); }}
        />
      )}
    </div>
  );
}
