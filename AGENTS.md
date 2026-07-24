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
