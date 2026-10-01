import { useRef, useState } from "react";
import { definirFotosAnuncio, editarAnuncio, subirFotosNovas } from "../lib/anuncios.js";
import { REGIOES, categoriasDe, naturezaDe, precoValido } from "../lib/util.js";
import { CIDADES, NOMES_CIDADES } from "../lib/locais.js";
import OrdenarFotos from "./OrdenarFotos.jsx";

const OUTRA = "__outra__";

/**
 * Editar um anúncio já publicado (2026-10, pedido: "poder editar um
 * anúncio criado"). Abre em "Os meus" (✎ Editar). Mesma folha (.veu +
 * .pin) do resto do Mural.
 *
 * O que se pode mudar: título, categoria (dentro do mesmo lado — Ofereço
 * ou Procuro não muda, é outro anúncio), preço/grátis, cidade/freguesia,
 * descrição e fotos (tirar as que lá estão, juntar novas até 4). Tudo
 * pelo `editarAnuncio` de sempre (functions/mural.js); as fotos pelo
 * `definirFotosAnuncio`, só se mudaram (também a ordem — a primeira é a capa).
 */
export default function SheetEditarAnuncio({ anuncio, onFechar }) {
  const natureza = naturezaDe(anuncio);
  const cidadeConhecida = anuncio.cidade && CIDADES[anuncio.cidade];
  const [titulo, setTitulo] = useState(anuncio.titulo || "");
  const [categoria, setCategoria] = useState(anuncio.categoria);
  const [preco, setPreco] = useState(anuncio.preco || "");
  const [gratis, setGratis] = useState(!!anuncio.gratis);
  const [descricao, setDescricao] = useState(anuncio.descricao || "");
  const [cidade, setCidade] = useState(anuncio.cidade ? (cidadeConhecida ? anuncio.cidade : OUTRA) : "");
  const [cidadeOutra, setCidadeOutra] = useState(cidadeConhecida ? "" : anuncio.cidade || "");
  const [freguesia, setFreguesia] = useState(anuncio.freguesia || "");
  const [regiaoOutra, setRegiaoOutra] = useState(anuncio.regiao || REGIOES[0].id);
  // URLs das fotos que já lá estão + File das novas, pela ordem escolhida
  const [fotos, setFotos] = useState(anuncio.fotos || []);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState("");
  const inputFoto = useRef(null);

  async function guardar() {
    if (!titulo.trim()) return setErro("Escreve um título.");
    if (!gratis && !precoValido(preco)) return setErro("No preço escreve só o valor (ex.: 15 € ou 15 €/hora).");
    const cidadeFinal = cidade === OUTRA ? cidadeOutra.trim() : cidade;
    setErro("");
    setAGuardar(true);
    try {
      const lugar = cidadeFinal
        ? { cidade: cidadeFinal, freguesia: freguesia.trim(), regiao: cidade === OUTRA ? regiaoOutra : CIDADES[cidade].regiao }
        : {};
      await editarAnuncio({
        id: anuncio.id, titulo, descricao, preco, gratis, categoria, natureza, ...lugar,
      });
      const antes = anuncio.fotos || [];
      const mudouFotos = fotos.length !== antes.length || fotos.some((f, i) => f !== antes[i]);
      if (mudouFotos) {
        // sobem só as novas; depois cada File dá lugar ao seu URL, na mesma posição
        const subidas = await subirFotosNovas(anuncio.id, fotos.filter((f) => typeof f !== "string"));
        let k = 0;
        await definirFotosAnuncio(anuncio.id, fotos.map((f) => (typeof f === "string" ? f : subidas[k++])));
      }
      onFechar();
    } catch {
      setErro("Não foi possível guardar. Tenta outra vez.");
    }
    setAGuardar(false);
  }

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on editarAnuncio" role="dialog" aria-modal="true" aria-label="Editar anúncio">
        <div className="pux" />
        <h2 style={{ textAlign: "left" }}>Editar anúncio</h2>

        <label className="rot" htmlFor="ed-titulo">Título</label>
        <input id="ed-titulo" className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} />

        <span className="rot">Categoria</span>
        <div className="menu quebra" style={{ padding: "8px 0 4px", position: "static" }}>
          {categoriasDe(natureza, anuncio.tipo).map((c) => (
            <button key={c.id} type="button" data-on={categoria === c.id ? 1 : 0} onClick={() => setCategoria(c.id)}>{c.nome}</button>
          ))}
        </div>

        <label className="rot" htmlFor="ed-preco">Preço <span style={{ fontWeight: 400 }}>— só o valor; vazio = a combinar</span></label>
        <input id="ed-preco" className="campo" value={preco} disabled={gratis} onChange={(e) => setPreco(e.target.value)} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: "var(--cinza)" }}>
          <input type="checkbox" checked={gratis} onChange={(e) => setGratis(e.target.checked)} /> É grátis / doação
        </label>

        <label className="rot" htmlFor="ed-cidade">Cidade</label>
        <select id="ed-cidade" className="campo" value={cidade} onChange={(e) => { setCidade(e.target.value); setFreguesia(""); }}>
          <option value="">— sem cidade —</option>
          {NOMES_CIDADES.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value={OUTRA}>Outra cidade…</option>
        </select>
        {cidade === OUTRA && (
          <>
            <input className="campo" style={{ marginTop: 8 }} value={cidadeOutra} onChange={(e) => setCidadeOutra(e.target.value)} maxLength={60} placeholder="Qual cidade?" aria-label="Qual cidade" />
            <select className="campo" style={{ marginTop: 8 }} value={regiaoOutra} onChange={(e) => setRegiaoOutra(e.target.value)} aria-label="Região">
              {REGIOES.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
          </>
        )}
        {cidade && (
          cidade !== OUTRA ? (
            <select className="campo" style={{ marginTop: 8 }} value={freguesia} onChange={(e) => setFreguesia(e.target.value)} aria-label="Freguesia">
              <option value="">Freguesia — não interessa</option>
              {CIDADES[cidade].freguesias.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          ) : (
            <input className="campo" style={{ marginTop: 8 }} value={freguesia} onChange={(e) => setFreguesia(e.target.value)} maxLength={80} placeholder="Freguesia (opcional)" aria-label="Freguesia" />
          )
        )}

        <label className="rot" htmlFor="ed-descricao">Descrição</label>
        <textarea id="ed-descricao" className="campo" rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={600} />

        <span className="rot">Fotografias</span>
        <OrdenarFotos lista={fotos} setLista={setFotos} onJuntar={() => inputFoto.current?.click()} />
        {fotos.length > 1 && <p className="ds" style={{ marginTop: 8 }}>A primeira é a capa. Usa ‹ › para mudar a ordem.</p>}
        <input
          ref={inputFoto} type="file" accept="image/*" multiple hidden
          onChange={(e) => { const novos = Array.from(e.target.files || []); e.target.value = ""; setFotos((l) => [...l, ...novos].slice(0, 4)); }}
        />

        {erro && <p className="aviso">{erro}</p>}
        <button className="btn full" style={{ marginTop: 18 }} disabled={aGuardar} onClick={guardar}>
          {aGuardar ? "A guardar…" : "Guardar alterações"}
        </button>
        <button className="sair" style={{ width: "100%", textAlign: "center" }} onClick={onFechar}>Cancelar</button>
      </div>
    </>
  );
}
