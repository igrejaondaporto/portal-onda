import { useEffect, useRef, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { nomeEvento } from "@portal/shared/lib/data.js";
import { CATEGORIAS, varsCategoria } from "../../lib/modelo";
import { guardarLicao, novoIdLicao } from "../../lib/licoes";
import { obterEventosDoMes } from "../../lib/painel";
import { hojeLocal } from "../../lib/kinder";

const ACEITA = ".pdf,application/pdf,.docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*";
const TAMANHO_MAX = 20 * 1024 * 1024;

/** Nova lição / editar. O essencial é o documento (geralmente um PDF
 *  descarregado da Kiwify) e as salas; o resumo/materiais/resumo
 *  para os pais são para quem só tem o telemóvel na mão. */
export default function SheetLicao({ licao, uid, salaInicial, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const idRef = useRef(licao?.id ?? novoIdLicao());
  const inputRef = useRef(null);
  const [titulo, setTitulo] = useState(licao?.titulo ?? "");
  const [categorias, setCategorias] = useState(licao?.categorias ?? (salaInicial ? [salaInicial] : []));
  const [eventoId, setEventoId] = useState(licao?.eventoId ?? "");
  const [resumo, setResumo] = useState(licao?.resumo ?? "");
  const [materiais, setMateriais] = useState((licao?.materiais ?? []).join("\n"));
  const [resumoPais, setResumoPais] = useState(licao?.resumoPais ?? "");
  const [ficheiro, setFicheiro] = useState(null);
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
      // nova lição: por omissão, o próximo culto
      if (!licao && futuros[0]) setEventoId((v) => v || futuros[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function alternarSala(id) {
    setCategorias((cs) => (cs.includes(id) ? cs.filter((c) => c !== id) : [...cs, id]));
  }

  function escolherFicheiro(e) {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const ehPdf = f.type === "application/pdf";
    const ehImagem = f.type.startsWith("image/");
    const ehDocx = f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!ehPdf && !ehImagem && !ehDocx) return torrada("Tem de ser um PDF, uma imagem ou um .docx.", true);
    if (f.size >= TAMANHO_MAX) return torrada("O ficheiro tem de ter menos de 20 MB.", true);
    setFicheiro(f);
  }

  async function guardar() {
    if (!titulo.trim()) return torrada("Falta o título.");
    if (!categorias.length) return torrada("Escolhe pelo menos uma sala.");
    if (!ficheiro && !licao?.arquivoUrl) return torrada("Falta o documento da lição (geralmente um PDF).");
    setAEnviar(true);
    try {
      await guardarLicao(idRef.current, uid, {
        titulo, categorias, resumo, resumoPais, eventoId,
        materiais: materiais.split("\n"), ficheiro,
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
        <label className="rot" style={{ marginTop: 14 }}>Documento da lição</label>
        <input ref={inputRef} type="file" accept={ACEITA} style={{ display: "none" }} onChange={escolherFicheiro} />
        <button className="btn sec full" onClick={() => inputRef.current.click()}>
          {ficheiro ? ficheiro.name : licao?.arquivoNome ? `Trocar ${licao.arquivoNome}` : "Escolher PDF (ou foto, ou .docx)"}
        </button>
        <p className="ds" style={{ marginTop: 6 }}>Descarrega o documento da área de membros da Kiwify e sobe-o aqui.</p>
        <label className="rot">Título</label>
        <input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: A arca de Noé" />
        <label className="rot">Para que salas</label>
        <div className="kin-cats">
          {CATEGORIAS.map((c) => (
            <button key={c.id} type="button" className="kin-cat" style={varsCategoria(c.id)} data-on={categorias.includes(c.id) ? 1 : 0} onClick={() => alternarSala(c.id)}>
              {c.nome}
            </button>
          ))}
        </div>
        <p className="ds">Podes escolher mais do que uma — muitas vezes Fun e Júnior usam a mesma.</p>
        <label className="rot">Culto</label>
        <select className="campo" value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
          <option value="">Sem culto marcado</option>
          {opcoesCulto.map((e) => <option key={e.id} value={e.id}>{nomeEvento(e)}</option>)}
        </select>
        <label className="rot">Resumo para os voluntários (opcional)</label>
        <textarea className="campo" rows={4} value={resumo} onChange={(e) => setResumo(e.target.value)} placeholder="A história, o versículo, a dinâmica…" />
        <label className="rot">Materiais a preparar (um por linha)</label>
        <textarea className="campo" rows={3} value={materiais} onChange={(e) => setMateriais(e.target.value)} placeholder={"Cartolinas\nLápis de cor\nBalões"} />
        <label className="rot">Resumo para os pais (opcional)</label>
        <textarea className="campo" rows={3} value={resumoPais} onChange={(e) => setResumoPais(e.target.value)} placeholder="O que aprenderam hoje — aparece no link da família" />
        <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar} onClick={guardar}>
          {aEnviar ? "A publicar…" : licao ? "Guardar" : "Publicar para a base"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
