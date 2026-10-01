# Pluggy data discovery — V1

**Status:** documentação consultada; chamada autenticada ao Sandbox ainda não executada. Estes exemplos não são dados XP nem respostas capturadas de um Item.

## Escopo e decisões atuais

- XP primeiro; acompanhamento diário de gastos e orçamento na V1. Wise, cenários e patrimônio ficam fora do escopo ativo.
- Uma compra avulsa no cartão conta no mês da compra; pagar a fatura não é outra despesa.
- Preservar valor e moeda originais; qualquer total em BRL exige conversão explícita.
- Política exata de câmbio e atribuição mensal de parcelas continuam abertas e devem ser decididas antes do schema.
- Usar somente dados sintéticos do Sandbox; não consultar Items financeiros reais.

## MCP e API

O [Pluggy Docs MCP](https://mcp.pluggy.ai/mcp) serve documentação, API reference e receitas. A sessão atual não expõe ferramentas desse MCP, portanto consultei as páginas públicas oficiais. O MCP não substitui a integração da aplicação: o servidor do app precisa autenticar e chamar a API Pluggy.

Fluxo do [Quick Start](https://docs.pluggy.ai/en/docs/quickstart): o servidor usa CLIENT_ID/CLIENT_SECRET em POST /auth; emite connect token com POST /connect_token; o cliente abre Pluggy Connect e recebe itemId; o servidor lê contas e transações com API key. Nenhuma credencial foi encontrada no ambiente; nenhum endpoint autenticado foi chamado.

## Mapa de campos para o domínio

| Recurso/campos Pluggy | Conceito candidato no app | Observações |
| --- | --- | --- |
| Item: id, connector, status, estado de execução | Conexão/provider e saúde da sincronização | O widget fechar não garante que o Item esteja pronto. |
| Account: id, itemId, type, subtype, name, currencyCode, balance | Conta canônica e vínculo de origem | BANK abrange corrente/poupança; CREDIT representa cartão. Evitar CPF, titular e número completo. |
| bankData.closingBalance, automaticallyInvestedBalance | Detalhes de saldo bancário | Validar o que é saldo disponível versus fechamento/reserva. |
| creditData.balanceCloseDate, balanceDueDate, limites e status | Condições/estado da fatura | Saldo de crédito é fatura aberta, não caixa disponível. |
| Saldo: balance, blockedBalance, currencyCode, updateDateTime | Observação de saldo datada | Disponibilidade e limites do endpoint em tempo real devem ser verificados. |
| Transação: id, accountId, providerId, providerCode, description, date, type, status, operationType | Evento econômico e identidade da origem | Confirmar estabilidade/escopo de providerId na XP; não deduplicar por data/valor/descrição. |
| Valor: amount, currencyCode, amountInAccountCurrency | Valor original e na moeda da conta | Pode faltar taxa/data de câmbio; não usar float como valor canônico. |
| Cartão: purchaseDate, billId, billPostDate, billForecastDate, paymentType, creditCardMetadata.installmentNumber/totalInstallments | Compra, parcela e período da fatura | totalAmount não é retornado por conectores Open Finance segundo docs. Definir competência das parcelas. |
| Transferência/pagamento: paymentData, operationType | Transferência, pagamento de fatura, tarifa | Interpretar com tipo de conta e domínio; categoria do provider não é regra contábil. |
| category, categoryId, merchant | Sugestões de categorização | Enriquecimentos podem depender de plano/feature; categorias e overrides pertencem ao app. |

Usar [GET /v2/transactions](https://docs.pluggy.ai/en/reference/transaction/transactions-v2-list): docs informam paginação por cursor em páginas de 500; endpoint antigo por página está depreciado.

## Regras de normalização a verificar

- Interpretar CREDIT/DEBIT com tipo da conta e operationType; direção não equivale automaticamente a receita/despesa.
- Compra no cartão conta uma vez; liquidação da fatura não gera nova despesa.
- Transferência entre contas próprias não é receita nem despesa.
- PENDING e POSTED são estados a reconciliar, não eventos para somar em duplicidade.
- date, purchaseDate, billPostDate e billForecastDate têm significados distintos.
- Tipos/DTOs Pluggy ficam no adapter; o domínio expressa conceitos financeiros próprios.

## Fixtures sintéticas

Os arquivos em [fixtures](reference/pluggy/fixtures) contêm valores artificiais e campos baseados em exemplos oficiais. Não são respostas capturadas nem foram validados contra um Item Sandbox.

O [Sandbox Pluggy](https://docs.pluggy.ai/pt/docs/guides/sandbox) simula dados com estrutura geral semelhante à produção, mas não prova cobertura específica da XP. Inclui exemplos de conta corrente, cartão, boleto e parcelas; Items inativos por mais de 30 dias podem ser removidos.

## Lacunas antes do schema

1. Produtos XP disponíveis: conta, cartões, benefícios/salário, investimento e internacional.
2. Presença/estabilidade de providerId; comportamento de transação pendente que vira publicada.
3. Datas XP de compra, postagem e fatura, especialmente parcelas futuras.
4. Valor original e na moeda da conta em transações estrangeiras; taxa/base para BRL.
5. Semântica e frescor de saldos por tipo de conta.
6. Disponibilidade de categorias/merchant e códigos de operação XP.

## Completion gate

Manter BP-049 aberta até validar o fluxo autenticado no Sandbox, salvar respostas sintéticas/redigidas como fixtures e corrigir este mapa. Nenhuma migration, tela ou conexão financeira real deve ser alterada no spike.
