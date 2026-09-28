// Utilitários compartilhados pelas funções serverless.
// Arquivos iniciados com "_" não viram rotas na Vercel.

export function enviarJson(res, status, corpo) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (status === 200) {
    // Cache na borda da Vercel por 1h; serve versão antiga enquanto revalida.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  }
  res.end(JSON.stringify(corpo));
}

export function lerAnos(query) {
  const anos = Number(query.anos);
  return [1, 2, 5, 10].includes(anos) ? anos : null;
}

// Primeiro dia do mês, "anos" atrás, em UTC.
export function inicioDoPeriodo(anos, agora = new Date()) {
  return new Date(Date.UTC(agora.getUTCFullYear() - anos, agora.getUTCMonth(), 1));
}

export function lerQuery(req) {
  if (req.query) return req.query;
  const url = new URL(req.url, 'http://localhost');
  return Object.fromEntries(url.searchParams);
}
