import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useTorrada } from "../lib/TorradaContext.jsx";
import { CANAIS_CHAMADAS, PADRAO_FREESHOW, INTERVALO_SONDA_MS } from "../lib/chamadas.js";

/**
 * O painel de chamadas em si — seletor de canal, simulação do telão,
 * campo + Chamar/Limpar, histórico da sessão. Genuinamente igual em
 * qualquer app que o use (Técnica, que vê todos os canais; o
 * kinder.igrejaonda.pt standalone, que tranca cada estação num canal
 * só) — por isso vive aqui, não copiado.
 *
 * `canaisPermitidos`: array de ids de CANAIS_CHAMADAS a mostrar — não
 * passar (ou passar undefined) mostra todos. `definirCabecalho` é
 * opcional — só as apps com a casca de cabeçalho do Portal (crista +
 * definirCabecalho) o passam; o kinder standalone não tem essa casca.
 */
export default function PainelChamadas({ canaisPermitidos, definirCabecalho }) {
  const torrada = useTorrada();
  const canais = canaisPermitidos?.length
    ? CANAIS_CHAMADAS.filter((c) => canaisPermitidos.includes(c.id))
    : CANAIS_CHAMADAS;

  const [canal, setCanal] = useState(canais[0]);
  const [valor, setValor] = useState("");
  const [historico, setHistorico] = useState([]);
  const [ligado, setLigado] = useState(false);
  const [noAr, setNoAr] = useState(null); // { canal, texto } — o que está mesmo no ar agora
  const [mostrarLigacao, setMostrarLigacao] = useState(false);
  const [host, setHost] = useState(PADRAO_FREESHOW);

  const socketRef = useRef(null);
  const sondaRef = useRef(null);
  const valoresRef = useRef({});
  const noArRef = useRef(null);

  useEffect(() => {
    definirCabecalho?.({ titulo: "Chamadas", subtitulo: "Escreve o nome e aparece na projeção", chips: [] });
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
    const achado = CANAIS_CHAMADAS.find((c) => ativos.includes(c.oid));
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
    const socket = io(url || PADRAO_FREESHOW, { transports: ["websocket", "polling"], reconnectionDelay: 1000 });
    socketRef.current = socket;

    socket.on("connect", () => {
      setLigado(true);
      setMostrarLigacao(false);
      torrada("Ligado à projeção.");
      perguntar();
      sondaRef.current = setInterval(perguntar, INTERVALO_SONDA_MS);
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
    conectar(PADRAO_FREESHOW);
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
    <div>
      {canais.length > 1 && (
        <div className="menu" style={{ position: "static", border: 0, padding: "0 0 4px", background: "none", backdropFilter: "none" }}>
          {canais.map((c) => (
            <button key={c.id} data-on={canal.id === c.id ? 1 : 0} onClick={() => trocar(c)}>{c.rotulo}</button>
          ))}
        </div>
      )}

      <div className={`ecra${noAr ? " live" : ""}`}>
        <div className="marca"><i>igreja</i><b>onda</b></div>
        {noAr && <div className="faixa">{noAr.texto}</div>}
        <div className="estado">
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
        <span className={`luz${ligado ? "" : " off"}`} />
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
