import { useEffect, useRef, useState } from "react";
import {
  ouvirMelhoria, ouvirEventosMelhoria, comentarMelhoria, definirEstadoMelhoria,
  definirPrevisao, resolverMelhoria, transformarMelhoriaEmArtigoWiki, desativarMelhoria,
  enviarFotoResolucaoMelhoria, corMelhoria, GRAVIDADES,
} from "../../lib/melhorias";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import FotoRedonda from "@portal/shared/components/FotoRedonda.jsx";

const NOMES_EVENTO = {
  abertura: "abriu a melhoria", comentario: "comentou", estado: "mudou o estado para",
  meta: "definiu a meta para", previsao: "definiu a previsão para", resolucao: "resolveu",
};
const TAMANHO_MAX = 6 * 1024 * 1024;

/** Por defeito é só leitura — quem quiser mexer toca em "Editar", que
 *  revela os campos (comentar, previsão, resolver…) lá em baixo. Vem
 *  direto no modo de edição quando aberta pelo lápis da tabela. */
export default function SheetMelhoria({ melhoriaId, uid, papel, voluntarios, equipamentos, editarInicial = false, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const souLiderBase = papel === "lider_base";
  const [melhoria, setMelhoria] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [aEditar, setAEditar] = useState(editarInicial);
  const [comentario, setComentario] = useState("");
  const [previsao, setPrevisao] = useState("");
  const [notaResolucao, setNotaResolucao] = useState("");
  const [fotoResolucao, setFotoResolucao] = useState(null);
  const inputFotoRef = useRef(null);
  const [aEnviarFoto, setAEnviarFoto] = useState(false);
  const [aResolver, setAResolver] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => ouvirMelhoria(melhoriaId, setMelhoria), [melhoriaId]);
  useEffect(() => ouvirEventosMelhoria(melhoriaId, setEventos), [melhoriaId]);
  useEffect(() => { setPrevisao(melhoria?.previsao ?? ""); }, [melhoria?.previsao]);

  const nomeDe = (id) => voluntarios.find((p) => p.id === id)?.nome ?? "alguém";
  const equipamento = melhoria?.equipamentoId ? equipamentos.find((e) => e.id === melhoria.equipamentoId) : null;
  const gravidadeTexto = GRAVIDADES.find(([k]) => k === melhoria?.gravidade)?.[1];

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

  async function marcarEmCurso() {
    try {
      await definirEstadoMelhoria(melhoriaId, "em_curso");
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
  const { cor, texto: corTexto } = corMelhoria(melhoria);

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{melhoria.titulo}</h2>
        <p className="ds" style={{ marginTop: 6 }}>
          {gravidadeTexto} · {equipamento ? equipamento.nome : "sem equipamento ligado"}
        </p>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <span className={`tag ${melhoria.estado === "resolvida" ? "verd" : melhoria.estado === "em_curso" ? "lim" : "cinz"}`}>
            {melhoria.estado === "resolvida" ? "Resolvida" : melhoria.estado === "em_curso" ? "Em curso" : "Aberta"}
          </span>
          {melhoria.estado !== "resolvida" && <span className={`tag ${cor}`}>{corTexto}</span>}
        </div>
        {melhoria.descricao && <p style={{ marginTop: 12, lineHeight: 1.6 }}>{melhoria.descricao}</p>}
        {melhoria.foto && <div style={{ marginTop: 10 }}><FotoRedonda src={melhoria.foto} alt={melhoria.titulo} tamanho={90} /></div>}
        {(melhoria.meta || melhoria.previsao) && (
          <p className="ds" style={{ marginTop: 10 }}>
            {melhoria.meta && `Meta ${melhoria.meta}`}
            {melhoria.meta && melhoria.previsao && " · "}
            {melhoria.previsao && `Previsão ${melhoria.previsao}`}
          </p>
        )}

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
                {(ev.tipo === "estado" || ev.tipo === "previsao" || ev.tipo === "meta") ? ` ${ev.texto}` : ""}
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

        {!aEditar ? (
          <button className="btn sec full" style={{ marginTop: 16 }} onClick={() => setAEditar(true)}>Editar</button>
        ) : (
          <>
            <label className="rot" style={{ marginTop: 16 }}>Previsão de quem está a tratar</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="campo" type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
              <button className="btn sec" style={{ padding: "10px 14px", fontSize: 12.5 }} onClick={guardarPrevisao}>Guardar</button>
            </div>

            <label className="rot" style={{ marginTop: 14 }}>Comentar</label>
            <textarea className="campo" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Escreve aqui" />
            <button className="btn sec full" style={{ marginTop: 8 }} disabled={aEnviar} onClick={enviarComentario}>Comentar</button>

            {melhoria.estado === "aberta" && (
              <button className="btn sec full" style={{ marginTop: 10 }} onClick={marcarEmCurso}>Marcar em curso</button>
            )}

            {melhoria.estado !== "resolvida" && (
              <>
                <label className="rot" style={{ marginTop: 14 }}>Resolver — nota obrigatória</label>
                <textarea className="campo" rows={3} value={notaResolucao} onChange={(e) => setNotaResolucao(e.target.value)} placeholder="O que foi feito para resolver" />
                <label className="rot">Foto de resolução (opcional)</label>
                {fotoResolucao && <div style={{ marginTop: 6 }}><FotoRedonda src={fotoResolucao} alt="" tamanho={72} /></div>}
                <input ref={inputFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={escolherFotoResolucao} />
                <button className="btn sec full" style={{ marginTop: 6 }} disabled={aEnviarFoto} onClick={() => inputFotoRef.current.click()}>
                  {aEnviarFoto ? "A enviar…" : fotoResolucao ? "Trocar foto" : "Juntar foto"}
                </button>
                <button className="btn full" style={{ marginTop: 8 }} disabled={aResolver || aEnviarFoto} onClick={resolver}>Resolver</button>
              </>
            )}

            {podeExcluir && (
              <button className="btn sec full" style={{ marginTop: 14, color: "var(--magenta)" }} onClick={excluir}>Excluir melhoria</button>
            )}
          </>
        )}

        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
