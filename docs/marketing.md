# Marketing

A aba usa a autenticação existente (`APP_ACCESS_TOKEN`, cookie HttpOnly). O aplicativo atual tem um único proprietário, sem cadastro de contas; `owner_id` vem exclusivamente do servidor (`APP_USER_ID`, padrão estável `hagenda-owner`). Nenhum ID de usuário enviado pelo navegador é aceito. Para instalações independentes no mesmo Neon, configure um `APP_USER_ID` distinto e mantenha-o estável. Isso não adiciona um sistema multiusuário ao acesso existente.

## Persistência e importação inicial

`migrateMarketing` cria apenas três tabelas novas: `marketing_posts`, `marketing_brands` e `marketing_imports`. As tabelas existentes não são modificadas pela funcionalidade Marketing. Todas as consultas incluem o proprietário. Atualizações e exclusões exigem a revisão lida, prevenindo sobrescritas entre dispositivos.

No primeiro acesso autenticado após a implantação, `/api/marketing` importa os calendários para o Neon já configurado em `DATABASE_URL`, numa transação com bloqueio por proprietário. Antes de inserir, verifica equivalentes por marca, data e título normalizados. Registros existentes são preservados. Um marcador impede reimportar publicações posteriormente editadas, reagendadas ou excluídas.

Fontes transcritas e conferidas visualmente:

- `calendario_passione_23nov_06dez_2026.pdf`: 14 publicações, 23/11 a 06/12/2026, com horários e orientações gerais preservados. Rede e legendas não foram informadas e permanecem vazias.
- `calendario_narok_23_a_29_novembro_2026.pdf`: 10 publicações, 23 a 29/11/2026, no Instagram. Os Stories adicionais de segunda, terça e quarta são registros separados. Nenhum horário foi informado; a interface apresenta “A definir”.

Os registros recebem o status operacional `Planejado`; métricas não informadas ficam vazias. Nenhuma tarefa é criada para espelhar publicações: dashboard e Marketing compartilham a mesma lista carregada de `marketing_posts`.

## JSON do ChatGPT

A tela aceita uma lista JSON ou `{ "publications": [...] }`, com prévia e confirmação. Exemplo:

```json
[
  {
    "brand": "Passione",
    "network": "Instagram",
    "format": "Story",
    "title": "Título da publicação",
    "instructions": "Orientações de produção",
    "caption": "",
    "date": "2026-11-23",
    "time": "",
    "status": "Planejado"
  }
]
```

Marca, título, data e status são obrigatórios. Os demais campos textuais ausentes ficam vazios. Datas reais em `AAAA-MM-DD`, horários vazios ou `HH:MM`, até 100 registros por lote. Status: `Ideia`, `Planejado`, `Em produção`, `Pronto`, `Publicado`. A validação também ocorre no servidor, antes de iniciar qualquer inserção. Uma restrição única por proprietário, marca, data e título normalizados evita duplicatas no mesmo lote e entre importações simultâneas. A prévia informa duplicatas; o resultado do servidor é a confirmação definitiva.

`metrics` aceita inteiros não negativos em `alcance`, `curtidas`, `comentarios`, `compartilhamentos`, `salvamentos`, `novosSeguidores`. Anexos manuais são imagens PNG/JPEG/WebP/GIF ou PDFs, até cinco e 2 MB no total por publicação, persistidos no próprio registro. Não há publicação automática nem chamadas a serviços externos de marketing.

## Verificação

- `npm run lint`
- `npm test`: PostgreSQL isolado via PGlite; cobre importação inicial, equivalentes existentes, exclusões, isolamento, CRUD, reagendamento, métricas, anexos, duplicatas, validação de lote e conflitos de revisão. Também cobre falha explícita de todas as novas rotas quando o Neon não está disponível.
- `npm run build`

A verificação visual usa dados e banco isolados; não confirma que o deployment de produção executou a importação. A importação real exige a implantação e um acesso autenticado com o Neon configurado.
