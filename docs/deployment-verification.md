# Investigação do deploy e confirmação do Marketing

## Correção de empacotamento

Os sete módulos auxiliares do backend passaram a usar nomes iniciados por `_` na pasta `api/`. A Vercel ignora esses nomes na descoberta de funções; `api/index.ts` permanece como a única função publicada. Os caminhos HTTP e os handlers Express continuam iguais. Nenhuma migração ou regra de importação foi alterada.

A documentação oficial descreve essa convenção: https://vercel.com/docs/functions/configuring-functions/advanced-configuration#adding-utility-files-to-the-api-directory

O builder oficial `@vercel/node@32.0.0` confirmou que, antes da correção, `api/marketing.ts` também era empacotado como função independente. Depois da correção, a descoberta encontrou apenas `api/index.ts`. A função emitida foi importada e exercitada via HTTP, preservando autenticação e falha explícita sem Neon. Esse teste usa credenciais fictícias e não acessa produção.

O empacotamento era um problema estrutural separado. Com acesso autenticado, a API da Vercel confirmou que a falha de deploy ocorria antes do build, por incompatibilidade do cron por minuto com o plano Hobby.

## Cron existente

A conta existente usa o plano Hobby. A mensagem real de erro do deployment foi: `Hobby accounts are limited to daily cron jobs. This cron expression (* * * * *) would run more than once per day.`

`vercel.json` não declara mais o cron incompatível. `vercel.pro.json` preserva a configuração original, com execução por minuto, para uso explícito em plano compatível. O endpoint protegido, as configurações e os dados dos lembretes permanecem disponíveis. Os envios já estavam desativados em produção (`REMINDERS_ENABLED` ausente); esta correção não os ativa. Não há agendamento automático de lembretes no deploy Hobby. Para ativá-lo com a frequência original, é necessário plano compatível ou scheduler autorizado; trocar para um cron diário não preservaria essa funcionalidade.

Também foi configurado `APP_ACCESS_TOKEN` em produção, que estava ausente. O valor foi gerado aleatoriamente e guardado apenas como Secret na Vercel e no arquivo local ignorado `.env.access.local`. Nenhum segredo foi versionado.
Referência: https://vercel.com/docs/cron-jobs/usage-and-pricing

## Auditoria da importação real

Após um deploy bem-sucedido, com `DATABASE_URL` e o acesso existentes configurados, execute:

```powershell
# APP_ACCESS_TOKEN deve estar no ambiente seguro ou em .env local ignorado pelo Git.
# Não passe o código de acesso como argumento e não o grave em documentação/logs.
npm run verify:marketing -- https://SEU-DOMINIO
```

O verificador exige HTTPS, rejeita redirecionamentos autenticados e confirma `mode: neon` em `/api/db-status`. Faz duas leituras autenticadas em `/api/marketing`; a primeira pode executar a importação inicial já prevista pelo aplicativo. O verificador não chama endpoints de exclusão, atualização ou importação em lote.

A auditoria exige:

- 24 identidades esperadas das fontes, sendo 14 do Passione e 10 do Narok Store;
- nenhuma duplicata por marca, data e título normalizados;
- horários, formatos, redes e instruções iguais aos dados transcritos;
- os mesmos IDs e revisões após a segunda leitura.

Publicações adicionais são preservadas e não precisam ser excluídas para a auditoria passar. Equivalentes alterados pelo usuário geram um relatório de diferenças; o script não os corrige nem restaura itens excluídos. Uma falha na auditoria exige análise, nunca limpeza automática do banco.

## Validação com acesso autenticado

O projeto Vercel confirmado é `henriques-projects-46c626a8/hagenda`, repositório `Narok94/HAGENDA`, branch `main`. A conexão de produção fornecida pelo próprio projeto aponta para o Neon existente `nameless-grass-64689215`, branch `main` (`br-flat-sky-aurr322h`). Não foi criado um segundo banco para o aplicativo.

Antes da implantação, a migração e a importação foram exercitadas na branch cópia `hagenda-deploy-verify-330c0a5`. Duas leituras da API real nessa branch confirmaram os 24 registros, nenhum ausente, divergente ou duplicado. A comparação dos valores das colunas anteriores confirmou a preservação dos dados existentes. A linha de base de produção continha 12 tarefas, 3 inscrições push e um registro em cada tabela de perfil, treino e dieta.

A implantação de produção foi confirmada como Ready e a auditoria autenticada em `https://hagenda.vercel.app` confirmou 24 publicações (14 Passione, 10 Narok Store), nenhuma ausente, divergente ou duplicada, e IDs/revisões estáveis em duas leituras. O importador também foi executado duas vezes no Neon de produção sem recriar registros.

Antes de abrir a interface, os hashes dos valores anteriores permaneceram idênticos nas cinco tabelas existentes. Após o teste real de login e navegação mobile, apenas `user_settings.updated_at` avançou devido ao salvamento automático de perfil já existente; os valores das demais colunas foram comparados com a branch cópia e permaneceram iguais. Nenhum registro anterior foi removido. O teste no navegador confirmou login, aba Marketing, calendário inicial, ausência de overflow horizontal e ausência de erros JavaScript.

A primeira inicialização remota retornou 503 durante a criação do schema. A execução autenticada das migrações no Neon existente passou, uma nova inicialização da implantação ficou saudável e `/api/db-status` confirmou conexão. Os logs de inicialização agora incluem o código e a mensagem do erro para futuros diagnósticos, sem imprimir parâmetros SQL ou credenciais.

Os 75 testes passaram. Dois testes de lembretes foram ajustados para verificar a ausência de reenvios da ocorrência de hoje, permitindo alertas legítimos da ocorrência de amanhã dentro da antecedência antes da meia-noite. Nenhuma regra de envio foi alterada.
## Recuperação de inicialização (503 intermitente)

Os logs de produção mostraram `Error connecting to database: TypeError: fetch failed` durante um cold start. O servidor guardava uma única Promise de inicialização rejeitada e todas as requisições seguintes daquela instância retornavam 503, mesmo após o Neon voltar a responder.

A inicialização agora é compartilhada por requisições concorrentes, tenta novamente até duas vezes em falhas transitórias e permite uma nova tentativa após cinco segundos caso a inicialização falhe. Erros de schema não recebem as tentativas rápidas de rede. As rotas continuam retornando 503 quando a conexão não está pronta; nenhuma gravação do usuário é repetida automaticamente. Apenas as migrações idempotentes são reexecutadas. Não há reset de tabelas, tarefas ou cache.

Testes de regressão cobrem falha transitória, requisições concorrentes, recuperação sem redeploy, bloqueio de gravações enquanto indisponível e ausência de repetição de gravações após recuperar.
