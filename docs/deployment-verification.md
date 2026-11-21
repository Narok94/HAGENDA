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

A comprovação final de produção depende do status Ready da Vercel e da execução da auditoria autenticada após esse deploy. Testes em cópia não substituem essa conferência.
