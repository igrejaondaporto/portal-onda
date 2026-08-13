import { useEffect, useState } from "react";
import { entrarComPin } from "../lib/auth";
import TecladoNumerico from "./TecladoNumerico";

/**
 * Folha do PIN. A validação real vive na Cloud Function `entrar` —
 * isto só desenha pontos e manda dígitos, nunca decide se o código está certo.
 */
export default function SheetPin({ pessoa, nomeLider, onFechar, onDeveTrocarPin }) {
  // o PIN é global — quantos dígitos tem é propriedade do PIN (vem do
  // servidor em `digitos`), não do papel nesta base. Um líder de outra
  // base, adicionado aqui como voluntário, continua a digitar o código
  // que já tinha. O fallback só cobre uma resposta antiga sem o campo.
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
      // o onAuthStateChanged na App troca de ecrã sozinho; só avisamos
      // se este PIN ainda é o provisório, para a App forçar a troca.
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
          style={pessoa.foto ? { backgroundImage: `url(${pessoa.foto})` } : { background: pessoa.cor }}
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
