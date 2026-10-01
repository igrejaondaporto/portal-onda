import { regiaoDe, useLocais } from "../lib/locais.js";

export const FORA = "__fora__";

/** Distrito do lugar: o escolhido, ou (anúncio a editar) deduzido da cidade
 *  — nomes de concelho são únicos em Portugal. Cidade que não está na lista
 *  é de "fora" (texto livre, ex.: Brescia). */
function distritoDe(lugar, locais) {
  if (lugar.distrito) return lugar.distrito;
  if (!lugar.cidade) return "";
  return locais?.concelhos[lugar.cidade]?.distrito ?? FORA;
}

/** O que se grava no anúncio, ou null se falta a cidade. */
export function lugarFinal(lugar, locais) {
  const cidade = (lugar.cidade || "").trim();
  if (!cidade) return null;
  const distrito = distritoDe(lugar, locais);
  return {
    cidade,
    freguesia: (lugar.freguesia || "").trim(),
    regiao: distrito === FORA ? lugar.regiao || "norte" : regiaoDe(distrito, cidade),
  };
}

/**
 * Onde é o anúncio (2026-10): Distrito → Cidade → Freguesia (opcional),
 * Portugal inteiro (ver lib/locais.js). No fim da lista de distritos,
 * "Fora de Portugal / outro sítio", com a cidade escrita à mão.
 * `lugar` = { distrito, cidade, freguesia, regiao }; no Editar começa sem
 * distrito e deduz-se da cidade.
 */
export default function EscolherLugar({ lugar, setLugar, prefixo = "" }) {
  const locais = useLocais();
  if (!locais) return <p className="ds" style={{ marginTop: 12 }}>A carregar a lista de cidades…</p>;

  const distrito = distritoDe(lugar, locais);
  const fora = distrito === FORA;
  const concelhos = distrito && !fora ? locais.distritos.find((d) => d.nome === distrito)?.concelhos ?? [] : [];
  const freguesias = !fora && lugar.cidade ? locais.concelhos[lugar.cidade]?.freguesias ?? [] : [];

  return (
    <>
      <label className="rot" htmlFor={`${prefixo}distrito`}>Distrito</label>
      <select
        id={`${prefixo}distrito`} className="campo" value={distrito}
        onChange={(e) => setLugar({ distrito: e.target.value, cidade: "", freguesia: "", regiao: lugar.regiao })}
      >
        <option value="" disabled>Escolhe o distrito</option>
        {locais.distritos.map((d) => <option key={d.nome} value={d.nome}>{d.nome}</option>)}
        <option value={FORA}>Fora de Portugal / outro sítio…</option>
      </select>

      {distrito && !fora && (
        <>
          <label className="rot" htmlFor={`${prefixo}cidade`}>Cidade</label>
          <select
            id={`${prefixo}cidade`} className="campo" value={lugar.cidade}
            onChange={(e) => setLugar({ ...lugar, distrito, cidade: e.target.value, freguesia: "" })}
          >
            <option value="" disabled>Escolhe a cidade</option>
            {concelhos.map((c) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
          </select>
        </>
      )}
      {fora && (
        <>
          <label className="rot" htmlFor={`${prefixo}cidade`}>Cidade</label>
          <input
            id={`${prefixo}cidade`} className="campo" value={lugar.cidade} maxLength={60} placeholder="Qual cidade (e país)?"
            onChange={(e) => setLugar({ ...lugar, distrito: FORA, cidade: e.target.value })}
          />
        </>
      )}

      {lugar.cidade && (
        <>
          <label className="rot" htmlFor={`${prefixo}freguesia`}>Freguesia <span style={{ fontWeight: 400 }}>— opcional</span></label>
          {fora ? (
            <input
              id={`${prefixo}freguesia`} className="campo" value={lugar.freguesia} maxLength={80} placeholder="Zona ou freguesia (opcional)"
              onChange={(e) => setLugar({ ...lugar, freguesia: e.target.value })}
            />
          ) : (
            <select
              id={`${prefixo}freguesia`} className="campo" value={lugar.freguesia}
              onChange={(e) => setLugar({ ...lugar, distrito, freguesia: e.target.value })}
            >
              <option value="">Não interessa / não sei</option>
              {freguesias.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
        </>
      )}
    </>
  );
}
