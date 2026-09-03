import { useEffect, useRef, useState } from "react";
import {
  ouvirMelhoria, ouvirEventosMelhoria, comentarMelhoria, definirEstadoMelhoria,
  definirPrevisao, resolverMelhoria, transformarMelhoriaEmArtigoWiki, desativarMelhoria,
  definirResponsaveisMelhoria,
  enviarFotoResolucaoMelhoria, corPrevisao, GRAVIDADE_INFO, ESTADO_INFO,
} from "../../lib/melhorias";
import { souLiderOuAuxiliar } from "../../lib/modelo";
import { dataPorExtenso } from "@portal/shared/lib/data.js";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import FotoRedonda from "@portal/shared/components/FotoRedonda.jsx";

const NOMES_EVENTO = {
  abertura: "abriu a melhoria", comentario: "comentou", estado: "mudou o estado para",
  previsao: "definiu a previsão para", resolucao: "resolveu", exclusao: "excluiu", responsaveis: "mudou quem trata disto",
};

/** O evento guarda a chave crua (`em_curso`, `2026-08-23`) porque é
 *  isso que a Cloud Function escreve. Mostrar isso ao voluntário era
 *  deixar escapar o nome interno do campo para a tela — daí o mapa
 *  para o mesmo texto que as etiquetas usam. */
function textoDoEvento(ev) {
  if (ev.tipo === "estado") return ESTADO_INFO[ev.texto]?.texto ?? ev.texto;
  if (ev.tipo === "previsao") return /^\d{4}-\d{2}-\d{2}$/.test(ev.texto) ? dataPorExtenso(ev.texto) : ev.texto;
  return ev.texto;
}
const TAMANHO_MAX = 6 * 1024 * 1024;

/** Só leitura quando aberta a partir da linha (toque no cartão); os
 *  campos de edição (comentar, previsão, resolver…) só aparecem
 *  quando aberta pelo lápis do cartão — não há alternância aqui
 *  dentro, editar é sempre pelo lápis. */
export default function SheetMelhoria({ melhoriaId, uid, papel, voluntarios, equipamentos, editarInicial = false, resolverInicial = false, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const souLiderBase = souLiderOuAuxiliar(papel);
  const [melhoria, setMelhoria] = useState(null);
  const [eventos, setEventos] = useState([]);
  const aEditar = editarInicial;
  const [comentario, setComentario] = useState("");
  const [aGuardarResp, setAGuardarResp] = useState(false);
  const [previsao, setPrevisao] = useState("");
  const [notaResolucao, setNotaResolucao] = useState("");
  const [fotoResolucao, setFotoResolucao] = useState(null);
  const inputFotoRef = useRef(null);
  const [aEnviarFoto, setAEnviarFoto] = useState(false);
  const [aResolver, setAResolver] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [aResolverForm, setAResolverForm] = useState(false);

  useEffect(() => ouvirMelhoria(melhoriaId, setMelhoria), [melhoriaId]);
  useEffect(() => ouvirEventosMelhoria(melhoriaId, setEventos), [melhoriaId]);
  useEffect(() => { setPrevisao(melhoria?.previsao ?? ""); }, [melhoria?.previsao]);
  useEffect(() => {
    if (resolverInicial && melhoria && melhoria.estado !== "resolvida") setAResolverForm(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolverInicial, !!melhoria]);

  const nomeDe = (id) => voluntarios.find((p) => p.id === id)?.nome ?? "alguém";
  const equipamento = melhoria?.equipamentoId ? equipamentos.find((e) => e.id === melhoria.equipamentoId) : null;

  async function escolherFotoResolucao(e) {
    const ficheiro = e.target.files[0];
    e.target.value = "";
    if (!ficheiro) return;
    if (!ficheiro.type.startsWith("image/")) return torrada("Tem de ser uma imagem.");
    if (ficheiro.size >= TAMANHO_MAX) return torrada("A imagem tem de ter menos de 6 MB.");
    setAEnviarFoto(true);
    try {
      const url = await enviarFotoResolucaoMelhoria(melhoriaId, ficheiro);
      setFotoResolucao(url);
    } catch (e2) {
      torrada(e2.message || "Não foi possível enviar a foto.");
    } finally {
      setAEnviarFoto(false);
    }
  }

  async function enviarComentario() {
    const t = comentario.trim();
    if (!t) return torrada("Escreve o comentário antes de enviar.");
    setAEnviar(true);
    try {
      await comentarMelhoria(melhoriaId, t);
      setComentario("");
    } catch (e) {
      torrada(e.message || "Não foi possível comentar.");
    } finally {
      setAEnviar(false);
    }
  }

  async function mudarEstado(novoEstado) {
    if (novoEstado === melhoria.estado) return;
    if (novoEstado === "resolvida") {
      setAResolverForm(true);
      return;
    }
    try {
      await definirEstadoMelhoria(melhoriaId, novoEstado);
    } catch (e) {
      torrada(e.message || "Não foi possível mudar o estado.");
    }
  }

  async function reabrir() {
    try {
      await definirEstadoMelhoria(melhoriaId, "aberta");
    } catch (e) {
      torrada(e.message || "Não foi possível reabrir.");
    }
  }

  async function guardarPrevisao() {
    try {
      await definirPrevisao(melhoriaId, previsao || null);
      torrada("Previsão atualizada");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar a previsão.");
    }
  }

  async function resolver() {
    const n = notaResolucao.trim();
    if (!n) return torrada("A nota de resolução é obrigatória.");
    setAResolver(true);
    try {
      await resolverMelhoria(melhoriaId, n, fotoResolucao);
      torrada("Melhoria resolvida");
    } catch (e) {
      torrada(e.message || "Não foi possível resolver.");
      setAResolver(false);
    }
  }

  async function transformarEmArtigo() {
    try {
      await transformarMelhoriaEmArtigoWiki(melhoriaId);
      torrada("Transformada em artigo da Wiki");
    } catch (e) {
      torrada(e.message || "Não foi possível transformar.");
    }
  }

  async function excluir() {
    try {
      await desativarMelhoria(melhoriaId);
      onGuardado("Melhoria excluída");
    } catch (e) {
      torrada(e.message || "Não foi possível excluir.");
    }
  }

  if (!melhoria) return null;
  const podeExcluir = souLiderBase || melhoria.abertaPor === uid;
  const gravInfo = GRAVIDADE_INFO[melhoria.gravidade];
  const estInfo = ESTADO_INFO[melhoria.estado];
  const { atrasada, texto: previsaoTexto } = corPrevisao(melhoria);

  async function alternarResponsavel(pid) {
    const atuais = melhoria?.responsaveis || [];
    const novos = atuais.includes(pid) ? atuais.filter((x) => x !== pid) : [...atuais, pid];
    setAGuardarResp(true);
    try {
      await definirResponsaveisMelhoria(melhoriaId, novos);
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.");
    } finally {
      setAGuardarResp(false);
    }
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{melhoria.titulo}</h2>
        <p className="ds" style={{ marginTop: 6 }}>{equipamento ? equipamento.nome : "sem equipamento ligado"}</p>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
          {gravInfo && <span className={`selo ${gravInfo.cor}`}>{gravInfo.texto}</span>}
          {estInfo && <span className={`selo ${estInfo.cor}`}>{estInfo.texto}</span>}
          {melhoria.estado !== "resolvida" && (
            <span className="ds" style={atrasada ? { color: "var(--magenta)", fontWeight: 700 } : undefined}>{previsaoTexto}</span>
          )}
        </div>
        {melhoria.descricao && <p style={{ marginTop: 12, lineHeight: 1.6 }}>{melhoria.descricao}</p>}
        {melhoria.foto && <div style={{ marginTop: 10 }}><FotoRedonda src={melhoria.foto} alt={melhoria.titulo} tamanho={90} /></div>}

        {melhoria.estado === "resolvida" && (
          <div className="caixa" style={{ background: "var(--agua)", border: 0, marginTop: 14 }}>
            <p className="cap">Nota de resolução</p>
            <p style={{ marginTop: 6, lineHeight: 1.6 }}>{melhoria.notaResolucao}</p>
            {melhoria.fotoResolucao && <div style={{ marginTop: 8 }}><FotoRedonda src={melhoria.fotoResolucao} alt="Resolução" tamanho={72} /></div>}
            <p className="ds" style={{ marginTop: 6 }}>Resolvida por {nomeDe(melhoria.resolvidaPor)}</p>
          </div>
        )}

        <label className="rot" style={{ marginTop: 16 }}>Linha do tempo</label>
        {eventos.map((ev) => (
          <div key={ev.id} className="linha" style={{ alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <p className="nmt" style={{ fontSize: 14 }}>
                {nomeDe(ev.autorId)} {NOMES_EVENTO[ev.tipo] ?? ev.tipo}
                {(ev.tipo === "estado" || ev.tipo === "previsao") ? ` ${textoDoEvento(ev)}` : ""}
              </p>
              {(ev.tipo === "comentario" || ev.tipo === "abertura" || ev.tipo === "resolucao") && ev.texto && (
                <p className="ds" style={{ marginTop: 2 }}>{ev.texto}</p>
              )}
            </div>
          </div>
        ))}

        {melhoria.estado === "resolvida" && (
          <>
            <button className="btn full" style={{ marginTop: 16 }} onClick={transformarEmArtigo}>Transformar em artigo da Wiki</button>
            {souLiderBase && <button className="btn sec full" style={{ marginTop: 9 }} onClick={reabrir}>Reabrir</button>}
          </>
        )}

        {aEditar && (
          <>
            {/* Quem fica encarregue. Vários de propósito: "comprei os
              * cabos" e "testa-os no domingo" são duas pessoas no mesmo
              * assunto, não duas melhorias. Aparece no Início de cada um. */}
            <label className="rot" style={{ marginTop: 16 }}>Quem trata disto</label>
            <div className="subtabs" style={{ flexWrap: "wrap", margin: 0 }}>
              {voluntarios.filter((v) => v.ativo !== false).map((v) => (
                <button key={v.id} disabled={aGuardarResp}
                  data-on={(melhoria.responsaveis || []).includes(v.id) ? 1 : 0}
                  onClick={() => alternarResponsavel(v.id)}>
                  {v.nome}
                </button>
              ))}
            </div>
            {(melhoria.responsaveis || []).length === 0 && (
              <p className="ds" style={{ marginTop: 6 }}>Ninguém encarregue ainda. Aparece no Início de quem escolheres.</p>
            )}

            <label className="rot" style={{ marginTop: 16 }}>Previsão de quem está a tratar</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="campo" type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
              <button className="btn sec" style={{ padding: "10px 14px", fontSize: 12.5 }} onClick={guardarPrevisao}>Guardar</button>
            </div>

            <label className="rot" style={{ marginTop: 14 }}>Comentar</label>
            <textarea className="campo" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Escreve aqui" />
            <button className="btn sec full" style={{ marginTop: 8 }} disabled={aEnviar} onClick={enviarComentario}>Comentar</button>

            {melhoria.estado !== "resolvida" && (
              <>
                <label className="rot" style={{ marginTop: 14 }}>Status</label>
                <select className="campo" value={melhoria.estado} onChange={(e) => mudarEstado(e.target.value)}>
                  <option value="aberta" disabled={!souLiderBase}>Aberta</option>
                  <option value="em_curso">Em curso</option>
                  <option value="resolvida">Resolvida</option>
                </select>
              </>
            )}

            {melhoria.estado !== "resolvida" && aResolverForm && (
              <div className="caixa" style={{ marginTop: 16 }}>
                <label className="rot">Resolver — nota obrigatória</label>
                <textarea className="campo" rows={3} value={notaResolucao} onChange={(e) => setNotaResolucao(e.target.value)} placeholder="O que foi feito para resolver" />
                <label className="rot">Foto de resolução (opcional)</label>
                {fotoResolucao && <div style={{ marginTop: 6 }}><FotoRedonda src={fotoResolucao} alt="" tamanho={72} /></div>}
                <input ref={inputFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={escolherFotoResolucao} />
                <button className="btn sec full" style={{ marginTop: 6 }} disabled={aEnviarFoto} onClick={() => inputFotoRef.current.click()}>
                  {aEnviarFoto ? "A enviar…" : fotoResolucao ? "Trocar foto" : "Juntar foto"}
                </button>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="btn sec" style={{ padding: "10px 14px", fontSize: 12.5 }} onClick={() => setAResolverForm(false)}>Cancelar</button>
                  <button className="btn full" disabled={aResolver || aEnviarFoto} onClick={resolver}>Resolver</button>
                </div>
              </div>
            )}

            {podeExcluir && (
              <button className="btn perigo full" style={{ marginTop: 14 }} onClick={excluir}>Excluir melhoria</button>
            )}
          </>
        )}

        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
