// GET /api/selic?anos=5
// Retorna a taxa Selic acumulada no mês (% a.m.) — série SGS 4390 do Banco Central.
import { enviarJson, inicioDoPeriodo, lerAnos, lerQuery } from './_util.js';

const fmt = (d) =>
  `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

// A API do BCB falha de forma intermitente; tenta algumas vezes antes de desistir.
async function buscarComRetentativas(url, tentativas = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (calculadora-selic-bolsa)' },
        signal: AbortSignal.timeout(3000),
      });
      if (!r.ok) throw new Error(`BCB ${r.status}`);
      const dados = await r.json();
      if (!Array.isArray(dados)) throw new Error('Resposta inesperada do BCB');
      return dados;
    } catch (e) {
      if (i >= tentativas) throw e;
      await new Promise((ok) => setTimeout(ok, 300 * i));
    }
  }
}

export default async function handler(req, res) {
  const anos = lerAnos(lerQuery(req));
  if (!anos) return enviarJson(res, 400, { erro: 'Parâmetro "anos" deve ser 1, 2, 5 ou 10.' });

  const url = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4390/dados?formato=json' +
    `&dataInicial=${fmt(inicioDoPeriodo(anos))}&dataFinal=${fmt(new Date())}`;

  try {
    const serie = await buscarComRetentativas(url);
    const taxas = serie.map(({ data, valor }) => {
      const [, mes, ano] = data.split('/');
      return { mes: `${ano}-${mes}`, taxa: Number(valor) };
    }).filter((t) => Number.isFinite(t.taxa));
    enviarJson(res, 200, { taxas });
  } catch {
    enviarJson(res, 502, { erro: 'Não foi possível obter a Selic do Banco Central agora.' });
  }
}
