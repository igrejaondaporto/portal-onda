import { useEffect } from "react";
import { CONCELHOS, FREGUESIAS_POR_CONCELHO, gdMaisProximo } from "../lib/contactos";

/**
 * Concelho → Freguesia (em cascata, ou texto livre em "Outro") → GD
 * sugerido — os três campos de localização do contacto, usados tanto
 * ao criar (Formulario.jsx) como ao editar (SheetEditarContacto.jsx).
 * Controlado por fora (value/onChange), a única lógica própria daqui
 * é a sugestão automática de GD pela freguesia (ver o comentário
 * grande dela abaixo).
 */
export default function CamposLocalizacaoGD({
  concelho, setConcelho, freguesia, setFreguesia, gdSugerido, setGdSugerido, gds,
}) {
  const freguesias = FREGUESIAS_POR_CONCELHO[concelho] ?? [];

  // Mostra sempre todos os GDs, nunca só os da zona da pessoa —
  // agrupados por região só para facilitar encontrar.
  const gdsPorRegiao = Object.entries(
    gds.reduce((mapa, g) => {
      (mapa[g.regiao] ??= []).push(g);
      return mapa;
    }, {})
  ).sort(([a], [b]) => a.localeCompare(b, "pt"));

  // Sugestão automática pela freguesia — o GD mais perto em linha
  // reta (ver gdMaisProximo em lib/contactos.js). É a freguesia, não
  // só o concelho, que decide: duas freguesias do mesmo concelho
  // podem ter GDs mais próximos diferentes (ex.: São Mamede de
  // Infesta, em Matosinhos, fica mais perto do GD "São Mamede" do
  // que do GD "Brito Capelo", que é do mesmo concelho mas do outro
  // lado). Só entra em ação quando muda a freguesia (não a cada
  // render); quem preenche continua a poder trocar à mão a seguir,
  // sem a sugestão voltar a pisar essa escolha até a freguesia mudar
  // outra vez.
  useEffect(() => {
    if (!concelho || concelho === "Outro" || !freguesia || !gds.length) return;
    const sugestao = gdMaisProximo(concelho, freguesia, gds);
    if (sugestao) setGdSugerido(sugestao.nome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concelho, freguesia, gds.length]);

  return (
    <>
      <label className="rot">Concelho</label>
      <select className="campo" value={concelho} onChange={(e) => { setConcelho(e.target.value); setFreguesia(""); }}>
        <option value="">Escolhe o concelho</option>
        {CONCELHOS.map((c) => <option key={c} value={c}>{c}</option>)}
        <option value="Outro">Outro</option>
      </select>

      <label className="rot">Freguesia</label>
      {concelho === "Outro" ? (
        <input className="campo" value={freguesia} onChange={(e) => setFreguesia(e.target.value)} placeholder="Qual?" />
      ) : (
        <select className="campo" value={freguesia} onChange={(e) => setFreguesia(e.target.value)} disabled={!concelho}>
          <option value="">{concelho ? "Escolhe a freguesia" : "Escolhe primeiro o concelho"}</option>
          {freguesias.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      )}

      <label className="rot">GD sugerido (opcional)</label>
      {freguesia && concelho !== "Outro" && (
        <p className="ds" style={{ marginBottom: 6 }}>Sugerido automaticamente pela freguesia — podes trocar.</p>
      )}
      <select className="campo" value={gdSugerido} onChange={(e) => setGdSugerido(e.target.value)}>
        <option value="">Sem GD sugerido</option>
        {gdsPorRegiao.map(([regiao, doGrupo]) => (
          <optgroup key={regiao} label={regiao}>
            {doGrupo.map((g) => <option key={g.id} value={g.nome}>{g.nome}</option>)}
          </optgroup>
        ))}
      </select>
    </>
  );
}
