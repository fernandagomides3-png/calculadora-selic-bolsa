// Simulação mês a mês: aplicação inicial no primeiro mês e aportes nos meses seguintes,
// sempre no fechamento do mês. Mesmo fluxo de caixa para a ação e para a Selic.

const IR_ACOES = 0.15;

// Tabela regressiva de IR da renda fixa (Tesouro Selic), por prazo de cada aporte.
export function aliquotaRendaFixa(dias) {
  if (dias <= 180) return 0.225;
  if (dias <= 360) return 0.2;
  if (dias <= 720) return 0.175;
  return 0.15;
}

function fimDoMes(mes, hoje) {
  const [ano, m] = mes.split('-').map(Number);
  const fim = new Date(ano, m, 0); // dia 0 do mês seguinte = último dia deste mês
  return fim > hoje ? hoje : fim;
}

const DIA = 86_400_000;

// Garante um ponto por mês entre o primeiro e o último; meses sem cotação repetem o último preço.
function mesesContinuos(precos) {
  const porMes = new Map(precos.map((p) => [p.mes, p.preco]));
  const [anoFim, mesFim] = precos[precos.length - 1].mes.split('-').map(Number);
  let [ano, m] = precos[0].mes.split('-').map(Number);
  const lista = [];
  let preco = precos[0].preco;
  while (ano < anoFim || (ano === anoFim && m <= mesFim)) {
    const mes = `${ano}-${String(m).padStart(2, '0')}`;
    preco = porMes.get(mes) ?? preco;
    lista.push({ mes, preco });
    if (++m > 12) { m = 1; ano++; }
  }
  return lista;
}

/**
 * @param {object} p
 * @param {{mes: string, preco: number}[]} p.precos  preços mensais ajustados (ordem cronológica)
 * @param {{mes: string, taxa: number}[]} p.taxas    Selic acumulada no mês, em %
 * @param {number} p.inicial   aplicação inicial (R$)
 * @param {number} p.aporte    aporte mensal (R$)
 * @param {boolean} [p.descontarIR=true]
 * @param {Date} [p.hoje]
 */
export function simular({ precos, taxas, inicial, aporte, descontarIR = true, hoje = new Date() }) {
  const taxaPorMes = new Map(taxas.map((t) => [t.mes, t.taxa]));
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  let ultimaTaxa = taxas.length ? taxas[taxas.length - 1].taxa : 0;

  const meses = [];
  const serieInvestido = [];
  const serieAcao = [];
  const serieSelic = [];

  let investido = 0;
  let cotas = 0;
  const lotesSelic = []; // cada aporte rende separado para aplicar a alíquota certa de IR

  mesesContinuos(precos).forEach(({ mes, preco }, i) => {
    // 1) Selic do mês rende sobre os aportes já feitos
    if (i > 0) {
      let taxa = taxaPorMes.get(mes);
      if (taxa == null) {
        taxa = ultimaTaxa;
        if (mes === mesAtual) {
          // mês corrente ainda sem dado: proporcional aos dias corridos
          const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
          taxa *= hoje.getDate() / diasNoMes;
        }
      } else {
        ultimaTaxa = taxa;
      }
      const fator = 1 + taxa / 100;
      for (const lote of lotesSelic) lote.saldo *= fator;
    }

    // 2) Novo aporte no fechamento do mês
    const valor = i === 0 ? inicial : aporte;
    if (valor > 0) {
      investido += valor;
      cotas += valor / preco;
      lotesSelic.push({ principal: valor, saldo: valor, data: fimDoMes(mes, hoje) });
    }

    meses.push(mes);
    serieInvestido.push(investido);
    serieAcao.push(cotas * preco);
    serieSelic.push(lotesSelic.reduce((s, l) => s + l.saldo, 0));
  });

  const brutoAcao = serieAcao[serieAcao.length - 1] ?? 0;
  const brutoSelic = serieSelic[serieSelic.length - 1] ?? 0;

  const irAcao = descontarIR ? Math.max(0, brutoAcao - investido) * IR_ACOES : 0;
  const irSelic = descontarIR
    ? lotesSelic.reduce((s, l) => {
        const dias = Math.max(0, Math.round((hoje - l.data) / DIA));
        return s + Math.max(0, l.saldo - l.principal) * aliquotaRendaFixa(dias);
      }, 0)
    : 0;

  const resumo = (bruto, ir) => {
    const liquido = bruto - ir;
    const rendimento = liquido - investido;
    return { bruto, ir, liquido, rendimento, rentabilidade: investido ? rendimento / investido : 0 };
  };

  return {
    meses,
    serieInvestido,
    serieAcao,
    serieSelic,
    investido,
    acao: resumo(brutoAcao, irAcao),
    selic: resumo(brutoSelic, irSelic),
  };
}
