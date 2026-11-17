# Persistência e concorrência de tarefas

As listas e contagens exibem o estado confirmado pelo servidor. Cada intenção é gravada antes do envio em uma chave própria `momentum_task_pending:<uuid>` no localStorage. Criação manual, IA/voz, conclusão, edição, exclusão, desfazer, adiamento, estudos, dieta e treino usam a mesma fila. A criação usa UUID estável nas novas tentativas. O texto/áudio ainda não convertido em tarefa permanece no formulário/aba; após a conversão, os campos da tarefa ficam na fila durável.

Erros HTTP, rede, timeout, JSON inválido e confirmação incompleta mantêm a operação pendente. A interface oferece nova tentativa; conexão recuperada, foco, recarga e mensagens de notificações também retomam a sincronização. Se o armazenamento local falhar, a alteração fica em memória com aviso para manter a aba aberta; ela não é enviada sem registro local verificado. Dados locais ilegíveis são preservados.

Requisições de uma instância são serializadas. Web Locks coordenam abas quando disponíveis; cada operação usa uma chave independente e a comparação no PostgreSQL continua protegendo gravações entre abas/dispositivos. A leitura ao recuperar foco não substitui a fila nem a base original das alterações. Campos independentes são conciliados por comparação entre base, intenção e servidor; datas de conclusão são conciliadas por dia. Conflitos no mesmo campo exigem decisão explícita, com valores atuais e locais disponíveis na interface. Totais de água concorrentes são tratados de forma conservadora, pois igualdade de quantidade não comprova que dois incrementos foram executados. Pendências de dias/grupos antigos não substituem o progresso atual.

No adiamento recorrente, as duas etapas ficam em um único registro local: primeiro persiste a cópia, depois conclui a ocorrência original. Uma falha intermediária mantém o registro completo para retomada, sem esconder a ocorrência antes de salvar a cópia.

## Contrato da API

- `GET /tasks` retorna `version` opaca em cada tarefa e `Cache-Control: no-store`.
- `POST /tasks` sem versão é criação exclusiva. Atualizações exigem a versão recebida na leitura. Colisão, versão antiga ou tarefa removida retornam `409`; uma atualização antiga nunca recria uma tarefa excluída.
- `DELETE /tasks/:id` exige `If-Match: <version>` (`428` se omitido). A exclusão e os efeitos sobre lembretes são atômicos; uma versão antiga não altera nada.
- `GET /settings`, `/diet-state` e `/workout-state` também retornam a versão (`null` se ainda não existir registro). Gravações de dieta/treino e de histórico de estudos exigem `If-Match`; `absent` representa criação exclusiva. Atualizações de perfil sem histórico continuam parciais, preservando campos omitidos.
- A versão usa `xmin::text`, atualizado pelo próprio PostgreSQL em qualquer gravação, inclusive ações de notificações. Esta correção não adiciona colunas, tabelas ou migrações. Os testes não carregam conexão de produção.
- Reaberturas explícitas informam apenas as conclusões removidas. Novas tentativas reaplicam esses efeitos de forma idempotente, preservando o restante do histórico e os lembretes de outras atividades. A API só confirma a operação após esses efeitos; falhas intermediárias permanecem na fila.

## Verificação local

`npm test` executa testes de SQL em PGlite em memória, rotas HTTP locais e transporte simulado. Inclui concorrência, resposta perdida após commit, exclusão/desfazer, recuperação do journal, conflitos, timeout, adiamento parcial e integração entre cliente e SQL reais. O teste da aplicação sem banco desativa dotenv e remove `DATABASE_URL` antes de importar a API.

Para verificar a interface, inicie apenas Vite (`node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4179 --strictPort`) e execute `node scripts/check-task-persistence.cjs` com Playwright disponível e Chrome instalado. Todas as APIs são interceptadas; a voz usa microfone sintético. Nenhuma tarefa, reset ou notificação é enviada a serviços reais.
