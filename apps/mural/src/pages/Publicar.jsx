import { useEffect, useRef, useState } from "react";
import { criarAnuncio, subirFotosAnuncio, ouvirMeusAnuncios, MAX_ATIVOS } from "../lib/anuncios.js";
import { CATEGORIAS, REGIOES } from "../lib/util.js";

export default function Publicar({ onPublicado }) {
  const [meus, setMeus] = useState([]);
  const [tipo, setTipo] = useState("ofereco");
  const [categoria, setCategoria] = useState(CATEGORIAS.ofereco[0].id);
  const [regiao, setRegiao] = useState(REGIOES[0].id);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [gratis, setGratis] = useState(false);
  const [ficheiros, setFicheiros] = useState([]);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const inputFoto = useRef(null);

  useEffect(() => ouvirMeusAnuncios(setMeus), []);
  const ativos = meus.filter((a) => a.ativo).length;
  const noLimite = ativos >= MAX_ATIVOS;

  function trocarTipo(t) {
    setTipo(t);
    setCategoria(CATEGORIAS[t][0].id);
  }

  async function publicar() {
    if (!titulo.trim()) return setErro("Escreve um título.");
    setErro("");
    setAEnviar(true);
    try {
      const { id } = await criarAnuncio({ tipo, categoria, titulo, descricao, preco, gratis, regiao });
      if (ficheiros.length) await subirFotosAnuncio(id, ficheiros);
      onPublicado?.();
    } catch (e) {
      setErro(e.message === "limite" ? `Já tens ${MAX_ATIVOS} anúncios no ar — marca um como vendido para abrir espaço.` : "Não foi possível publicar. Tenta outra vez.");
    }
    setAEnviar(false);
  }

  return (
    <>
      <div className="limite">
        <b>{ativos} de {MAX_ATIVOS} no ar</b>
        <span className="trilho"><i style={{ width: `${Math.min(100, (ativos / MAX_ATIVOS) * 100)}%` }} /></span>
        <span className="ds" style={{ flex: "none" }}>{noLimite ? "no limite" : `restam ${MAX_ATIVOS - ativos}`}</span>
      </div>

      <label className="rot">O que é?</label>
      <div className="dupla" style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button className={`btn${tipo === "ofereco" ? "" : " sec"}`} style={{ flex: 1 }} onClick={() => trocarTipo("ofereco")}>Ofereço</button>
        <button className={`btn${tipo === "procuro" ? "" : " sec"}`} style={{ flex: 1 }} onClick={() => trocarTipo("procuro")}>Procuro</button>
      </div>

      <label className="rot" htmlFor="titulo">Título</label>
      <input id="titulo" className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Sofá de 3 lugares, cinzento" maxLength={80} />

      <label className="rot" htmlFor="categoria">Categoria</label>
      <select id="categoria" className="campo" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
        {CATEGORIAS[tipo].map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>

      <label className="rot" htmlFor="regiao">Região</label>
      <select id="regiao" className="campo" value={regiao} onChange={(e) => setRegiao(e.target.value)}>
        {REGIOES.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
      </select>

      <label className="rot" htmlFor="preco">Preço <span style={{ fontWeight: 400 }}>— deixa vazio se é doação</span></label>
      <input id="preco" className="campo" value={preco} disabled={gratis} onChange={(e) => setPreco(e.target.value)} placeholder="Ex.: 120 € ou A combinar" />
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: "var(--cinza)" }}>
        <input type="checkbox" checked={gratis} onChange={(e) => setGratis(e.target.checked)} /> É grátis / doação
      </label>

      <label className="rot" htmlFor="descricao">Descrição</label>
      <textarea id="descricao" className="campo" rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={600} placeholder="Estado, onde entregas, o que precisas saber" />

      <div className="caixa">
        <h4 style={{ fontSize: 15, fontWeight: 700 }}>Fotografias</h4>
        <p className="ds">Até 4. Comprimimos antes de enviar — não gasta os teus dados.</p>
        <input ref={inputFoto} type="file" accept="image/*" multiple hidden
          onChange={(e) => setFicheiros(Array.from(e.target.files || []).slice(0, 4))} />
        <button className="btn sec" style={{ marginTop: 10 }} onClick={() => inputFoto.current?.click()}>
          {ficheiros.length ? `${ficheiros.length} foto(s) escolhida(s)` : "Escolher fotos"}
        </button>
      </div>

      {erro && <p className="aviso">{erro}</p>}
      <button className="btn full" disabled={aEnviar || noLimite} onClick={publicar}>
        {aEnviar ? "A publicar…" : "Publicar anúncio"}
      </button>
      <p className="nota">
        Depois de publicares, o anúncio fica no mural por 30 dias — perguntamos-te se ainda está de pé
        antes de sair sozinho.
      </p>
    </>
  );
}
