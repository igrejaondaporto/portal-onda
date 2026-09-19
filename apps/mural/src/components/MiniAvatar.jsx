import { corPara, inicial } from "../lib/util.js";

/** Avatar pequeno (18px) de quem publicou, para ir sempre em frente
 *  ao nome — nas listas e no detalhe. Foto real quando existe (a
 *  pessoa tem foto no perfil da base, ou nenhuma se só existe pelo
 *  Mural — ver autorInfo em functions/mural.js), senão a inicial
 *  sobre uma cor determinística. */
export default function MiniAvatar({ nome, foto }) {
  return (
    <span
      className="mini"
      style={foto ? { backgroundImage: `url(${foto})` } : { background: corPara(nome) }}
      aria-hidden="true"
    >
      {foto ? "" : inicial(nome)}
    </span>
  );
}
