# Investigação do rodapé iOS — 2026-10-15

## Atualização após o teste real de fundo vermelho — 2026-10-17

O usuário confirmou no iPhone 11 que a faixa inferior muda para vermelho quando
html/body recebem fundo vermelho. Informou screen.height=896,
visualViewport.height=848, nav.bottom=848, gapBelowNav=0 e inset inferior=34.
Isso comprova a exposição do fundo da página, mas não mede a altura CSS de
100vh, o tamanho completo de root/shell ou a origem física da WebView.
896−848=48 não é igual ao inset de 34px. Não se deve somar nenhum deles ao root
nem usar screen.height como altura utilizável: a tela inclui áreas do sistema.

A implementação anterior forçava o root a visualViewport.height, reproduzindo
qualquer subdimensionamento que a API reportasse. gapBelowNav=0 só comparava nav
com a mesma API usada para dimensionar o root; não comprovava cobertura física.
O teste vermelho é evidência adicional, não uma validação dessa cobertura.

A estratégia foi ajustada para standalone: html usa a altura CSS 100vh, body
acompanha html e root/shell ocupam essa mesma altura. Assim a cadeia percentual
não continua presa ao tamanho reduzido anterior de html/body. A detecção usa
display-mode:standalone ou navigator.standalone. A altura normal deixa de ser
sobrescrita pela VisualViewport. Safari em aba continua seguindo a viewport
visível e suas barras. O fundo vermelho foi retirado, sem alterar a cor da nav
ou pintar a faixa com uma cor de disfarce.

No standalone, a API visual só dimensiona root durante uma redução observada
com foco em campo editável, comparada à própria altura visual em repouso. A
redução permanece ativa durante a animação de fechamento e é retirada quando a
altura visual retorna. Nenhuma diferença CSS/visual em repouso é tratada como
teclado. Não há screen.height no cálculo, soma de insets, altura numérica fixa,
margem negativa ou nova regra de overflow para ocultar a área. O inset continua
reservado uma vez no nav; main continua como scrollport da página.

O WebKit registra que visualViewport/svh podem excluir espaço de PWAs com
viewport-fit=cover, e aponta vh para a altura CSS de standalone:
https://bugs.webkit.org/show_bug.cgi?id=254868 (comentários 2 e 3).
Isso sustenta a mudança de estratégia, mas não confirma a versão do bug no
aparelho do usuário. Há também relatos de áreas do sistema que usam a cor da
página e não são acessíveis ao DOM:
https://bugs.webkit.org/show_bug.cgi?id=301994 (comentário 12).
Portanto, vermelho no fundo NÃO basta para excluir um problema nativo do iOS.

A validação local inclui o cenário sintético com viewport CSS 414×896 e API
visual de 848px: standalone mantém root/nav em 896; navegador mantém 848. Isso
não afirma que 100vh será 896 no iPhone real. O painel foi preservado para medir
root, html/body e nav após o deploy e confirmar visualmente o limite utilizável.
Também são testadas redução/pan do teclado, restauração, quatro dimensões,
conteúdo longo, troca das três telas e inset único em WebKit/Chromium.

Validação desta atualização: TypeScript e build aprovados. O script de layout
passou nos 32 cenários (2 motores × 4 dimensões × 4 modos) contra o build de
produção, incluindo a diferença CSS/API de 48px, foco sem teclado, redução/pan,
restauração e navegação. O teste do painel de diagnóstico passou nos dois
motores. Inspeção visual local em 414×896 também realizada.

**Sem iPhone/PWA real disponível nesta sessão, a resolução permanece pendente
de validação no aparelho.** Depois do deploy, coletar o painel com teclado
fechado, aberto e fechado novamente, junto da versão iOS e de uma captura do
rodapé. A conferência física deve confirmar controles acima do indicador de
início e fundo até a borda. As medições simuladas não substituem esse teste.

## Histórico da investigação anterior (antes do teste vermelho)

## Estado e limite da conclusão

A faixa branca do iPhone não foi reproduzida no ambiente local. Não há Safari
em iPhone, PWA instalado ou teclado iOS disponíveis nesta sessão. Portanto, a
causa específica no aparelho continua pendente e esta alteração NÃO confirma
que o problema relatado esteja resolvido. WebKit desktop com viewport mobile
não equivale ao Safari/PWA iOS. Os testes sintéticos não são medições do aparelho.

## Cascata anterior

- `html`, `body` e `#root`: altura percentual de 100%, com overflow hidden.
- Shell: fixed/inset:0. Em browsers com dvh: height:100dvh e bottom:auto.
  Em standalone: height:100% e bottom:0 sobrescreviam essas propriedades.
  Com top, bottom e altura explícitos, bottom não constituía uma segunda
  garantia independente de preenchimento: a altura continuava sendo a regra
  que dimensionava o shell.
- Main: flex:1, min-height:0, overflow-y:auto. O padding inferior do Dashboard
  incluía safe area, mas era sobrescrito pela regra de 16px com !important.
  Não havia evidência de padding duplicado efetivo nessa versão.
- Nav: flex-shrink:0, position:relative, no fluxo do shell. Position:relative
  não deslocava o nav, pois não existiam offsets. Sua borda inferior acompanhava
  a borda do shell, não uma medição independente da área visível.
- `--app-safe-bottom` cortava o inset em 34px sem medição que justificasse o corte.
- A meta viewport já continha viewport-fit=cover; manifest já era standalone.
- As classes Tailwind estão em camadas; regras CSS autorais sem camada
  prevalecem sobre suas utilidades. Não foi encontrado ancestral transformado
  de root/shell/nav. Transforms em cartões e modais não são ancestrais do nav.

A falha verificável na estratégia era usar referências de altura diferentes por
modo, sem acompanhar a visualViewport quando ela muda independentemente da
viewport de layout (por exemplo, teclado). Isso é um risco demonstrável em teste
sintético, mas não prova a origem da faixa branca da foto. A alegação anterior de
que o inset do aparelho estaria excessivo também não tinha medição comprobatória.

## Estratégia atual

`useAppViewport` mede `visualViewport.height` e `pageTop` na montagem, resize,
scroll e pageshow. O root absoluto usa altura e posição medidas em coordenadas
do documento. O shell ocupa 100% desse root, sem fixed, inset ou bifurcação por
standalone. Sem a API, o CSS usa 100dvh (ou 100% em browsers antigos).

O nav permanece no fluxo flex. Main é o único scrollport de página e tem
min-height:0. Root e shell não recortam overflow. Html/body continuam sem rolagem
para atribuir a rolagem ao main, não para esconder diferença de dimensões.
Os overlays existentes continuam com seus próprios controles de rolagem.

O inset inferior real é reservado uma vez no nav; o fundo do próprio nav cobre
esse espaço. Não há clamp de 34px, margem negativa, altura arbitrária do shell
ou espaçador com altura de rodapé. O padding de 16px do conteúdo é apenas o
respiro visual já existente; as regras inferiores concorrentes foram removidas.

## Medições locais

WebKit, viewport mobile 390×844, inset nativo local de 0px:

| Medida | Antes | Depois |
| --- | ---: | ---: |
| innerHeight | 844 | 844 |
| visualViewport.height | 844 | 844 |
| html/body height | 844 | 844 |
| root height | 844 | 844 |
| shell height | 844 | 844 |
| nav.bottom | 844 | 844 |
| main.bottom / nav.top | 785 | 785 |

Não havia deslocamento local antes da mudança. No teste de teclado/pan
sintético, mantendo innerHeight em 844: visualViewport.height=300 e pageTop=80
produzem root/shell height=300 e nav.bottom=380. Ao restaurar height=844 e
top=0, nav.bottom volta a 844. Esses são valores de teste, não medidas iOS.

## Verificação automatizada

Ferramenta opcional: Playwright 1.64.1 e browsers WebKit/Chromium instalados.
Caso indisponíveis, instalar separadamente sem alterar as dependências da app:
`npm install --no-save --package-lock=false playwright@1.64.1` e
`npx playwright install webkit chromium`.

Com `npm run dev` ativo: `node scripts/check-pwa-layout.cjs`.
Também aceita URL de um `vite preview`, para testar o build de produção.

O script verifica ambos os motores, 390×844, 375×667 e 844×390, navegação
Dashboard/Calendário/Mais, resize/restauração, ausência de VisualViewport,
insets simulados de 0/21/34/96px e conteúdo longo rolando apenas no main.
Verifica também resize/pan/restauração sintéticos de teclado com innerHeight
inalterado. O cenário chamado synthetic standalone apenas fornece
navigator.standalone e eventos da API: não instala PWA, não altera o display-mode
real e não abre teclado nativo. Não há CSS específico de standalone a emular.

Execução desta alteração: TypeScript (`npm run lint`) e `npm run build`
aprovados. O script passou nos 18 cenários (2 motores × 3 tamanhos × 3 modos)
contra o build de produção servido por `vite preview`, incluindo a troca de
telas durante os estados sintéticos do teclado e restauração. Screenshot mobile
foi inspecionado; essa inspeção local não substitui a verificação no iPhone.

## Coleta necessária no iPhone

No Safari e depois no PWA instalado, usar o inspetor remoto e executar o trecho
abaixo. Repetir com teclado fechado, aberto, fechado novamente, mudança de
orientação, retorno do background e alternância das três telas. Registrar
versão iOS, modelo e URL/deploy; confirmar que o aparelho recebeu o build novo.

```js
window.stopHagendaViewportProbe?.();
(() => {
  const snapshot = () => {
    const vv = window.visualViewport;
    const rows = ['html', 'body', '#root', '.hagenda-app-shell', 'main', 'nav'].map(selector => {
      const element = document.querySelector(selector);
      const rect = element.getBoundingClientRect();
      const css = getComputedStyle(element);
      return { selector, top: rect.top, bottom: rect.bottom, height: rect.height,
        clientHeight: element.clientHeight, scrollHeight: element.scrollHeight,
        position: css.position, paddingBottom: css.paddingBottom,
        overflowY: css.overflowY };
    });
    const nav = document.querySelector('nav').getBoundingClientRect();
    console.log(JSON.stringify({ time: new Date().toISOString(),
      standalone: navigator.standalone || matchMedia('(display-mode: standalone)').matches,
      innerHeight, scrollY, viewport: vv && { height: vv.height,
        offsetTop: vv.offsetTop, pageTop: vv.pageTop, scale: vv.scale },
      gapBelowNav: vv ? vv.offsetTop + vv.height - nav.bottom : innerHeight - nav.bottom,
      rows }));
  };
  const targets = [[window, 'resize'], [window, 'pageshow'],
    [document, 'focusin'], [document, 'focusout']];
  if (visualViewport) targets.push([visualViewport, 'resize'], [visualViewport, 'scroll']);
  targets.forEach(([target, event]) => target.addEventListener(event, snapshot));
  window.stopHagendaViewportProbe = () => targets.forEach(([target, event]) =>
    target.removeEventListener(event, snapshot));
  snapshot();
})();
```

Esperado após estabilizar cada transição: root/shell height coincide com a
altura visível; nav.bottom coincide com offsetTop+height; main.bottom coincide
com nav.top. Um gap positivo indica área fora do nav. Gap zero com muito branco
dentro do nav exige investigar o padding computado e o inset reportado, sem
presumir que o valor nativo está errado. Confirmar visualmente o fundo até a
borda, controles fora do indicador de início e último conteúdo alcançável.

Referência da API: https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
