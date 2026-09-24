import { memo } from "react";
import { CORES_LUGAR } from "../../lib/modelo";

/**
 * Um lugar do mapa. React.memo por (id, estado, selecionado, cores) —
 * a posição/tamanho nunca mudam depois do 1º render (vêm da planta,
 * memoizada à parte), por isso um toque num lugar só recalcula este
 * <g>, nunca os outros 143.
 */
function Cadeira({ id, x, y, sw, sh, estado, selecionado, cores, onPointerDownLugar, onClickLugar, onContextMenuLugar }) {
  // Sugerido pelo "chegou grupo de N": pinta o lugar todo de branco,
  // não só o contorno — mais fácil de ver de relance qual é o bloco.
  const cor = selecionado ? "#fff" : cores[estado] ?? CORES_LUGAR[estado];
  return (
    <g
      className="seat"
      data-id={id}
      tabIndex={0}
      role="button"
      aria-label={`Lugar ${id}: ${estado}`}
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
      onPointerDown={(e) => onPointerDownLugar(id, e)}
      onClick={(e) => onClickLugar(id, e)}
      onContextMenu={(e) => onContextMenuLugar(id, e)}
      style={{ cursor: "pointer" }}
    >
      <ellipse cx="0" cy={(sh * 0.46).toFixed(1)} rx={(sw * 0.5).toFixed(1)} ry={(sh * 0.15).toFixed(1)} fill="#000" opacity=".3" />
      <rect
        className="pan"
        x={(-sw * 0.43).toFixed(1)} y={(-sh * 0.5).toFixed(1)}
        width={(sw * 0.86).toFixed(1)} height={(sh * 0.68).toFixed(1)} rx={(sw * 0.18).toFixed(1)}
        fill={cor} stroke={selecionado ? "#0A0D2E" : "rgba(0,0,0,.5)"} strokeWidth={selecionado ? 3 : 1.2}
      />
      <rect
        x={(-sw * 0.34).toFixed(1)} y={(-sh * 0.44).toFixed(1)}
        width={(sw * 0.68).toFixed(1)} height={(sh * 0.16).toFixed(1)} rx={(sh * 0.08).toFixed(1)}
        fill="#fff" opacity=".16" pointerEvents="none"
      />
      <rect x={(-sw * 0.5).toFixed(1)} y={(-sh * 0.42).toFixed(1)} width={(sw * 0.1).toFixed(1)} height={(sh * 0.62).toFixed(1)} rx={(sw * 0.045).toFixed(1)} fill="#22242E" pointerEvents="none" />
      <rect x={(sw * 0.4).toFixed(1)} y={(-sh * 0.42).toFixed(1)} width={(sw * 0.1).toFixed(1)} height={(sh * 0.62).toFixed(1)} rx={(sw * 0.045).toFixed(1)} fill="#22242E" pointerEvents="none" />
      <rect
        x={(-sw * 0.47).toFixed(1)} y={(sh * 0.18).toFixed(1)}
        width={(sw * 0.94).toFixed(1)} height={(sh * 0.3).toFixed(1)} rx={(sw * 0.13).toFixed(1)}
        fill="url(#madeira)" stroke="rgba(0,0,0,.35)" strokeWidth="1"
      />
      <rect x={(-sw * 0.47).toFixed(1)} y={(sh * 0.16).toFixed(1)} width={(sw * 0.94).toFixed(1)} height={(sh * 0.1).toFixed(1)} rx={(sh * 0.05).toFixed(1)} fill="#9B2230" pointerEvents="none" />
      {estado === "bloqueado" && (
        <path
          d={`M${-sw * 0.16},${-sh * 0.28} L${sw * 0.16},${-sh * 0.02} M${sw * 0.16},${-sh * 0.28} L${-sw * 0.16},${-sh * 0.02}`}
          stroke="#fff" strokeWidth={(sw * 0.075).toFixed(1)} strokeLinecap="round" pointerEvents="none"
        />
      )}
      {estado === "reservado" && <circle cy={(-sh * 0.16).toFixed(1)} r={(sw * 0.1).toFixed(1)} fill="#fff" opacity=".92" pointerEvents="none" />}
      {/* apelo: um anel branco — lê-se por forma, não só pela cor */}
      {(estado === "apelo" || estado === "apeloVisitante") && (
        <circle cy={(-sh * 0.16).toFixed(1)} r={(sw * 0.17).toFixed(1)} fill="none" stroke="#fff" strokeWidth={(sw * 0.06).toFixed(1)} pointerEvents="none" />
      )}
      {(estado === "visitante" || estado === "apeloVisitante") && <circle cy={(-sh * 0.16).toFixed(1)} r={(sw * 0.1).toFixed(1)} fill="#0A0D2E" opacity=".8" pointerEvents="none" />}
    </g>
  );
}

function iguais(prev, next) {
  return (
    prev.id === next.id && prev.estado === next.estado && prev.selecionado === next.selecionado &&
    prev.cores === next.cores && prev.x === next.x && prev.y === next.y
  );
}

export default memo(Cadeira, iguais);
