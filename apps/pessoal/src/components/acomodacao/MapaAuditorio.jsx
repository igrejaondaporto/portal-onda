import { useCallback, useMemo, useRef } from "react";
import {
  VW, VH, gerarLugares, gerarRotulosFileira, gerarRotulosExtra, gerarNumerosFundo, gerarEscadas, gerarEntradas,
  enquadramentoInicial,
} from "../../lib/geometriaAuditorio";
import { CORES_LUGAR } from "../../lib/modelo";
import { useZoomPan } from "../../hooks/useZoomPan";
import Cadeira from "./Cadeira";

/** Cenário estático (palco, telão, cortinas, chão, escadas) — depende
 *  só da planta, nunca do estado dos lugares. Memoizado à parte de
 *  <Cadeira> para nunca recalcular a cada toque. */
function Cenario({ planta }) {
  const escadas = useMemo(() => gerarEscadas(planta), [planta]);
  const entradas = useMemo(() => gerarEntradas(planta), [planta]);
  const rotulos = useMemo(() => gerarRotulosFileira(planta), [planta]);
  const rotulosExtra = useMemo(() => gerarRotulosExtra(planta), [planta]);
  const numeros = useMemo(() => gerarNumerosFundo(planta), [planta]);

  return (
    <>
      <defs>
        <linearGradient id="chao" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4A3520" /><stop offset=".55" stopColor="#6B4E2C" /><stop offset="1" stopColor="#553D23" />
        </linearGradient>
        <linearGradient id="madeira" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C79A5E" /><stop offset="1" stopColor="#7E5A2E" />
        </linearGradient>
        <linearGradient id="degrau" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6E512F" /><stop offset="1" stopColor="#4E3921" />
        </linearGradient>
        <linearGradient id="palcoG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#23242C" /><stop offset=".6" stopColor="#141519" /><stop offset="1" stopColor="#0C0D10" />
        </linearGradient>
        <linearGradient id="cortina" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6E1420" /><stop offset=".5" stopColor="#8E1D2C" /><stop offset="1" stopColor="#5C1019" />
        </linearGradient>
        <radialGradient id="vinh" cx=".5" cy=".55" r=".75">
          <stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#03051C" stopOpacity=".85" />
        </radialGradient>
        <radialGradient id="luz" cx=".5" cy=".12" r=".7">
          <stop offset="0" stopColor="#fff" stopOpacity=".16" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <path d="M0,220 L250,600 L250,2310 L0,2310 Z" fill="#E9EAE4" opacity=".13" />
      <path d="M1140,220 L890,600 L890,2310 L1140,2310 Z" fill="#E9EAE4" opacity=".13" />
      <path d="M244,606 L896,606 L1108,2262 L32,2262 Z" fill="url(#chao)" />

      <path d="M232,262 L304,290 L296,596 L222,562 Z" fill="url(#cortina)" opacity=".9" />
      <path d="M908,262 L836,290 L844,596 L918,562 Z" fill="url(#cortina)" opacity=".9" />

      <path d="M300,286 L840,286 L872,566 L268,566 Z" fill="url(#palcoG)" />
      <path d="M268,566 L872,566 L878,610 L262,610 Z" fill="#06060A" />
      <rect x="366" y="316" width="408" height="164" rx="5" fill="#F4F6FA" />
      <rect x="366" y="316" width="408" height="164" rx="5" fill="none" stroke="#0B0C14" strokeWidth="6" />
      <text x="570" y="416" textAnchor="middle" fontFamily="Outfit" fontSize="36" fontWeight="800" fill="#666E86" letterSpacing="10">TELÃO</text>
      <text x="570" y="540" textAnchor="middle" fontFamily="Outfit" fontSize="26" fontWeight="800" fill="#8A92AC" letterSpacing="14" opacity=".75">PALCO</text>

      {escadas.map((d, i) => (
        <g key={i}>
          <path d={d.pontos} fill="url(#degrau)" stroke="rgba(0,0,0,.22)" strokeWidth="1.4" />
        </g>
      ))}

      <path d="M264,694 L58,2140" stroke="#C8CDD8" strokeWidth="7" strokeLinecap="round" opacity=".4" />
      <path d="M876,694 L1082,2140" stroke="#C8CDD8" strokeWidth="7" strokeLinecap="round" opacity=".4" />

      {rotulos.map((r) => (
        <g key={r.fileira}>
          <circle cx={r.xEsq} cy={r.y} r="19" fill="rgba(8,10,40,.78)" />
          <text x={r.xEsq} y={r.y + 5} textAnchor="middle" fontFamily="Outfit" fontSize="22" fontWeight="800" fill="#FFE9B8" opacity=".95">{r.fileira}</text>
          <circle cx={r.xDir} cy={r.y} r="19" fill="rgba(8,10,40,.78)" />
          <text x={r.xDir} y={r.y + 5} textAnchor="middle" fontFamily="Outfit" fontSize="22" fontWeight="800" fill="#FFE9B8" opacity=".95">{r.fileira}</text>
        </g>
      ))}
      {numeros.map((n) => (
        <text key={n.numero} x={n.x} y={n.y} textAnchor="middle" fontFamily="Outfit" fontSize="26" fontWeight="700" fill="#FFF3D4" opacity=".62">{n.numero}</text>
      ))}
      {rotulosExtra.map((r, i) => (
        <g key={`${r.fileira}-${i}`}>
          <circle cx={r.x} cy={r.y} r="19" fill="rgba(8,10,40,.78)" />
          <text x={r.x} y={r.y + 5} textAnchor="middle" fontFamily="Outfit" fontSize="22" fontWeight="800" fill="#FFE9B8" opacity=".95">{r.fileira}</text>
        </g>
      ))}
      {entradas.map((e, i) => (
        <g key={i} transform={`translate(${e.x.toFixed(1)} ${e.y.toFixed(1)}) rotate(${e.angulo.toFixed(1)})`}>
          <rect x="-102" y="-21" width="204" height="42" rx="12" fill="rgba(8,10,40,.72)" stroke="rgba(255,255,255,.22)" strokeWidth="2" />
          <text x="0" y="7" textAnchor="middle" fontFamily="Outfit" fontSize="23" fontWeight="800" fill="#FFE9B8" opacity=".95" letterSpacing="4">ENTRADA</text>
        </g>
      ))}

      <rect x="0" y="0" width={VW} height={VH} fill="url(#luz)" pointerEvents="none" />
      <rect x="0" y="0" width={VW} height={VH} fill="url(#vinh)" pointerEvents="none" />
    </>
  );
}

export default function MapaAuditorio({ planta, lugaresEstado, corInvertida, selecao, onTocar, dicaTexto, dicaAlerta }) {
  const wrapRef = useRef(null);
  const enquadramento = useMemo(() => enquadramentoInicial(planta), [planta]);
  const { transform, moveuRef, zoomPara, verTudo } = useZoomPan(wrapRef, VW, VH, enquadramento);
  const lugares = useMemo(() => gerarLugares(planta), [planta]);
  const cores = useMemo(
    () => (corInvertida ? { ...CORES_LUGAR, livre: CORES_LUGAR.ocupado, ocupado: CORES_LUGAR.livre } : CORES_LUGAR),
    [corInvertida],
  );

  const gestoRef = useRef({ ultimoToqueId: null, timeoutClique: null, timeoutLongo: null, suprimirClique: false });

  // <Cadeira> é React.memo por (id,estado,selecionado,cores,x,y) de
  // propósito — para um toque só recalcular o lugar tocado, não os
  // 144. Só que isso também significa que, sempre que um lugar não
  // muda de estado, o React REAPROVEITA os handlers de clique da
  // vez anterior — incluindo `onTocar`/`selecao`/`lugares` antigos,
  // de closures já ultrapassadas (ex.: o modo "Reservar" acabado de
  // ligar nunca chegava a um lugar que não tinha mudado de cor desde
  // o mount). A correção: os handlers passados ao <Cadeira> nunca
  // mudam de identidade (useCallback com deps fixas) — o memo deixa
  // de ter qualquer prop "diferente" para reagir — e lêem o que
  // precisam sempre por uma ref atualizada a cada render, nunca por
  // fecho direto sobre as props.
  const aoVivoRef = useRef({ onTocar, selecao });
  aoVivoRef.current.onTocar = onTocar;
  aoVivoRef.current.selecao = selecao;

  const tratar = useCallback((id) => {
    const g = gestoRef.current;
    if (g.ultimoToqueId === id) {
      clearTimeout(g.timeoutClique);
      g.ultimoToqueId = null;
      aoVivoRef.current.onTocar(id, "duplo");
      return;
    }
    g.ultimoToqueId = id;
    g.timeoutClique = setTimeout(() => {
      g.ultimoToqueId = null;
      aoVivoRef.current.onTocar(id, "simples");
    }, 250);
  }, []);

  const aoClicarLugar = useCallback((id) => {
    const g = gestoRef.current;
    // O toque longo já tratou disto — o click que o dedo/rato geram a
    // seguir ao soltar não pode voltar a alternar o lugar.
    if (g.suprimirClique) { g.suprimirClique = false; return; }
    if (moveuRef.current > 8 || aoVivoRef.current.selecao.length) return;
    tratar(id);
  }, [moveuRef, tratar]);

  const aoContextMenuLugar = useCallback((id, e) => {
    e.preventDefault();
    aoVivoRef.current.onTocar(id, "longo");
  }, []);

  // Um dedo pousado nunca fica perfeitamente parado — o sensor treme
  // uns pixels sozinho. Cancelar o toque longo ao primeiro "pointermove"
  // (como estava) desarmava-o quase sempre a sério, num ecrã tátil: o
  // toque longo só funcionava com rato (botão direito), nunca com
  // dedo. Agora só cancela se o movimento passar de um limiar a sério.
  const aoPointerDownLugar = useCallback((id, e) => {
    const g = gestoRef.current;
    const x0 = e.clientX, y0 = e.clientY;
    g.timeoutLongo = setTimeout(() => {
      g.timeoutLongo = null;
      clearTimeout(g.timeoutClique);
      g.ultimoToqueId = null;
      g.suprimirClique = true;
      aoVivoRef.current.onTocar(id, "longo");
      if (navigator.vibrate) navigator.vibrate(35);
      finalizar();
    }, 550);
    function aoMoverDurante(ev) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 12) finalizar();
    }
    function finalizar() {
      clearTimeout(g.timeoutLongo);
      window.removeEventListener("pointermove", aoMoverDurante);
      window.removeEventListener("pointerup", finalizar);
      window.removeEventListener("pointercancel", finalizar);
    }
    window.addEventListener("pointermove", aoMoverDurante);
    window.addEventListener("pointerup", finalizar);
    window.addEventListener("pointercancel", finalizar);
  }, []);

  return (
    <div className="shell-acomodacao">
      <div ref={wrapRef} className="mapwrap-acomodacao" style={{ touchAction: "none", position: "relative" }}>
        <div className={`dica-acomodacao${dicaAlerta ? " alerta" : ""}`}>{dicaTexto}</div>
        <svg
          width={VW} height={VH}
          style={{
            position: "absolute", top: 0, left: 0, display: "block",
            transformOrigin: "0 0",
            transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.escala})`,
          }}
          role="img" aria-label="Planta do auditório"
        >
          <Cenario planta={planta} />
          {lugares.map((l) => (
            <Cadeira
              key={l.id} id={l.id} x={l.x} y={l.y} sw={l.sw} sh={l.sh}
              estado={lugaresEstado[l.id] ?? "livre"}
              selecionado={selecao.includes(l.id)}
              cores={cores}
              onPointerDownLugar={aoPointerDownLugar}
              onClickLugar={aoClicarLugar}
              onContextMenuLugar={aoContextMenuLugar}
            />
          ))}
        </svg>
      </div>
      <div className="zoomer-acomodacao">
        <button className="zb" aria-label="Afastar" onClick={() => zoomPara(transform.escala / 1.4)}>−</button>
        <span className="zlvl">{Math.round(transform.escala * 100)}%</span>
        <button className="zb" aria-label="Aproximar" onClick={() => zoomPara(transform.escala * 1.4)}>+</button>
        <button className="zb sm" aria-label="Ver tudo" onClick={verTudo}>Tudo</button>
      </div>
    </div>
  );
}
