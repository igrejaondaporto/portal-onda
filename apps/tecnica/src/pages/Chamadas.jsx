import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useTorrada } from "@portal/shared/lib/TorradaContext.jsx";

/* Portado do Kinder (kinder.painelonda.pt, fora deste monorepo) — a
 * mesma ligação direta do browser ao FreeShow da igreja (fs.painelonda.pt),
 * sem passar pelas Cloud Functions: aqui não é leitura para o Firestore
 * (ver functions/freeshow.js), é escrita imediata no FreeShow
 * (change_variable + overlay), por isso tem de ser ao vivo do cliente.
 * Os oid de cada overlay são os do projeto real da igreja — não mudar
 * sem confirmar com quem mexe no FreeShow lá. */
const CANAIS = [
  { id: "baby", oid: "c7ec7b48c05", rotulo: "Baby", overlay: "BABY", variavel: "baby", prefixo: "BABY: ", campo: "Nome da criança", exemplo: "Eloa", maiusculas: false, cor: "var(--violeta)" },
  { id: "fun", oid: "8dfa868047d", rotulo: "Fun", overlay: "Z_FUN", variavel: "fun", prefixo: "FUN: ", campo: "Nome da criança", exemplo: "Débora", maiusculas: false, cor: "var(--ciano)" },
  { id: "junior", oid: "b239c603705", rotulo: "Júnior", overlay: "Z_JUNIOR", variavel: "junior", prefixo: "JÚNIOR: ", campo: "Nome da criança", exemplo: "Arthur", maiusculas: false, cor: "var(--verde)" },
  { id: "carro", oid: "bc2dfa6c39e", rotulo: "Carro", overlay: "Z_CARRO", variavel: "carro", prefixo: "CARRO: ", campo: "Carro e matrícula", exemplo: "VW Taigo AO96GD", maiusculas: true, cor: "var(--laranja)" },
];
const PADRAO = "https://fs.painelonda.pt";
const INTERVALO = 1500; // de quanto em quanto tempo perguntar ao FreeShow

export default function Chamadas({ definirCabecalho }) {
  const torrada = useTorrada();
  const [canal, setCanal] = useState(CANAIS[0]);
  const [valor, setValor] = useState("");
  const [historico, setHistorico] = useState([]);
  const [ligado, setLigado] = useState(false);
  const [noAr, setNoAr] = useState(null); // { canal, texto } — o que está mesmo no ar agora
  const [mostrarLigacao, setMostrarLigacao] = useState(false);
  const [host, setHost] = useState(PADRAO);

  const socketRef = useRef(null);
  const sondaRef = useRef(null);
  const valoresRef = useRef({});
  const noArRef = useRef(null);

  useEffect(() => {
    definirCabecalho({ titulo: "Chamadas", subtitulo: "Escreve o nome e aparece na projeção", chips: [] });
  }, [definirCabecalho]);

  function perguntar() {
    const s = socketRef.current;
    if (!s || !s.connected) return;
    s.emit("data", JSON.stringify({ action: "get_output" }));
    s.emit("data", JSON.stringify({ action: "get_variables" }));
  }

  function pintarEcra(c) {
    noArRef.current = c;
    setNoAr({ canal: c, texto: c.prefixo + (valoresRef.current[c.variavel] || "") });
  }

  function lerVariaveis(lista) {
    if (!Array.isArray(lista)) return;
    lista.forEach((v) => { valoresRef.current[v.name] = v.value ?? v.text ?? ""; });
    if (noArRef.current) pintarEcra(noArRef.current);
  }

  function lerOutput(d) {
    const ativos = (d && d.overlays) || [];
    const achado = CANAIS.find((c) => ativos.includes(c.oid));
    if (achado) {
      if (!noArRef.current || noArRef.current.id !== achado.id) pintarEcra(achado);
    } else if (noArRef.current) {
      noArRef.current = null;
      setNoAr(null);
    }
  }

  function conectar(url) {
    if (socketRef.current) { socketRef.current.close(); socketRef.current = null; }
    clearInterval(sondaRef.current);
    const socket = io(url || PADRAO, { transports: ["websocket", "polling"], reconnectionDelay: 1000 });
    socketRef.current = socket;

    socket.on("connect", () => {
      setLigado(true);
      setMostrarLigacao(false);
      torrada("Ligado à projeção.");
      perguntar();
      sondaRef.current = setInterval(perguntar, INTERVALO);
    });
    socket.on("data", (bruto) => {
      let r;
      try { r = typeof bruto === "string" ? JSON.parse(bruto) : bruto; } catch { return; }
      if (r.action === "get_output") lerOutput(r.data);
      if (r.action === "get_variables") lerVariaveis(r.data);
    });
    socket.on("disconnect", () => { setLigado(false); clearInterval(sondaRef.current); });
    socket.on("connect_error", () => {
      setLigado(false);
      clearInterval(sondaRef.current);
      torrada("Sem ligação à projeção.", true);
    });
  }

  useEffect(() => {
    conectar(PADRAO);
    return () => {
      if (socketRef.current) { socketRef.current.close(); socketRef.current = null; }
      clearInterval(sondaRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enviar(action, data = {}) {
    const s = socketRef.current;
    if (!s || !s.connected) return false;
    s.emit("data", JSON.stringify({ action, ...data }));
    return true;
  }

  function trocar(c) {
    setCanal(c);
    setValor("");
  }

  function chamar(c, valorForcado) {
    const k = c || canal;
    let txt = (valorForcado ?? valor).trim();
    if (!txt) { torrada("Escreve o nome primeiro.", true); return; }
    if (k.maiusculas) txt = txt.toUpperCase();

    if (!enviar("change_variable", { name: k.variavel, key: "value", value: txt })) {
      torrada("Sem ligação à projeção.", true);
      setMostrarLigacao(true);
      return;
    }
    valoresRef.current[k.variavel] = txt;
    enviar("clear_overlays");
    enviar("name_select_overlay", { value: k.overlay });
    setTimeout(perguntar, 300);
    torrada("Na projeção: " + txt);

    setHistorico((h) => [{ c: k, txt }, ...h.filter((item) => !(item.c.id === k.id && item.txt === txt))].slice(0, 10));
    setValor("");
  }

  function limpar() {
    if (!enviar("clear_overlays")) { torrada("Sem ligação à projeção.", true); return; }
    setTimeout(perguntar, 300);
    torrada("Tirado da projeção.");
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="menu" style={{ position: "static", border: 0, padding: "0 0 4px", background: "none", backdropFilter: "none" }}>
        {CANAIS.map((c) => (
          <button key={c.id} data-on={canal.id === c.id ? 1 : 0} onClick={() => trocar(c)}>{c.rotulo}</button>
        ))}
      </div>

      <div className={`tec-ecra${noAr ? " live" : ""}`}>
        <div className="tec-marca"><i>igreja</i><b>onda</b></div>
        {noAr && <div className="tec-faixa">{noAr.texto}</div>}
        <div className="tec-estado">
          <s />
          <span>{noAr ? `No ar — ${noAr.canal.rotulo}` : "Tela limpa"}</span>
        </div>
      </div>

      <label className="rot" htmlFor="valorChamada">{canal.campo}</label>
      <input
        id="valorChamada" className="campo" type="text" autoComplete="off"
        value={valor} placeholder={canal.exemplo}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") chamar(); }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button className="btn full" onClick={() => chamar()}>Chamar</button>
        <button className="btn sec" onClick={limpar}>Limpar</button>
      </div>

      <button
        className="btn sec full" style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
        onClick={() => setMostrarLigacao((v) => !v)}
      >
        <span className={`tec-luz${ligado ? "" : " off"}`} />
        Ligação {ligado ? "ativa" : "inativa"}
      </button>

      {mostrarLigacao && (
        <div className="caixa">
          <span className="cap">Endereço do FreeShow</span>
          <input
            className="campo" type="text" spellCheck="false" value={host}
            onChange={(e) => setHost(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") conectar(host); }}
          />
          <p className="nota">Só mexe aqui se a projeção parar de responder e alguém te passar um endereço novo.</p>
          <button className="btn full" style={{ marginTop: 14 }} onClick={() => conectar(host)}>Ligar</button>
        </div>
      )}

      <div className="sect">
        <div className="cabecalho"><h3>Chamados hoje</h3></div>
        {historico.length === 0 && <p className="vaz">Ainda não chamaste ninguém.</p>}
        {historico.map((item, i) => (
          <button className="linha" key={i} onClick={() => { trocar(item.c); chamar(item.c, item.txt); }}>
            <span className="tag" style={{ background: item.c.cor }}>{item.c.rotulo}</span>
            <span className="nmt">{item.txt}</span>
            <span className="seta">↺</span>
          </button>
        ))}
      </div>
    </div>
  );
}
