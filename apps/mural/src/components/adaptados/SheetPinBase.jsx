/**
 * Adaptado de packages/shared/src/components/SheetPin.jsx, 2026-09.
 *
 * Porquê a cópia: o original importa `entrarComPin` de "../lib/auth"
 * — um caminho RELATIVO AO PRÓPRIO FICHEIRO (packages/shared/src/
 * components/), que por isso resolve sempre para
 * packages/shared/src/lib/auth.js, nunca para o lib/auth.js de quem
 * o usa. Nas apps de base isso é invisível: cada uma só entra na sua
 * própria base (VITE_BASE_ID fixo), e o `entrarComPin` partilhado já
 * chama `entrar({baseId: BASE_ID, ...})` com o valor certo. O Mural
 * não tem UM baseId fixo — a pessoa escolhe a base no ecrã de entrada
 * — e por isso precisa do `entrarComPin(pessoaId, pin)` DESTA app
 * (apps/mural/src/lib/auth.js), que lê a base escolhida em
 * `definirBaseEmCurso`. Usar o SheetPin partilhado sem mudar nada
 * fazia o Mural tentar sempre `baseId: "mural"` (o VITE_BASE_ID desta
 * app, que só existe por convenção — nunca há `bases/mural`), e por
 * isso QUALQUER PIN certo aparecia como errado (bug real, apanhado
 * 2026-09 por quem estava a testar).
 *
 * Duas mudanças a mais em relação ao original:
 *   - `pessoa.cor`, que aqui nunca vem preenchido (dadosEntrada em
 *     index.js não devolve esse campo) — usa corPara(pessoa.nome).
 *   - nada mais muda; mesmo comportamento, mesmo desenho.
 */
import { useEffect, useState } from "react";
import { entrarComPin } from "../../lib/auth.js";
import { corPara } from "../../lib/util.js";
import TecladoNumerico from "@portal/shared/components/TecladoNumerico.jsx";

export default function SheetPinBase({ pessoa, nomeLider, onFechar, onDeveTrocarPin }) {
  const dig = pessoa.digitos ?? (pessoa.papel === "lider_base" ? 6 : 4);

  const [cod, setCod] = useState("");
  const [erro, setErro] = useState("");
  const [tremer, setTremer] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [bloqueadoAte, setBloqueadoAte] = useState(null);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    const onTecla = (e) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", onTecla);
    return () => window.removeEventListener("keydown", onTecla);
  }, [onFechar]);

  useEffect(() => {
    if (!bloqueadoAte) return;
    const t = setInterval(() => {
      const agoraMs = Date.now();
      setAgora(agoraMs);
      if (agoraMs >= bloqueadoAte) {
        setBloqueadoAte(null);
        setErro("");
        clearInterval(t);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [bloqueadoAte]);

  const trancado = aEnviar || (bloqueadoAte != null && bloqueadoAte > agora);

  async function validar(codigo) {
    setAEnviar(true);
    const r = await entrarComPin(pessoa.id, codigo);
    if (r.ok) {
      if (r.deveTrocarPin) onDeveTrocarPin?.(codigo);
    } else {
      setCod("");
      setTremer(true);
      setTimeout(() => setTremer(false), 400);
      if (r.bloqueado) {
        setBloqueadoAte(Date.now() + (r.faltamSegundos ?? 900) * 1000);
      } else {
        setErro(
          r.restam != null
            ? `Código errado. Restam ${r.restam} tentativa${r.restam === 1 ? "" : "s"}.`
            : "Código errado."
        );
      }
      setAEnviar(false);
    }
  }

  function tecla(n) {
    if (trancado) return;
    setErro("");
    const novo = cod + n;
    setCod(novo);
    if (novo.length === dig) setTimeout(() => validar(novo), 180);
  }
  function apagar() {
    if (trancado) return;
    setCod((c) => c.slice(0, -1));
  }

  const restamMs = bloqueadoAte ? Math.max(0, bloqueadoAte - agora) : 0;
  const textoAviso = bloqueadoAte
    ? restamMs > 0
      ? `Conta bloqueada. Tenta outra vez daqui a ${Math.floor(restamMs / 60000)}:${String(
          Math.floor((restamMs % 60000) / 1000)
        ).padStart(2, "0")}. Se for urgente, fala com o ${nomeLider}.`
      : ""
    : aEnviar
      ? "A verificar…"
      : erro;

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-label={`Entrar como ${pessoa.nome}`}>
        <div className="pux" />
        <div
          className="cara"
          style={pessoa.foto ? { backgroundImage: `url(${pessoa.foto})` } : { background: corPara(pessoa.nome) }}
        >
          {pessoa.foto ? "" : pessoa.nome[0]}
        </div>
        <h2>Olá, {pessoa.nome}</h2>
        <p className="sb2">Introduz o teu código de {dig} dígitos</p>
        <div className={`pts${tremer ? " e tr" : aEnviar ? " a" : ""}`}>
          {Array.from({ length: dig }).map((_, i) => (
            <i key={i} className={i < cod.length ? "on" : ""} />
          ))}
        </div>
        <p className="aviso">{textoAviso}</p>
        <TecladoNumerico desativado={trancado} podeApagar={!!cod.length} onTecla={tecla} onApagar={apagar} />
      </div>
    </>
  );
}
