// GET /api/cotacao?ticker=PETR4&anos=5
// Retorna preços mensais ajustados (proventos e desdobramentos) via Yahoo Finance.
import { enviarJson, inicioDoPeriodo, lerAnos, lerQuery } from './_util.js';

const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

export default async function handler(req, res) {
  const query = lerQuery(req);
  const anos = lerAnos(query);
  const ticker = String(query.ticker || '').trim().toUpperCase();

  if (!anos) return enviarJson(res, 400, { erro: 'Parâmetro "anos" deve ser 1, 2, 5 ou 10.' });
  if (!/^[A-Z0-9^][A-Z0-9.\-]{0,14}$/.test(ticker)) {
    return enviarJson(res, 400, { erro: 'Ticker inválido.' });
  }

  // Ações da B3 no Yahoo usam o sufixo .SA
  const simbolo = ticker.includes('.') || ticker.startsWith('^') ? ticker : `${ticker}.SA`;
  const period1 = Math.floor(inicioDoPeriodo(anos).getTime() / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  const caminho = `/v8/finance/chart/${encodeURIComponent(simbolo)}` +
    `?period1=${period1}&period2=${period2}&interval=1mo&events=div,split`;

  let dados = null;
  let ultimoStatus = 502;
  for (const host of HOSTS) {
    try {
      const r = await fetch(`https://${host}${caminho}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (calculadora-selic-bolsa)' },
      });
      ultimoStatus = r.status;
      if (r.ok) { dados = await r.json(); break; }
      if (r.status === 404) break;
    } catch {
      // tenta o próximo host
    }
  }

  const resultado = dados?.chart?.result?.[0];
  if (!resultado?.timestamp) {
    const status = ultimoStatus === 404 ? 404 : 502;
    const erro = status === 404
      ? `Ação "${ticker}" não encontrada.`
      : 'Não foi possível obter as cotações agora. Tente novamente em instantes.';
    return enviarJson(res, status, { erro });
  }

  const offset = resultado.meta?.gmtoffset ?? -10800;
  const ajustados = resultado.indicators?.adjclose?.[0]?.adjclose ?? [];
  const fechamentos = resultado.indicators?.quote?.[0]?.close ?? [];

  // Um ponto por mês (AAAA-MM). Se houver duplicata, fica o mais recente.
  const porMes = new Map();
  resultado.timestamp.forEach((ts, i) => {
    const preco = ajustados[i] ?? fechamentos[i];
    if (preco == null || !Number.isFinite(preco)) return;
    const d = new Date((ts + offset) * 1000);
    const mes = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    porMes.set(mes, preco);
  });

  const precos = [...porMes].map(([mes, preco]) => ({ mes, preco }));
  if (precos.length < 2) {
    return enviarJson(res, 404, { erro: `Histórico insuficiente para "${ticker}" no período.` });
  }

  enviarJson(res, 200, {
    ticker,
    nome: resultado.meta?.longName || resultado.meta?.shortName || ticker,
    moeda: resultado.meta?.currency || 'BRL',
    precos,
  });
}
