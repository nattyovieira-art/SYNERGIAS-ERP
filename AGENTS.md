# Regras permanentes do Synergias ERP

Estas regras de negócio foram confirmadas pelo usuário e não podem ser removidas,
relaxadas ou reinterpretadas por agentes, automações ou correções futuras sem
autorização explícita do usuário.

## Pedidos, pagamentos e boletos

1. Pedido entregue ou concluído deve ser reconhecido como entregue.
2. Pedido com NF emitida, entrega concluída e boleto emitido deve aparecer como
   concluído, nunca como pendente.
3. PIX e transferência bancária dispensam emissão e vínculo de boleto. A ausência
   de boleto nessas formas de pagamento não pode deixar o pedido pendente.
4. Um boleto existente deve ser reconhecido por qualquer identificador persistido,
   incluindo ID da cobrança, número do boleto, nosso número, seu número, linha
   digitável, código de barras, link/PDF ou data de geração.
5. A normalização e a sincronização não podem apagar vínculos ou identificadores
   de boletos já existentes.
6. Não criar números, links ou vínculos de boleto fictícios quando os dados
   originais não estiverem disponíveis.
7. Não criar exceções por número de pedido para contornar estas regras; a solução
   deve valer para todos os pedidos.

O teste `npm run test:regras-pedidos`, dentro de `apps/web`, protege essas regras e
é executado automaticamente antes do build. Não remover, ignorar ou enfraquecer
esse teste para fazer uma alteração passar.

## Publicação e economia

- Acumular alterações e publicar somente quando o usuário pedir explicitamente.
- Preferir inspeções e testes direcionados para reduzir consumo, usando o build
  completo apenas na validação final ou antes da publicação.

## Preços de venda

1. Os preços de varejo e atacado devem ser calculados automaticamente a partir do
   custo e da margem configurada.
2. A margem automática mínima é 30% sobre o custo, tanto no varejo quanto no
   atacado.
3. O usuário pode ajustar o preço de venda manualmente, mas o sistema nunca pode
   aceitar ou salvar preço inferior ao custo acrescido de 30%.
4. Importações, compras, sincronizações e normalizações também devem respeitar o
   preço mínimo; não basta proteger apenas o formulário.
5. Estas regras não podem ser removidas ou enfraquecidas sem autorização explícita
   do usuário.

## Custos de compras

1. ICMS destacado, IPI e ICMS-ST informados na NF-e de compra devem compor o
   custo do produto.
2. Esses tributos devem ser rateados pela quantidade convertida para calcular o
   custo unitário.
3. Importações, confirmações e edições de compras devem preservar esta regra.
4. Quando a NF-e de compra tiver alíquota interestadual de ICMS de 4%, o sistema
   deve calcular automaticamente o DIFAL usando a alíquota interna cadastrada
   para o NCM e somá-lo ao custo.
5. A nota só deve permanecer em revisão por esse motivo quando a alíquota interna
   necessária ao cálculo não estiver cadastrada.
6. Todo produto sujeito a ICMS-ST deve ter o imposto calculado automaticamente e
   incluído no custo. Quando o XML trouxer o ICMS-ST destacado, usar o valor do
   XML; quando não trouxer, calcular pela regra confirmada do NCM/CEST, usando
   MVA e alíquotas cadastradas.
7. A revisão manual de ICMS-ST só deve ser exigida quando faltarem dados fiscais
   indispensáveis ao cálculo ou houver divergência.
8. Os NCMs 48181000 e 48182000 são sujeitos a ICMS-ST para esta operação, mesmo
   quando o imposto não estiver destacado no XML. O sistema deve reconhecer
   esses NCMs, calcular a ST pela regra fiscal cadastrada e incluí-la no custo.
9. A falta de dados para calcular ST ou DIFAL não pode bloquear a importação,
   confirmação ou entrada da NF-e. O sistema deve gravar o custo provisório com
   os valores disponíveis e registrar a pendência fiscal.
10. Quando o imposto pendente for calculado, atualizar apenas a diferença do
    custo e do financeiro vinculados, sem gerar nova entrada ou movimentar o
    estoque novamente.

## Endereços de entrega e e-mail

1. Cada endereço de entrega possui seu próprio e-mail de envio.
2. Ao selecionar um endereço, orçamento, pedido e envio de documentos devem usar
   primeiro o e-mail desse endereço; o e-mail principal do cliente é apenas
   alternativa quando o endereço não tiver e-mail.
3. Editar ou normalizar clientes não pode apagar o e-mail associado ao endereço.
4. Ao trocar o cliente de um orçamento ou pedido, os campos Para e Cc devem ser
   substituídos pelos dados do novo cliente/endereço. Nunca podem reaproveitar
   e-mails do cliente ou pedido anteriormente aberto.

## Agenda, diárias e despesas

1. Uma diária registrada na Agenda deve criar imediatamente uma única despesa em
   Contas a Pagar, na categoria Pessoal, com vencimento na data da diária.
2. Editar a diária atualiza a mesma despesa; nunca cria duplicidade.
3. Excluir uma diária ainda em aberto exclui sua despesa vinculada. Uma diária já
   paga não pode ser alterada ou excluída pela Agenda.
4. O sistema deve perguntar, uma vez em cada turno, às 12h e às 16h, se houve
   diárias. A resposta de um turno não substitui a pergunta do outro.
5. Cada diária de cada funcionário em cada turno tem valor fixo de R$ 50,00.

## Histórico financeiro

1. Contas a Receber deve exibir vendas pendentes, parcialmente pagas, vencidas e
   pagas; a baixa não pode remover o registro da listagem.
2. Contas a Pagar deve exibir compras pendentes, vencidas, canceladas e pagas; o
   pagamento não pode remover o registro da listagem.
3. A página de Conciliação Bancária deve destacar somente compras e vendas que
   ainda aguardam conciliação, preservando o histórico completo nas páginas de
   Contas a Receber e Contas a Pagar.
