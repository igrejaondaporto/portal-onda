import { useEffect, useRef, useState } from "react";
import { criarAnuncio, subirFotosAnuncio, ouvirMeusAnuncios, obterMeuTelefone, MAX_ATIVOS } from "../lib/anuncios.js";
import { NATUREZAS, REGIOES, categoriasDe, precoValido } from "../lib/util.js";
import { CIDADES, NOMES_CIDADES } from "../lib/locais.js";
import EscolherPessoaEmNome, { SEM_REGISTO } from "../components/EscolherPessoaEmNome.jsx";

const OUTRA = "__outra__";
const formatarTelefone = (t) => String(t).replace(/\D/g, "").replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");

export default function Publicar({ onPublicado, souAdmin = false }) {
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
  // moderação (2026-10): publicar EM NOME de alguém que pôs o anúncio no
  // grupo do WhatsApp e não no Mural. Escolhe-se a pessoa numa lista (base
  // → nome, ou Membros) e o anúncio fica no perfil dela; quem não está
  // registado vai por nome + telemóvel. Conta para os 5 DESSA pessoa (ver
  // criarAnuncio em functions/mural.js e EscolherPessoaEmNome.jsx).
  const [emNome, setEmNome] = useState(false);
  const [emNomeOnde, setEmNomeOnde] = useState("");
  const [emNomePessoa, setEmNomePessoa] = useState(null);
  const [emNomeNome, setEmNomeNome] = useState("");
  const [emNomeTelefone, setEmNomeTelefone] = useState("");
  const [contactoNome, setContactoNome] = useState("");
  const [contactoTelefone, setContactoTelefone] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");
  const inputFoto = useRef(null);

  useEffect(() => ouvirMeusAnuncios(setMeus), []);
  // o número com que a pessoa se registou é o WhatsApp dos anúncios dela
  // (2026-10) — mostra-se no "Eu", para não haver dúvida de qual é
  const [meuTelefone, setMeuTelefone] = useState(null);
  useEffect(() => { obterMeuTelefone().then(setMeuTelefone); }, []);
  // os anúncios em nome de quem ainda não se registou (emNomeDe) são
  // dessa pessoa, não contam para os teus 5
  const ativos = meus.filter((a) => a.ativo && !a.emNomeDe).length;
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
    const semRegisto = emNome && emNomeOnde === SEM_REGISTO;
    if (emNome && !semRegisto && !emNomePessoa) return setErro("Escolhe a pessoa em nome de quem publicas.");
    if (semRegisto && !emNomeNome.trim()) return setErro("Escreve o nome da pessoa.");
    if (semRegisto && emNomeTelefone.replace(/\D/g, "").length < 9) return setErro("Escreve o telemóvel da pessoa.");
    if (!emNome && deOutro && contactoTelefone.replace(/\D/g, "").length < 9) return setErro("Escreve o telemóvel de quem trata.");
    setErro("");
    setAEnviar(true);
    try {
      const contactoOutro = !emNome && deOutro ? { nome: contactoNome.trim(), telefone: contactoTelefone } : undefined;
      const emNomeDe = !emNome ? undefined
        : semRegisto ? { nome: emNomeNome.trim(), telefone: emNomeTelefone }
        : { pessoaId: emNomePessoa.id };
      const { id } = await criarAnuncio({ natureza, tipo, categoria, titulo, descricao, preco, gratis, regiao, cidade: cidadeFinal, freguesia: freguesia.trim(), contactoOutro, emNomeDe });
      if (ficheiros.length) await subirFotosAnuncio(id, ficheiros);
      // em nome de alguém registado, o anúncio fica nos "Os meus" DELA —
      // volta-se ao mural, onde já aparece
      onPublicado?.({ paraOutra: emNome && !semRegisto });
    } catch (e) {
      setErro(e.message !== "limite" ? "Não foi possível publicar. Tenta outra vez."
        : emNome ? `Essa pessoa já tem ${MAX_ATIVOS} anúncios no ar — tem de tirar um antes deste.`
        : `Já tens ${MAX_ATIVOS} anúncios no ar — marca um como vendido para abrir espaço.`);
    }
    setAEnviar(false);
  }

  return (
    <>
      {souAdmin && (
        <div className={`caixa emNome${emNome ? " on" : ""}`}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 14.5 }}>
            <input type="checkbox" checked={emNome} onChange={(e) => setEmNome(e.target.checked)} />
            Publicar em nome de outra pessoa
          </label>
          <p className="ds" style={{ marginTop: 4 }}>
            Só a moderação vê isto. Para quem pôs o anúncio no grupo do WhatsApp e não no Mural. Conta para
            os {MAX_ATIVOS} anúncios dessa pessoa, não para os teus.
          </p>
          {emNome && (
            <EscolherPessoaEmNome
              onde={emNomeOnde} setOnde={setEmNomeOnde}
              pessoa={emNomePessoa} setPessoa={setEmNomePessoa}
              nome={emNomeNome} setNome={setEmNomeNome}
              telefone={emNomeTelefone} setTelefone={setEmNomeTelefone}
            />
          )}
        </div>
      )}

      {!emNome && <div className="limite">
        <b>{ativos} de {MAX_ATIVOS} no ar</b>
        <span className="trilho"><i style={{ width: `${Math.min(100, (ativos / MAX_ATIVOS) * 100)}%` }} /></span>
        <span className="ds" style={{ flex: "none" }}>{noLimite ? "no limite" : `restam ${MAX_ATIVOS - ativos}`}</span>
      </div>}

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

      {!emNome && (<>
      <span className="rot">Quem atende os interessados?</span>
      <div className="natureza" role="group" aria-label="Quem atende os interessados">
        <button type="button" aria-pressed={!deOutro} onClick={() => setDeOutro(false)}>
          <b>Eu</b>
          <small>{meuTelefone ? `no teu WhatsApp ${formatarTelefone(meuTelefone)}` : "falam contigo no WhatsApp"}</small>
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
      </>)}

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
      <button className="btn full" disabled={aEnviar || (noLimite && !emNome)} onClick={publicar}>
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
