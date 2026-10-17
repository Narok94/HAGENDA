# Alertas por ocorrência

## Auditoria e modelo

Antes desta mudança, `/api/send-reminders` era público, não havia cron no repositório e `reminder_sent` era único por tarefa. O envio era marcado mesmo sem VAPID ou após falhas. A leitura de tarefas sobrescrevia dias de recorrência e podia excluir tarefas personalizadas. Essas alterações automáticas foram removidas. A coluna legada e os dados existentes são preservados.

As tabelas incrementais `reminder_configs`, `reminder_occurrences`, `reminder_deliveries`, `reminder_actions` e `reminder_scheduler` são criadas no primeiro início do backend, antes de atender APIs. A migração pode ser repetida. Nenhum alerta é ativado automaticamente; atividades sem configuração usam **Sem alerta**. As inscrições e chaves VAPID existentes são reutilizadas.

Cada configuração tem uma revisão. Cada ocorrência usa atividade + data de São Paulo. Cada entrega usa ocorrência + revisão + rodada + hash do endpoint. O worker tem uma concessão exclusiva de cinco minutos; cada entrega tem concessão de dois minutos e token de posse. Envia até 50 notificações por execução, com orçamento de 40 segundos antes de iniciar outra entrega e timeout de 10 segundos por chamada. Um segundo cron concorrente retorna 202. Após falha transitória, o dispositivo tenta novamente com espera exponencial até 60 minutos; os dispositivos que já receberam não são reenviados naquela rodada. 404/410 removem inscrições expiradas. Nenhuma falha é gravada como sucesso.

O sucesso registrado significa aceitação pelo serviço Web Push, não leitura nem entrega garantida pelo sistema operacional. Web Push não oferece confirmação transacional junto ao PostgreSQL: se o provedor aceitar e a conexão cair antes de gravar o sucesso, pode ocorrer reenvio. `topic` e `tag` estáveis por ocorrência reduzem duplicatas na fila e na tela. Uma notificação já em trânsito no instante da confirmação/exclusão também pode chegar; não é possível revogá-la remotamente. As verificações imediatamente antes de cada envio impedem os seguintes.

Alertas persistentes continuam enquanto a ocorrência materializada estiver pendente, inclusive em dias posteriores; confirme ou desative para encerrar. Atrasos não geram rajadas de intervalos perdidos. Ocorrências futuras são preparadas até amanhã, cobrindo antecedência de até 24h e virada da meia-noite. Um cursor persistido por configuração recupera datas desde sua ativação mesmo após interrupções longas, em lotes de até 32 datas por configuração e orçamento de 30 segundos para geração. O cursor só avança após processar a data; o próximo cron continua o lote. Ativar/editar uma configuração não recupera datas anteriores à edição. Uma ocorrência de hoje já atrasada pode começar imediatamente. Horários usam São Paulo, atualmente UTC−03:00; se as regras de horário de verão mudarem, a conversão em `firstDue` deve ser atualizada.

Conclusões nos formulários e nas rotinas integradas são registradas nas ocorrências para sobreviver à troca do estado diário. Reabrir visualmente uma atividade já confirmada não reativa a mesma ocorrência automaticamente. Alterações em horário/data/recorrência invalidam notificações anteriores. A exclusão da tarefa cancela sua configuração e encerra ocorrências em uma transação. A confirmação pela notificação é idempotente e limitada à data e revisão assinadas. Adiar usa o prazo individual e não modifica a série recorrente; repetir o mesmo comando não acumula adiamentos.

## Configuração externa

Configure no ambiente do backend, sem colocar valores no Git:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão Neon existente; obrigatória para alertas |
| `VITE_VAPID_PUBLIC_KEY` | Chave pública existente, também no build do frontend |
| `VAPID_PRIVATE_KEY` | Chave privada existente, somente servidor |
| `VAPID_SUBJECT` | Contato VAPID, por exemplo `mailto:contato@hagenda.app` |
| `APP_ACCESS_TOKEN` | Código privado de acesso ao aplicativo; obrigatório em produção |
| `CRON_SECRET` | Segredo exclusivo do scheduler |
| `REMINDER_ACTION_SECRET` | Segredo independente para assinar ações |
| `REMINDERS_ENABLED` | `true` ativa envios; qualquer outro valor mantém desativado |

Gere os três novos segredos com pelo menos 32 bytes aleatórios cada. Não use o prefixo `VITE_` para segredos. O código de acesso autentica este aplicativo de usuário único; não há separação entre contas. Todos os dispositivos inscritos pertencem ao mesmo usuário. O login grava cookie HttpOnly, Secure em produção, SameSite Strict e validade de 30 dias. Rotacionar o código encerra sessões. O endpoint de ações aceita uma capacidade HMAC válida por sete dias, sem precisar da sessão do navegador. Tokens ficam no fragmento da URL para não irem em logs HTTP. Rotacionar o segredo de ações invalida notificações antigas.

`vercel.json` declara `GET /api/send-reminders` a cada minuto e duração máxima de 60s. Vercel envia `Authorization: Bearer <CRON_SECRET>`. É necessário um plano que permita cron por minuto e essa duração. No Hobby, use um scheduler externo por minuto e remova a propriedade `crons` antes do deploy; mantenha o mesmo endpoint HTTPS e cabeçalho secreto. Um processo Node próprio também precisa desse scheduler externo. Não execute simultaneamente schedulers desnecessários, embora o lock proteja contra sobreposição.

Referências: [Vercel: gerenciar e proteger cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [limites de frequência](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## Ativação e verificação operacional

1. Configure Neon, VAPID e os segredos, mantendo `REMINDERS_ENABLED=false`. Publique e confira que `/api/settings` exige acesso e `/api/send-reminders` rejeita chamadas sem o segredo do cron.
2. Entre no aplicativo com `APP_ACCESS_TOKEN`. Ative notificações em cada dispositivo usando o fluxo existente. Configure apenas **uma** atividade de teste para poucos minutos à frente.
3. Confirme a criação e execução do cron no painel de produção. Só existir `vercel.json` não comprova que o scheduler esteja ativo. Depois habilite `REMINDERS_ENABLED=true`.
4. Consulte `GET /api/reminders` com sessão para inspecionar `scheduler.last_started_at`, `last_finished_at`, `last_error`, `sent_count`. Com o worker habilitado, as duas datas devem avançar a cada execução. Datas ausentes/antigas indicam configuração ou execução pendente. Desativado, o endpoint do cron retorna `{enabled:false}` sem envios e sem heartbeat de processamento.
5. Com o PWA fechado, verifique o teste nos dispositivos desejados, confirmação, repetição, adiamento e exclusão. Verifique falhas nos registros `reminder_deliveries` sem imprimir subscriptions, tokens ou credenciais em logs. Desative a atividade de teste após validar.

Nesta implementação, testes automatizados usam PostgreSQL local em memória (PGlite), remetente simulado e servidor HTTP local. Não acessam Neon, endpoints Web Push nem enviam mensagens reais. Não havia `.env` nem acesso operacional ao projeto Vercel/Neon nesta execução: aplicação da migração em Neon, execução real do cron e teste em iPhone instalado dependem da configuração externa.

## Interface e limites de dispositivos

No formulário/detalhes de cada atividade, o bloco compacto permite escolher modo, antecedência, repetição de 5/10/15/30 min ou personalizada, prazo de adiamento e horário. Atividades virtuais de dieta, academia e estudo mantêm seus dados e recebem configuração própria quando visíveis na Agenda. Água tem configuração na aba Dieta, em **Lembrete de água**, com confirmação da meta diária de 3 L. Atividades flexíveis precisam de um horário de alerta.

O Service Worker oferece Confirmar, Adiar e Abrir quando o dispositivo permite botões. O toque na notificação abre a atividade e um diálogo com as mesmas ações. Falha/offline abre o fluxo de nova tentativa e não informa confirmação bem-sucedida. Não há repetição dependente do aplicativo aberto, timer de push no navegador, alteração de viewport ou mudança no CSS global.

No iPhone, Web Push exige aplicativo adicionado à Tela de Início e permissão solicitada por gesto do usuário. O sistema decide som, botões disponíveis, entrega e atrasos (incluindo Foco e conectividade). Não há promessa de som contínuo ou despertador exato. Veja [WebKit: Web Push no iOS/iPadOS](https://webkit.org/blog/13878/) e [Apple: envio de Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).

## Validação local

```sh
npm run lint
npm test
npm run build
```

Os testes verificam política, recorrências, virada da meia-noite, migração repetida, exclusão, autenticação, idempotência, concorrência, confirmação, adiamento e falhas parciais entre dispositivos. Um teste em dispositivo físico ainda é necessário para confirmar comportamento do iOS instalado e permissões de cada dispositivo.

Com Playwright e seus navegadores disponíveis, os scripts opcionais `node scripts/check-reminder-ui.cjs http://127.0.0.1:3000` e `node scripts/check-pwa-layout.cjs http://127.0.0.1:3000` verificam o formulário e o viewport em Chromium/WebKit. O primeiro simula todas as APIs. Nesta execução ambos passaram, incluindo 375px e cenários de teclado/standalone. Isso não substitui teste de iPhone físico.
