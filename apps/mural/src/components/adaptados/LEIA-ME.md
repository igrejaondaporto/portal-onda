# Componentes adaptados

Cópias de componentes do `packages/shared`, ajustadas para o Mural
Onda — ver "Trabalhar numa base sem mexer nas outras" no `CLAUDE.md`
da raiz (o Mural não é uma base, mas a mesma lógica de isolamento
aplica-se: uma cópia local que só esta app carrega).

## Quando copiar (e quando não)

1. **Token ou classe em `src/styles/mural.css`** — resolve quase todo
   o ajuste visual sem duplicar nada. Tenta sempre primeiro.
2. **Uma prop nova no componente partilhado**, com o comportamento de
   hoje por defeito — PR com o dono do projeto, mexe em ficheiro
   partilhado.
3. **Copiar para aqui** — só quando o Mural precisa de estrutura ou
   comportamento genuinamente diferente.

## O que está copiado

- **`SheetPinBase.jsx`** (2026-09) — de
  `packages/shared/src/components/SheetPin.jsx`. O original importa
  `entrarComPin` de `"../lib/auth"`, um caminho relativo AO PRÓPRIO
  FICHEIRO — resolve sempre para `packages/shared/src/lib/auth.js`,
  nunca para o `lib/auth.js` de quem o usa. Nas apps de base isso não
  se nota (cada uma só entra na sua própria base, `VITE_BASE_ID`
  fixo); o Mural deixa a pessoa escolher a base no ecrã de entrada, e
  precisa do `entrarComPin` DESTA app (que sabe qual base foi
  escolhida — ver `definirBaseEmCurso`). Sem a cópia, o Mural tentava
  sempre `baseId: "mural"` (que não existe) e qualquer PIN certo
  aparecia como errado — bug real, apanhado 2026-09.
