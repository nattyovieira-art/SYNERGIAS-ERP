# Diagnóstico do módulo de Relatórios — 20/07/2026

## Fonte dos dados

- Vendas, produtos e clientes: coleção central em memória, carregada pela API `/api/storage.php` a partir do armazenamento autoritativo do servidor/MySQL.
- `localStorage` não é mais lido pelo módulo para essas três coleções. Ele permanece apenas como backup operacional de outras telas.
- Financeiro, compras e movimentos de estoque ainda usam seus storages atuais, pois não possuem coleção central na API existente.

## Causa da duplicidade

A tela lia diretamente o backup `synergias_vendas` do navegador, ignorando a coleção central já carregada. Além disso, qualquer registro com `numeroPedido` era tratado como pedido, inclusive orçamento, e não existia consolidação antes dos cálculos. Assim, snapshots/cópias com IDs diferentes e o mesmo número eram contabilizados separadamente.

## Correção

- Um pedido é aceito somente quando `tipo` normalizado é `Pedido`.
- O número aceita texto ou número, remove espaços/formatação e zeros à esquerda.
- Registros do mesmo pedido são agrupados antes de todos os relatórios.
- O canônico é o registro mais completo; vínculos fiscais, ID persistido, quantidade de itens e atualização mais recente aumentam a prioridade.
- Nenhum registro do banco é excluído ou alterado.

## Pedido 2504 / Legano

A API online respondeu HTTP 401 à consulta sem sessão. Portanto, IDs, quantidade real na fonte e impacto monetário real não podem ser afirmados sem uma sessão autenticada. O teste automatizado cobre o caso com duas cópias (`002504` e `2504`) e confirma uma única linha, um único faturamento e escolha do registro persistido mais completo.

Antes de publicar, ainda é necessário executar a auditoria autenticada e registrar: IDs reais, canônico, total original, total consolidado e impacto no ticket médio.
