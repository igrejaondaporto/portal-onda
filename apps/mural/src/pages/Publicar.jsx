import { useEffect, useRef, useState } from "react";
import { criarAnuncio, subirFotosAnuncio, ouvirMeusAnuncios, MAX_ATIVOS } from "../lib/anuncios.js";
import { NATUREZAS, REGIOES, categoriasDe, precoValido } from "../lib/util.js";
import { CIDADES, NOMES_CIDADES } from "../lib/locais.js";

const OUTRA = "__outra__";

export default function Publicar({ onPublicado }) {
  const [meus, setMeus] = useState([]);
  // três toques (2026-09): Produto ou Serviço → Ofereço ou Procuro →
  // a categoria desse quadrado; o resto do formulário só aparece depois
  const [natureza, setNatureza] = useState(null);
  const [tipo, setTipo] = useState(null);
  const [categoria, setCategoria] = useState(null);
  // onde (2026-10): cidade de uma lista (os concelhos onde há GDs) ou
  // "Outra cidade" escrita à mão; a freguesia é opcional. A região
  // antiga deduz-se da cidade — só se pergunta em "Outra cidade".
  const [cidade, setCidade] = useState("");
  const [cidadeOutra, setCidadeOutra] = useState("");
  const [freguesia, setFreguesia] = useState("");
  const [regiaoOutra, setRegiaoOutra] = useState(REGIOES[0].id);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [gratis, setGratis] = useState(false);
  const [ficheiros, setFicheiros] = useState([]);
  // quem atende os interessados (2026-10): eu, ou outra pessoa — "vi
  // uma placa de arrendamento na rua e quero ajudar". O contacto de
  // outra pessoa nunca fica no anúncio público (ver functions/mural.js).
  const [deOutro, setDeOutro] = useState(false);
  const [contactoNome, setContactoNome] = useState("");
  const [contactoTelefone, setContactoTelefone] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const inputFoto = useRef(null);

  useEffect(() => ouvirMeusAnuncios(setMeus), []);
  const ativos = meus.filter((a) => a.ativo).length;
  const noLimite = ativos >= MAX_ATIVOS;

  function trocarNatureza(n) {
    setNatureza(n);
    setCategoria(null);
  }
  function trocarTipo(t) {
    setTipo(t);
    setCategoria(null);
  }

  async function publicar() {
    if (!titulo.trim()) return setErro("Escreve um título.");
    const cidadeFinal = cidade === OUTRA ? cidadeOutra.trim() : cidade;
    if (!cidadeFinal) return setErro("Escolhe a cidade.");
    if (!gratis && !precoValido(preco)) {
      return setErro("No preço escreve só o valor (ex.: 15 € ou 15 €/hora) — o resto vai na descrição.");
    }
    const regiao = cidade === OUTRA ? regiaoOutra : CIDADES[cidade].regiao;
    if (deOutro && contactoTelefone.replace(/\D/g, "").length < 9) return setErro("Escreve o telemóvel de quem trata.");
    setErro("");
    setAEnviar(true);
    try {
      const contactoOutro = deOutro ? { nome: contactoNome.trim(), telefone: contactoTelefone } : undefined;
      const { id } = await criarAnuncio({ natureza, tipo, categoria, titulo, descricao, preco, gratis, regiao, cidade: cidadeFinal, freguesia: freguesia.trim(), contactoOutro });
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

      <span className="rot">1 · É um produto ou um serviço?</span>
      <div className="natureza" role="group" aria-label="Produto ou serviço">
        {NATUREZAS.map((n) => (
          <button key={n.id} type="button" data-natureza={n.id} aria-pressed={natureza === n.id} onClick={() => trocarNatureza(n.id)}>
            <b>{n.id === "produto" ? "Produto" : "Serviço"}</b>
            <small>{n.id === "produto" ? "uma coisa, uma casa" : "trabalho, ajuda, boleia"}</small>
          </button>
        ))}
      </div>

      {natureza && (
        <>
          <span className="rot">2 · Ofereces ou procuras?</span>
          <div className="natureza" role="group" aria-label="Ofereço ou procuro">
            <button type="button" aria-pressed={tipo === "ofereco"} onClick={() => trocarTipo("ofereco")}>
              <b>Ofereço</b>
              <small>{natureza === "produto" ? "vendo, dou, arrendo" : "faço, tenho vaga, dou boleia"}</small>
            </button>
            <button type="button" aria-pressed={tipo === "procuro"} onClick={() => trocarTipo("procuro")}>
              <b>Procuro</b>
              <small>{natureza === "produto" ? "preciso de, quero arrendar" : "preciso de ajuda, de trabalho"}</small>
            </button>
          </div>
        </>
      )}

      {natureza && tipo && (
        <>
          <span className="rot">3 · Qual destes?</span>
          <div className="menu" style={{ padding: "8px 0 4px", position: "static", flexWrap: "wrap" }}>
            {categoriasDe(natureza, tipo).map((c) => (
              <button
                key={c.id} type="button" data-on={categoria === c.id ? 1 : 0}
                onClick={() => { setCategoria(c.id); if (c.id === "boleias") setGratis(true); }}
              >
                {c.nome}
              </button>
            ))}
          </div>
        </>
      )}

      {categoria && (
      <>
      <p className="dicaFoto">📷 Anúncios <b>com foto</b> aparecem primeiro no mural — junta uma no fim.</p>
      <label className="rot" htmlFor="titulo">Título</label>
      <input
        id="titulo" className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80}
        placeholder={natureza === "servico" ? "Ex.: Explicações de Matemática" : "Ex.: Sofá de 3 lugares, cinzento"}
      />

      <label className="rot" htmlFor="cidade">Cidade</label>
      <select id="cidade" className="campo" value={cidade} onChange={(e) => { setCidade(e.target.value); setFreguesia(""); }}>
        <option value="" disabled>Escolhe a cidade</option>
        {NOMES_CIDADES.map((c) => <option key={c} value={c}>{c}</option>)}
        <option value={OUTRA}>Outra cidade…</option>
      </select>
      {cidade === OUTRA && (
        <>
          <input className="campo" style={{ marginTop: 8 }} value={cidadeOutra} onChange={(e) => setCidadeOutra(e.target.value)} maxLength={60} placeholder="Qual cidade?" aria-label="Qual cidade" />
          <label className="rot" htmlFor="regiaoOutra">Região</label>
          <select id="regiaoOutra" className="campo" value={regiaoOutra} onChange={(e) => setRegiaoOutra(e.target.value)}>
            {REGIOES.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </>
      )}
      {cidade && (
        <>
          <label className="rot" htmlFor="freguesia">Freguesia <span style={{ fontWeight: 400 }}>— opcional</span></label>
          {cidade !== OUTRA ? (
            <select id="freguesia" className="campo" value={freguesia} onChange={(e) => setFreguesia(e.target.value)}>
              <option value="">Não interessa / não sei</option>
              {CIDADES[cidade].freguesias.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          ) : (
            <input id="freguesia" className="campo" value={freguesia} onChange={(e) => setFreguesia(e.target.value)} maxLength={80} placeholder="Qual freguesia?" />
          )}
        </>
      )}

      <label className="rot" htmlFor="preco">Preço <span style={{ fontWeight: 400 }}>— só o valor; vazio = a combinar</span></label>
      <input id="preco" className="campo" value={preco} disabled={gratis} onChange={(e) => setPreco(e.target.value)} placeholder={natureza === "servico" ? "Ex.: 15 €/hora ou A combinar" : "Ex.: 120 € ou A combinar"} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: "var(--cinza)" }}>
        <input type="checkbox" checked={gratis} onChange={(e) => setGratis(e.target.checked)} /> É grátis / doação
      </label>

      <label className="rot" htmlFor="descricao">Descrição</label>
      <textarea id="descricao" className="campo" rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={600} placeholder="Estado, onde entregas, o que precisas saber" />

      <span className="rot">Quem atende os interessados?</span>
      <div className="natureza" role="group" aria-label="Quem atende os interessados">
        <button type="button" aria-pressed={!deOutro} onClick={() => setDeOutro(false)}>
          <b>Eu</b>
          <small>falam contigo no WhatsApp</small>
        </button>
        <button type="button" aria-pressed={deOutro} onClick={() => setDeOutro(true)}>
          <b>Outra pessoa</b>
          <small>vi e quero ajudar a divulgar</small>
        </button>
      </div>
      {deOutro && (
        <>
          <label className="rot" htmlFor="contactoNome">Nome de quem trata <span style={{ fontWeight: 400 }}>— opcional</span></label>
          <input id="contactoNome" className="campo" value={contactoNome} onChange={(e) => setContactoNome(e.target.value)} maxLength={60} placeholder="Ex.: Sr. Manuel (senhorio)" />
          <label className="rot" htmlFor="contactoTelefone">Telemóvel de quem trata</label>
          <input id="contactoTelefone" className="campo" type="tel" inputMode="tel" value={contactoTelefone} onChange={(e) => setContactoTelefone(e.target.value)} placeholder="912 345 678" />
          <p className="ds" style={{ marginTop: 6 }}>
            Não aparece no anúncio — só a quem tocar em "Falar com quem trata". Sai do sistema assim que o anúncio sair do ar.
          </p>
        </>
      )}

      <div className="caixa caixaFoto">
        <h4 style={{ fontSize: 15, fontWeight: 700 }}>Fotografias</h4>
        <p className="ds">
          <b style={{ color: "var(--azul)" }}>Anúncios com foto aparecem primeiro no mural</b> e recebem mais
          contactos. Até 4 — comprimimos antes de enviar, não gasta os teus dados.
        </p>
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
      </>
      )}
      <p className="nota">
        Depois de publicares, o anúncio fica no mural por 30 dias — perguntamos-te se ainda está de pé
        antes de sair sozinho.
      </p>
    </>
  );
}
