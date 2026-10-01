import { useEffect, useRef, useState } from "react";
import { criarAnuncio, subirFotosAnuncio, ouvirMeusAnuncios, obterMeuTelefone, MAX_ATIVOS } from "../lib/anuncios.js";
import { NATUREZAS, categoriasDe, precoValido } from "../lib/util.js";
import { useLocais } from "../lib/locais.js";
import EscolherLugar, { lugarFinal } from "../components/EscolherLugar.jsx";
import EscolherPessoaEmNome, { SEM_REGISTO } from "../components/EscolherPessoaEmNome.jsx";
import OrdenarFotos from "../components/OrdenarFotos.jsx";

const formatarTelefone = (t) => String(t).replace(/\D/g, "").replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");

export default function Publicar({ onPublicado, souAdmin = false }) {
  const [meus, setMeus] = useState([]);
  // três toques (2026-09): Produto ou Serviço → Ofereço ou Procuro →
  // a categoria desse quadrado; o resto do formulário só aparece depois
  const [natureza, setNatureza] = useState(null);
  const [tipo, setTipo] = useState(null);
  const [categoria, setCategoria] = useState(null);
  // onde (2026-10): Distrito → Cidade → Freguesia, Portugal inteiro
  // (EscolherLugar, lib/locais.js); "Fora de Portugal" com a cidade à mão.
  const [lugar, setLugar] = useState({ distrito: "", cidade: "", freguesia: "", regiao: "norte" });
  const locais = useLocais();
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
    const onde = lugarFinal(lugar, locais);
    if (!onde) return setErro("Escolhe o distrito e a cidade.");
    if (!gratis && !precoValido(preco)) {
      return setErro("No preço escreve só o valor (ex.: 15 € ou 15 €/hora) — o resto vai na descrição.");
    }
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
      const { id } = await criarAnuncio({ natureza, tipo, categoria, titulo, descricao, preco, gratis, ...onde, contactoOutro, emNomeDe });
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

      <EscolherLugar lugar={lugar} setLugar={setLugar} />

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
          onChange={(e) => { const novos = Array.from(e.target.files || []); e.target.value = ""; setFicheiros((l) => [...l, ...novos].slice(0, 4)); }} />
        {ficheiros.length ? (
          <>
            <OrdenarFotos lista={ficheiros} setLista={setFicheiros} onJuntar={() => inputFoto.current?.click()} />
            {ficheiros.length > 1 && <p className="ds" style={{ marginTop: 8 }}>A primeira é a capa. Usa ‹ › para mudar a ordem.</p>}
          </>
        ) : (
          <button className="btn sec" style={{ marginTop: 10 }} onClick={() => inputFoto.current?.click()}>Escolher fotos</button>
        )}
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
