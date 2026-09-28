/**
 * Política de privacidade — o mínimo que um site em Portugal costuma
 * ter (RGPD), num texto curto e em linguagem simples. Pedido do dono
 * do produto (2026-09): "o básico do básico", é uma ferramenta interna
 * da igreja. Aberta pelo link no ecrã do PIN (`SheetPin`) e pelo menu
 * da foto (`MenuEu`), em todas as bases, sem cada app a ligar.
 *
 * Os prazos batem com `functions/retencao.js` (e o CLAUDE.md da raiz)
 * — se um mudar, o outro muda também.
 */
const SECCOES = [
  ["Quem somos", "O Portal do Voluntário é uma ferramenta interna da Igreja Onda (Porto/Maia), usada só para organizar o serviço das equipas de voluntários."],
  ["Que dados guardamos", "O teu nome, telemóvel, a base onde serves, as escalas e, se quiseres, uma foto e um e-mail. Nos reembolsos, também as faturas e o IBAN. No Kinder, os dados que os pais deixam no registo das crianças."],
  ["Para quê", "Escalas, avisos à equipa, reembolsos e o dia a dia do culto. Nunca para publicidade, e nunca vendemos nem damos os teus dados a ninguém fora da igreja."],
  ["Quem os vê", "A tua equipa e os líderes veem o que é preciso para servir contigo (nome, foto, telemóvel, escalas). O teu e-mail e o IBAN não aparecem à equipa — o IBAN só serve para pagar os teus reembolsos."],
  ["Onde ficam", "Em serviços de confiança — Google Firebase (servidores na Europa) e Cloudflare. Os e-mails de aviso saem pelo Resend. O acesso é protegido pelo teu código pessoal."],
  ["Durante quanto tempo", "Dados do dia a dia: 2 meses. Se deixares de servir, os teus contactos e a foto saem ao fim de 1 ano. Reembolsos: 5 anos, por obrigação fiscal."],
  ["Os teus direitos", "Podes pedir para ver, corrigir ou apagar os teus dados — fala com o líder da tua base ou com a equipa pastoral. Se achares que algo não está bem, podes também queixar-te à CNPD (cnpd.pt)."],
  ["Cookies", "Só usamos o essencial para manter a tua sessão aberta. Sem publicidade nem estatísticas."],
];

export default function SheetPrivacidade({ onFechar }) {
  return (
    <>
      <div className="veu on" onClick={onFechar} />
      <div className="pin on" role="dialog" aria-modal="true" aria-label="Política de privacidade">
        <div className="pux" />
        <h2>Privacidade</h2>
        <p className="sb2">Como tratamos os teus dados</p>
        <div style={{ marginTop: 14 }}>
          {SECCOES.map(([titulo, texto]) => (
            <div key={titulo} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 13.5, fontWeight: 700 }}>{titulo}</p>
              <p className="ds" style={{ lineHeight: 1.5, marginTop: 2 }}>{texto}</p>
            </div>
          ))}
        </div>
        <p className="ds" style={{ fontSize: 11.5, marginTop: 4 }}>Última atualização: setembro de 2026.</p>
        <button className="btn sec full" style={{ marginTop: 14 }} onClick={onFechar}>Fechar</button>
      </div>
    </>
  );
}
