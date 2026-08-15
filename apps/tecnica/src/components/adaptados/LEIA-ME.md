# Componentes adaptados

Cópias de componentes do `packages/shared`, ajustadas para a Técnica.

## Para que serve esta pasta

A Técnica usa 16 componentes do partilhado — `NavBar`, `MenuEu`,
`Avatar`, `TecladoNumerico`, `SheetPin`, entre outros. Eles servem
todas as bases ao mesmo tempo.

Quando um deles precisa de mudar **só na Técnica**, editá-lo no
`packages/shared` muda também a Apoio, o Louvor, o Backstage e
qualquer base futura — em produção, no próximo deploy de cada uma.
Esta pasta é a alternativa: uma cópia local que só a Técnica carrega.

## Quando copiar (e quando não)

Copiar tem um custo: a partir daí, uma correção feita no partilhado
já não chega sozinha à cópia. Por isso a ordem de preferência é:

1. **Token ou classe em `src/styles/tecnica.css`** — resolve quase
   todo o ajuste visual sem duplicar nada. Tenta sempre primeiro.
2. **Uma prop nova no componente partilhado**, com o comportamento
   de hoje por defeito. Continua a servir todas as bases, e nenhuma
   muda de aspecto — mas é PR com o dono do projeto, porque mexe
   em ficheiro partilhado.
3. **Copiar para aqui** — só quando a Técnica precisa de estrutura
   ou comportamento genuinamente diferente, não de outro aspeto.

## Como copiar

```bash
cp packages/shared/src/components/NavBar.jsx \
   apps/tecnica/src/components/adaptados/NavBar.jsx
```

Depois troca o import em quem o usa:

```diff
- import NavBar from "@portal/shared/components/NavBar.jsx";
+ import NavBar from "../components/adaptados/NavBar.jsx";
```

E escreve no topo da cópia, em três linhas:

```jsx
// Cópia de packages/shared/src/components/NavBar.jsx
// Copiado em: 2026-08-15
// Porquê: a Técnica tem 5 separadores e o partilhado assume 4.
```

A data é o que permite, mais tarde, ver o que mudou no original
desde a cópia:

```bash
git log --since=2026-08-15 --oneline -- packages/shared/src/components/NavBar.jsx
```

## Registo

Sempre que copiares, acrescenta uma linha em
`MELHORIAS-ENTRE-BASES.md`, na raiz. É a convenção do projeto para
uma ideia boa numa base não ficar esquecida nas outras.

## O que está copiado

Nada, por enquanto. Copia só quando precisares — uma pasta vazia é
melhor sinal do que 16 cópias que ninguém pediu.
