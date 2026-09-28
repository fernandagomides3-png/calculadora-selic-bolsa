# Selic vs Bolsa

Aplicação web que compara o rendimento da taxa Selic com o de uma ação da B3 em janelas de 1, 2, 5 ou 10 anos, com aplicação inicial (padrão R$ 10.000,00) e aporte mensal (padrão R$ 500,00). Mostra o total investido, o valor bruto, o IR e o rendimento líquido de cada opção, além de um gráfico da evolução.

## Estrutura

```
index.html          página
css/style.css       estilos (tema claro/escuro)
js/app.js           interface, gráfico (Chart.js via CDN)
js/calculo.js       simulação mês a mês e cálculo do IR
api/cotacao.js      função serverless: preços mensais ajustados (Yahoo Finance)
api/selic.js        função serverless: Selic acumulada no mês (BCB, série SGS 4390)
scripts/dev-server.js  servidor local (não é enviado para a Vercel)
```

As funções em `api/` existem porque as APIs do Yahoo Finance e do Banco Central não liberam CORS para o navegador. As respostas ficam em cache na borda da Vercel por 1 hora.

## Rodar localmente

Requer Node.js 18+. Não há dependências para instalar.

```bash
npm run dev
# http://localhost:3000
```

## Deploy na Vercel

1. Envie o repositório para o GitHub.
2. Na Vercel, **Add New → Project**, importe o repositório.
3. Framework Preset: **Other**. Deixe Build Command e Output Directory em branco.
4. Deploy.

Ou pela CLI: `npx vercel` (e `npx vercel --prod` para produção).

## Premissas do cálculo

- Aplicação inicial no primeiro mês e aportes no fechamento de cada mês seguinte; o mesmo fluxo vale para os dois investimentos.
- Ação: preço de fechamento ajustado, ou seja, com dividendos reinvestidos. Meses sem cotação repetem o último preço.
- Selic: 100% da Selic acumulada no mês. No mês corrente, se o dado ainda não saiu, usa a última taxa proporcional aos dias corridos.
- IR em ações: 15% sobre o ganho no resgate, sem a isenção para vendas de até R$ 20 mil/mês.
- IR na Selic: tabela regressiva (22,5% / 20% / 17,5% / 15%) aplicada a cada aporte conforme o prazo dele.
- Não considera corretagem, taxa de custódia ou IOF.
