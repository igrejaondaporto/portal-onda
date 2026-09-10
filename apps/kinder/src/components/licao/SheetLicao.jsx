import { useEffect, useRef, useState } from "react";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";
import { nomeEvento } from "@portal/shared/lib/data.js";
import { CATEGORIAS, varsCategoria } from "../../lib/modelo";
import { guardarLicao, novoIdLicao } from "../../lib/licoes";
import { obterEventosDoMes } from "../../lib/painel";
import { hojeLocal } from "../../lib/kinder";

/** Nova lição / editar. O essencial é o link da Kiwify e as salas;
 *  o resto (resumo, materiais, resumo para os pais, .docx) é para
 *  quem não tem login na Kiwify conseguir preparar a aula na mesma. */
export default function SheetLicao({ licao, uid, salaInicial, onFechar, onGuardado }) {
  const torrada = useTorrada();
  const idRef = useRef(licao?.id ?? novoIdLicao());
  const inputRef = useRef(null);
  const [titulo, setTitulo] = useState(licao?.titulo ?? "");
  const [kiwifyUrl, setKiwifyUrl] = useState(licao?.kiwifyUrl ?? "");
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
    if (!f.name.toLowerCase().endsWith(".docx")) return torrada("Só ficheiros .docx", true);
    setFicheiro(f);
  }

  async function guardar() {
    if (!titulo.trim()) return torrada("Falta o título.");
    if (!categorias.length) return torrada("Escolhe pelo menos uma sala.");
    if (kiwifyUrl.trim() && !/^https?:\/\//.test(kiwifyUrl.trim())) return torrada("O link tem de começar por https://");
    setAEnviar(true);
    try {
      await guardarLicao(idRef.current, uid, {
        titulo, categorias, kiwifyUrl, resumo, resumoPais, eventoId,
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
        <label className="rot" style={{ marginTop: 14 }}>Link do vídeo na Kiwify</label>
        <input className="campo" type="url" inputMode="url" value={kiwifyUrl} onChange={(e) => setKiwifyUrl(e.target.value)} placeholder="https://members.kiwify.com/…" />
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
        <label className="rot">Resumo para os voluntários</label>
        <textarea className="campo" rows={4} value={resumo} onChange={(e) => setResumo(e.target.value)} placeholder="A história, o versículo, a dinâmica…" />
        <label className="rot">Materiais a preparar (um por linha)</label>
        <textarea className="campo" rows={3} value={materiais} onChange={(e) => setMateriais(e.target.value)} placeholder={"Cartolinas\nLápis de cor\nBalões"} />
        <label className="rot">Resumo para os pais (opcional)</label>
        <textarea className="campo" rows={3} value={resumoPais} onChange={(e) => setResumoPais(e.target.value)} placeholder="O que aprenderam hoje — aparece no link da família" />
        <label className="rot">Documento (opcional, .docx)</label>
        <input ref={inputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: "none" }} onChange={escolherFicheiro} />
        <button className="btn sec full" onClick={() => inputRef.current.click()}>
          {ficheiro ? ficheiro.name : licao?.arquivoNome ? `Trocar ${licao.arquivoNome}` : "Juntar documento"}
        </button>
        <button className="btn full" style={{ marginTop: 16 }} disabled={aEnviar} onClick={guardar}>
          {aEnviar ? "A publicar…" : licao ? "Guardar" : "Publicar para a base"}
        </button>
        <button className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
