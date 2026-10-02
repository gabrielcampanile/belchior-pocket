# Conectar o Meu Pluggy ao Belchior Pocket

Esta primeira fatia valida a conexão pessoal lendo somente metadados das contas do Item configurado. Ela não grava saldo ou transações no Supabase.

## Preparação

1. Como o Client Secret foi compartilhado fora do painel da Pluggy, revogue-o e gere outro antes de testar.
2. No Dashboard Pluggy, conecte o Item XP do Meu Pluggy à aplicação demo e copie o ID desse Item.
3. Copie .env.example para .env.local e preencha PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, PLUGGY_ITEM_ID e PLUGGY_ALLOWED_USER_ID.
4. Obtenha o UUID do usuário em Supabase → Authentication → Users.
5. Reinicie o servidor local. Para um deploy, cadastre as mesmas variáveis no secret store do servidor; não use prefixo VITE_.

## Verificação

Entre no Pocket com o usuário cujo UUID foi configurado, abra Configurações → Open Finance e use Verificar conexão Meu Pluggy. A tela mostra apenas nome, tipo e moeda das contas. O endpoint exige sessão Supabase e compara o usuário com PLUGGY_ALLOWED_USER_ID.

## Limites desta fatia

- A autenticação na API Pluggy e a leitura de GET /accounts?itemId=... ocorrem exclusivamente no servidor.
- A API key de curta duração é usada apenas nesta chamada; credenciais e respostas completas não são registradas em log nem devolvidas ao navegador.
- Não há importação/persistência de transações, saldos ou payload bruto. Isso depende da decisão de schema e reconciliação do backlog BP-010/BP-025.
- Use apenas o Item XP nesta etapa. Wise fica para depois.
