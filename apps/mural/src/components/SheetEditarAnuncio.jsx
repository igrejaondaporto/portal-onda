import { useRef, useState } from "react";
import { definirFotosAnuncio, editarAnuncio, subirFotosNovas } from "../lib/anuncios.js";
import { REGIOES, categoriasDe, naturezaDe, precoValido } from "../lib/util.js";
import { CIDADES, NOMES_CIDADES } from "../lib/locais.js";

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
 * `definirFotosAnuncio`, só se mudaram.
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
  const [fotos, setFotos] = useState(anuncio.fotos || []);
  const [novas, setNovas] = useState([]);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState("");
  const inputFoto = useRef(null);

  const lugarFotos = Math.max(0, 4 - fotos.length - novas.length);

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
      const mudouFotos = novas.length > 0 || fotos.length !== (anuncio.fotos || []).length;
      if (mudouFotos) {
        const subidas = novas.length ? await subirFotosNovas(anuncio.id, novas) : [];
        await definirFotosAnuncio(anuncio.id, [...fotos, ...subidas]);
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
        <div className="edFotos">
          {fotos.map((f) => (
            <span key={f} className="edFoto" style={{ backgroundImage: `url(${f})` }}>
              <button type="button" aria-label="Tirar esta foto" onClick={() => setFotos((l) => l.filter((x) => x !== f))}>×</button>
            </span>
          ))}
          {novas.map((f, i) => (
            <span key={`n${i}`} className="edFoto nova">
              <small>nova</small>
              <button type="button" aria-label="Tirar esta foto" onClick={() => setNovas((l) => l.filter((_, j) => j !== i))}>×</button>
            </span>
          ))}
          {lugarFotos > 0 && (
            <button type="button" className="edFoto juntar" onClick={() => inputFoto.current?.click()}>+ foto</button>
          )}
        </div>
        <input
          ref={inputFoto} type="file" accept="image/*" multiple hidden
          onChange={(e) => { setNovas((l) => [...l, ...Array.from(e.target.files || [])].slice(0, 4 - fotos.length)); e.target.value = ""; }}
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
