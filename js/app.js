import { simular } from './calculo.js';

const ACOES = [
  ['PETR4', 'Petrobras PN'], ['VALE3', 'Vale ON'], ['ITUB4', 'Itaú Unibanco PN'],
  ['BBDC4', 'Bradesco PN'], ['BBAS3', 'Banco do Brasil ON'], ['ABEV3', 'Ambev ON'],
  ['WEGE3', 'WEG ON'], ['B3SA3', 'B3 ON'], ['ITSA4', 'Itaúsa PN'], ['MGLU3', 'Magazine Luiza ON'],
  ['RENT3', 'Localiza ON'], ['SUZB3', 'Suzano ON'], ['ELET3', 'Eletrobras ON'], ['GGBR4', 'Gerdau PN'],
  ['LREN3', 'Lojas Renner ON'], ['RADL3', 'Raia Drogasil ON'], ['EQTL3', 'Equatorial ON'],
  ['PRIO3', 'PRIO ON'], ['TAEE11', 'Taesa Unit'], ['EGIE3', 'Engie Brasil ON'],
  ['SBSP3', 'Sabesp ON'], ['CMIG4', 'Cemig PN'], ['BBSE3', 'BB Seguridade ON'],
  ['BOVA11', 'ETF Ibovespa'], ['IVVB11', 'ETF S&P 500'],
];

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (mes) => { const [a, m] = mes.split('-'); return `${NOMES_MES[m - 1]}/${a.slice(2)}`; };

const form = $('#form');
const botao = $('#botao');
const erroEl = $('#erro');
const resultadoEl = $('#resultado');
let grafico = null;
let ultimaSimulacao = null;

$('#acoes').innerHTML = ACOES.map(([t, n]) => `<option value="${t}">${n}</option>`).join('');

async function buscar(url) {
  const r = await fetch(url);
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.erro || 'Falha ao buscar dados.');
  return corpo;
}

function lerNumero(input, padrao) {
  const n = Number(String(input.value).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : padrao;
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const ticker = $('#ticker').value.trim().toUpperCase();
  const anos = Number(form.anos.value);
  const inicial = lerNumero($('#inicial'), 10000);
  const aporte = lerNumero($('#aporte'), 500);
  const descontarIR = $('#ir').checked;

  if (!ticker) return mostrarErro('Informe o código de uma ação (ex.: PETR4).');
  if (inicial + aporte <= 0) return mostrarErro('Informe uma aplicação inicial ou um aporte mensal.');

  mostrarErro('');
  botao.disabled = true;
  botao.textContent = 'Calculando…';
  try {
    const [cotacao, selic] = await Promise.all([
      buscar(`/api/cotacao?ticker=${encodeURIComponent(ticker)}&anos=${anos}`),
      buscar(`/api/selic?anos=${anos}`),
    ]);
    const sim = simular({ precos: cotacao.precos, taxas: selic.taxas, inicial, aporte, descontarIR });
    renderizar({ sim, cotacao, anos, aporte, descontarIR });
  } catch (e) {
    mostrarErro(e.message);
    resultadoEl.hidden = true;
  } finally {
    botao.disabled = false;
    botao.textContent = 'Comparar';
  }
});

function mostrarErro(msg) {
  erroEl.textContent = msg;
  erroEl.hidden = !msg;
}

function renderizar({ sim, cotacao, anos, aporte, descontarIR }) {
  resultadoEl.hidden = false;
  ultimaSimulacao = { sim, ticker: cotacao.ticker };

  const numAportes = sim.meses.length - 1;
  $('#totalInvestido').textContent = brl.format(sim.investido);
  $('#detalheInvestido').textContent =
    `Aplicação inicial + ${numAportes} aportes de ${brl.format(aporte)} · ${rotuloMes(sim.meses[0])} a ${rotuloMes(sim.meses.at(-1))}`;

  const esperado = anos * 12 + 1;
  const aviso = $('#aviso');
  aviso.hidden = sim.meses.length >= esperado;
  aviso.textContent = `${cotacao.ticker} só tem histórico a partir de ${rotuloMes(sim.meses[0])}; a comparação usa esse período para os dois investimentos.`;

  $('#tituloAcao').textContent = cotacao.ticker;
  $('#tituloAcao').title = cotacao.nome;
  $('#legendaAcao').textContent = cotacao.ticker;

  const melhor = sim.acao.liquido >= sim.selic.liquido ? 'acao' : 'selic';
  for (const serie of ['acao', 'selic']) {
    const card = $(`.card[data-serie="${serie}"]`);
    const r = sim[serie];
    const campo = (nome) => $(`[data-campo="${nome}"]`, card);
    campo('rendimento').textContent = brl.format(r.rendimento);
    campo('rendimento').classList.toggle('negativo', r.rendimento < 0);
    campo('rentabilidade').textContent = `${pct.format(r.rentabilidade)} sobre o investido`;
    campo('bruto').textContent = brl.format(r.bruto);
    campo('ir').textContent = descontarIR ? `− ${brl.format(r.ir)}` : 'não descontado';
    campo('liquido').textContent = brl.format(r.liquido);
    $('.selo', card).hidden = serie !== melhor;
    card.classList.toggle('vencedor', serie === melhor);
  }

  renderizarTabela(sim, cotacao.ticker);
  renderizarGrafico();
}

function renderizarTabela(sim, ticker) {
  const linhas = sim.meses.map((m, i) =>
    `<tr><td>${rotuloMes(m)}</td><td>${brl.format(sim.serieInvestido[i])}</td>` +
    `<td>${brl.format(sim.serieAcao[i])}</td><td>${brl.format(sim.serieSelic[i])}</td></tr>`);
  $('#tabela').innerHTML =
    `<thead><tr><th>Mês</th><th>Investido</th><th>${ticker}</th><th>Selic</th></tr></thead>` +
    `<tbody>${linhas.join('')}</tbody>`;
}

function renderizarGrafico() {
  if (!ultimaSimulacao || !window.Chart) return;
  const { sim, ticker } = ultimaSimulacao;
  const css = getComputedStyle(document.documentElement);
  const cor = (v) => css.getPropertyValue(v).trim();

  const compacto = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
  const linha = (label, data, borderColor, extra = {}) => ({
    label, data, borderColor, backgroundColor: borderColor,
    borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2,
    pointHoverBorderColor: cor('--superficie'), tension: 0.15, ...extra,
  });

  grafico?.destroy();
  grafico = new Chart($('#grafico'), {
    type: 'line',
    data: {
      labels: sim.meses.map(rotuloMes),
      datasets: [
        linha(ticker, sim.serieAcao, cor('--serie-acao')),
        linha('Selic', sim.serieSelic, cor('--serie-selic')),
        linha('Total investido', sim.serieInvestido, cor('--serie-investido'), { borderDash: [5, 4], borderWidth: 1.5 }),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: cor('--superficie'),
          titleColor: cor('--texto'),
          bodyColor: cor('--texto-sec'),
          borderColor: cor('--borda'),
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          callbacks: { label: (c) => ` ${c.dataset.label}: ${brl.format(c.parsed.y)}` },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: cor('--eixo') },
          ticks: { color: cor('--texto-mudo'), maxRotation: 0, autoSkipPadding: 16 },
        },
        y: {
          grid: { color: cor('--grade') },
          border: { display: false },
          ticks: { color: cor('--texto-mudo'), callback: (v) => compacto.format(v) },
        },
      },
    },
  });
}

// Redesenha o gráfico com as cores do tema quando o sistema alterna claro/escuro.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderizarGrafico);

// Primeira simulação com os valores padrão, assim que o Chart.js carregar.
window.addEventListener('load', () => form.requestSubmit());
