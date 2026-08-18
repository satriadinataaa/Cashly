const KINDS = ['income', 'expense', 'investment', 'saving', 'debt_payment', 'transfer'];

function transactionKind(transaction) {
  if (KINDS.includes(transaction.jenis)) return transaction.jenis;
  if (transaction.tipe === 'investasi') return 'investment';
  if (transaction.tipe === 'pendanaan' && transaction.arah === 'keluar') return 'debt_payment';
  return transaction.arah === 'masuk' ? 'income' : 'expense';
}

function summarize(transactions, options = {}) {
  const result = {
    income: 0, expense: 0, investment: 0, cashInflow: 0, cashOutflow: 0,
    cashBalance: Number(options.openingCash || 0), assetBookValue: 0,
    totalAssets: 0, totalLiabilities: Number(options.openingLiabilities || 0), netWorth: 0,
    accounts: { ...(options.openingAccounts || {}) }, assets: { ...(options.openingAssets || {}) }
  };

  for (const transaction of transactions) {
    const amount = Number(transaction.nominal) || 0;
    const kind = transactionKind(transaction);
    const internal = kind === 'transfer' || kind === 'saving';

    if (kind === 'income') result.income += amount;
    if (kind === 'expense') result.expense += amount;
    if (kind === 'investment' && transaction.arah === 'keluar') result.investment += amount;

    if (internal) {
      const source = transaction.akunSumber || 'cash';
      const destination = transaction.akunTujuan || (kind === 'saving' ? 'saving' : 'cash');
      result.accounts[source] = (result.accounts[source] || 0) - amount;
      result.accounts[destination] = (result.accounts[destination] || 0) + amount;
      continue;
    }

    const account = transaction.akunSumber || transaction.akunTujuan || 'cash';
    const sign = transaction.arah === 'masuk' ? 1 : -1;
    result.accounts[account] = (result.accounts[account] || 0) + sign * amount;
    result.cashBalance += sign * amount;
    if (sign > 0) result.cashInflow += amount;
    else result.cashOutflow += amount;

    if (kind === 'investment' && transaction.assetId) {
      result.assets[transaction.assetId] = (result.assets[transaction.assetId] || 0) - sign * amount;
    }
    if (kind === 'debt_payment' && transaction.liabilityId && transaction.arah === 'keluar') {
      result.totalLiabilities = Math.max(0, result.totalLiabilities - amount);
    }
  }

  result.assetBookValue = Object.values(result.assets).reduce((sum, value) => sum + value, 0);
  result.totalAssets = result.cashBalance + result.assetBookValue;
  result.netWorth = result.totalAssets - result.totalLiabilities;
  return result;
}

module.exports = { KINDS, transactionKind, summarize };
