import { useEffect, useState } from "react";
import { entrarComoDev } from "../lib/auth";

/** Folha de acesso de dev — irmã da SheetPin, mas com senha em vez de
 *  PIN e sem pessoa nenhuma por trás (ver entrarComoDev). Só aparece
 *  depois do gatilho escondido em GatilhoDev. */
export default function SheetAcessoDev({ onFechar }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
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

  async function entrar(e) {
    e.preventDefault();
    if (trancado || !senha) return;
    setAEnviar(true);
    setErro("");
    const r = await entrarComoDev(senha);
    if (!r.ok) {
      setSenha("");
      if (r.bloqueado) {
        setBloqueadoAte(Date.now() + (r.faltamSegundos ?? 900) * 1000);
      } else {
        setErro(r.restam != null ? `Senha errada. Restam ${r.restam} tentativa${r.restam === 1 ? "" : "s"}.` : "Senha errada.");
      }
      setAEnviar(false);
    }
    // se ok, o onAuthStateChanged na App troca de ecrã sozinho
  }

  const restamMs = bloqueadoAte ? Math.max(0, bloqueadoAte - agora) : 0;
  const textoAviso = bloqueadoAte
    ? restamMs > 0
      ? `Bloqueado. Tenta outra vez daqui a ${Math.floor(restamMs / 60000)}:${String(
          Math.floor((restamMs % 60000) / 1000)
        ).padStart(2, "0")}.`
      : ""
    : erro;

  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-label="Acesso de dev">
        <div className="pux" />
        <h2 style={{ textAlign: "center" }}>Acesso de dev</h2>
        <p className="sb2" style={{ textAlign: "center" }}>Entra como líder desta base, sem pessoa nenhuma por trás.</p>
        <form onSubmit={entrar} style={{ marginTop: 18 }}>
          <input
            type="password" className="campo" placeholder="Senha" autoFocus
            value={senha} onChange={(e) => setSenha(e.target.value)} disabled={trancado}
          />
          {textoAviso && <p className="aviso">{textoAviso}</p>}
          <button className="btn full" style={{ marginTop: 14 }} disabled={trancado || !senha}>
            {aEnviar ? "A verificar…" : "Entrar"}
          </button>
          <button type="button" className="btn sec full" style={{ marginTop: 9 }} onClick={onFechar}>
            Cancelar
          </button>
        </form>
      </div>
    </>
  );
}
