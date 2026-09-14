import { useEffect, useRef, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { nomeEvento } from "@portal/shared/lib/data.js";
import { CATEGORIAS, nomeCategoria, varsCategoria } from "../../lib/modelo";
import { guardarLicao, novoIdLicao } from "../../lib/licoes";
import { obterEventosDoMes } from "../../lib/painel";
import { hojeLocal } from "../../lib/kinder";

const ACEITA = ".pdf,application/pdf,.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*";
const TAMANHO_MAX = 20 * 1024 * 1024;

function validar(f) {
  if (!f) return null;
  const ok = f.type === "application/pdf" || f.type.startsWith("image/")
    || f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (!ok) return "Tem de ser um PDF, uma imagem ou um .docx.";
  if (f.size >= TAMANHO_MAX) return "O ficheiro tem de ter menos de 20 MB.";
  return null;
}

/** Uma linha de documento — "Escolher…"/nome do ficheiro escolhido ou
 *  já enviado antes, com um "✕" só quando faz sentido tirar (nas
 *  atividades, nunca na lição/recurso, que continuam sempre lá). */
function LinhaDocumento({ rotulo, nomeAtual, ficheiro, onEscolher, onRemover }) {
  const inputRef = useRef(null);
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
      <input ref={inputRef} type="file" accept={ACEITA} style={{ display: "none" }} onChange={(e) => { onEscolher(e.target.files[0] ?? null); e.target.value = ""; }} />
      <button type="button" className="btn sec" style={{ flex: 1, textAlign: "left" }} onClick={() => inputRef.current.click()}>
        {ficheiro ? ficheiro.name : nomeAtual ? `Trocar ${nomeAtual}` : rotulo}
      </button>
      {onRemover && <button type="button" className="oc-icobt mag" aria-label="Remover" onClick={onRemover}>✕</button>}
    </div>
  );
}

/** Nova lição / editar. Quatro documentos, cada um com o seu botão:
 *  Lição do dia (o principal), Recurso, e Atividades (0 ou mais,
 *  "+ Atividade" para adicionar). Sem link nenhum da Kiwify — o
 *  ficheiro em si é o que chega ao voluntário. */
export default function SheetLicao({ licao, uid, salaInicial, restrita, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const idRef = useRef(licao?.id ?? novoIdLicao());
  const [titulo, setTitulo] = useState(licao?.titulo ?? "");
  const [categorias, setCategorias] = useState(restrita ? [restrita] : licao?.categorias ?? (salaInicial ? [salaInicial] : []));
  const [eventoId, setEventoId] = useState(licao?.eventoId ?? "");
  const [resumo, setResumo] = useState(licao?.resumo ?? "");
  const [resumoPais, setResumoPais] = useState(licao?.resumoPais ?? "");
  const [louvor, setLouvor] = useState(licao?.louvor ?? "");
  const [licaoFicheiro, setLicaoFicheiro] = useState(null);
  const [recursoFicheiro, setRecursoFicheiro] = useState(null);
  // uma entrada por atividade já guardada + as que a líder for
  // acrescentando nesta sessão (começam sem ficheiro escolhido nenhum)
  const [atividadesAtuais, setAtividadesAtuais] = useState(licao?.atividades ?? []);
  const [atividadesFicheiros, setAtividadesFicheiros] = useState((licao?.atividades ?? []).map(() => null));
  const [eventos, setEventos] = useState([]);
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    const agora = new Date();
    const seguinte = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
    const hoje = hojeLocal();
    Promise.all([
      obterEventosDoMes(agora.getFullYear(), agora.getMonth()),
      obterEventosDoMes(seguinte.getFullYear(), seguinte.getMonth()),
    ]).then(([a, b]) => {
      const futuros = [...a, ...b].filter((e) => e.data >= hoje);
      setEventos(futuros);
      if (!licao && futuros[0]) setEventoId((v) => v || futuros[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function alternarSala(id) {
    setCategorias((cs) => (cs.includes(id) ? cs.filter((c) => c !== id) : [...cs, id]));
  }

  function escolher(setter, ficheiro) {
    const erro = validar(ficheiro);
    if (erro) return torrada(erro, true);
    setter(ficheiro);
  }

  function adicionarAtividade() {
    setAtividadesAtuais((a) => [...a, null]);
    setAtividadesFicheiros((a) => [...a, null]);
  }

  function removerAtividade(i) {
    setAtividadesAtuais((a) => a.filter((_, j) => j !== i));
    setAtividadesFicheiros((a) => a.filter((_, j) => j !== i));
  }

  function escolherAtividade(i, ficheiro) {
    const erro = validar(ficheiro);
    if (erro) return torrada(erro, true);
    setAtividadesFicheiros((a) => a.map((f, j) => (j === i ? ficheiro : f)));
  }

  async function guardar() {
    if (!titulo.trim()) return torrada("Falta o título.");
    if (!categorias.length) return torrada("Escolhe pelo menos uma sala.");
    if (!licaoFicheiro && !licao?.licao) return torrada("Falta o documento da lição do dia.");
    setAEnviar(true);
    try {
      await guardarLicao(idRef.current, uid, {
        titulo, categorias, resumo, resumoPais, louvor, eventoId,
        licaoFicheiro, recursoFicheiro,
        atividadesFicheiros, atividadesAtuais,
      }, !licao);
      onGuardado(licao ? "Lição atualizada" : "Lição publicada");
    } catch (e) {
      torrada(e.message || "Não foi possível guardar.", true);
      setAEnviar(false);
    }
  }

  const opcoesCulto = licao?.eventoId && !eventos.some((e) => e.id === licao.eventoId)
    ? [{ id: licao.eventoId, data: licao.eventoId }, ...eventos] : eventos;

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true">
        <div className="pux" />
        <h2>{licao ? "Editar lição" : "Nova lição"}</h2>

        <label className="rot" style={{ marginTop: 14 }}>Documento da lição do dia</label>
        <LinhaDocumento rotulo="Escolher PDF (ou foto, ou .docx)" nomeAtual={licao?.licao?.nome} ficheiro={licaoFicheiro} onEscolher={(f) => escolher(setLicaoFicheiro, f)} />

        <label className="rot">Documento de recurso (opcional)</label>
        <LinhaDocumento rotulo="Escolher documento" nomeAtual={licao?.recurso?.nome} ficheiro={recursoFicheiro} onEscolher={(f) => escolher(setRecursoFicheiro, f)} />

        <label className="rot">Documentos de atividade</label>
        {atividadesAtuais.map((atual, i) => (
          <LinhaDocumento
            key={i} rotulo={`Escolher atividade ${i + 1}`} nomeAtual={atual?.nome}
            ficheiro={atividadesFicheiros[i]}
            onEscolher={(f) => escolherAtividade(i, f)}
            onRemover={() => removerAtividade(i)}
          />
        ))}
        <button type="button" className="btn sec full" style={{ marginTop: 8 }} onClick={adicionarAtividade}>+ Atividade</button>
        <p className="ds" style={{ marginTop: 6 }}>Descarrega os documentos da área de membros da Kiwify e sobe-os aqui.</p>

        <label className="rot" style={{ marginTop: 14 }}>Título</label>
        <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: A arca de Noé" />
        <label className="rot">Para que salas</label>
        {restrita ? (
          <p className="kin-tagcat" style={varsCategoria(restrita)}>{nomeCategoria(restrita)}</p>
        ) : (
          <>
            <div className="kin-cats">
              {CATEGORIAS.map((c) => (
                <button key={c.id} type="button" className="kin-cat" style={varsCategoria(c.id)} data-on={categorias.includes(c.id) ? 1 : 0} onClick={() => alternarSala(c.id)}>
                  {c.nome}
                </button>
              ))}
            </div>
            <p className="ds">Podes escolher mais do que uma — muitas vezes Fun e Júnior usam a mesma.</p>
          </>
        )}
        <label className="rot">Culto</label>
        <select className="campo" value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
          <option value="">Sem culto marcado</option>
          {opcoesCulto.map((e) => <option key={e.id} value={e.id}>{nomeEvento(e)}</option>)}
        </select>
        <label className="rot">Resumo para os voluntários (opcional)</label>
        <textarea className="campo" rows={4} value={resumo} onChange={(e) => setResumo(e.target.value)} placeholder="A história, o versículo, a dinâmica…" />
        <label className="rot">Resumo para os pais (opcional)</label>
        <textarea className="campo" rows={3} value={resumoPais} onChange={(e) => setResumoPais(e.target.value)} placeholder="O que aprenderam hoje — aparece no link da família" />
        <label className="rot">Louvor (opcional)</label>
        <textarea className="campo" rows={3} value={louvor} onChange={(e) => setLouvor(e.target.value)} placeholder="Músicas e bandas que indicas para este culto" />
        <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar} onClick={guardar}>
          {aEnviar ? "A publicar…" : licao ? "Guardar" : "Publicar para a base"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
