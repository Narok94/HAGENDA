# Investigação do deploy e confirmação do Marketing

## Correção de empacotamento

Os sete módulos auxiliares do backend passaram a usar nomes iniciados por `_` na pasta `api/`. A Vercel ignora esses nomes na descoberta de funções; `api/index.ts` permanece como a única função publicada. Os caminhos HTTP e os handlers Express continuam iguais. Nenhuma migração ou regra de importação foi alterada.

A documentação oficial descreve essa convenção: https://vercel.com/docs/functions/configuring-functions/advanced-configuration#adding-utility-files-to-the-api-directory

O builder oficial `@vercel/node@32.0.0` confirmou que, antes da correção, `api/marketing.ts` também era empacotado como função independente. Depois da correção, a descoberta encontrou apenas `api/index.ts`. A função emitida foi importada e exercitada via HTTP, preservando autenticação e falha explícita sem Neon. Esse teste usa credenciais fictícias e não acessa produção.

Isso corrige um problema estrutural observado. Sem os logs privados, não comprova que esse era o motivo específico da falha `dpl_FjQDwJS7825mjfVBJzMwjXK2FAwy` associada a `e42aab9`.

## Cron existente

O cron de lembretes por minuto foi preservado. O plano Hobby recusa frequências menores que um dia; Pro e Enterprise permitem execução por minuto. É preciso conferir o plano e os logs da conta antes de atribuir a falha ao cron. Não reduzir a frequência nem removê-lo sem prover uma alternativa que preserve os lembretes.

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

## Bloqueios de acesso observados

Na investigação, o GitHub confirmou o estado `failure` do deploy original. Os detalhes e logs da Vercel redirecionaram para login. Não havia credenciais Vercel/Neon no ambiente local, nem conexões confirmadas com esses serviços. A URL de deployment também exigia autenticação, portanto uma resposta HTTP 200 da tela de login não comprova que o aplicativo foi implantado.

Builds locais, testes com PGlite e o smoke test do builder não confirmam implantação nem contagem no Neon de produção. Esses resultados devem ser reportados separadamente até existir autenticação para executar a auditoria real.
