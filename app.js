let globalData = {
  accounts: null,
  transactions: null,
  fundDetails: null
};

let trendChartInstance = null;
let allocChartInstance = null;
let cashflowChartInstance = null;
let currentTrendMode = 'account';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [accountsData, transactionsData, fundDetailsData] = await Promise.all([
      fetch('data/accounts.json').then(r => r.json()),
      fetch('data/transactions.json').then(r => r.json()),
      fetch('data/fund_details.json').then(r => r.json())
    ]);

    globalData.accounts = accountsData;
    globalData.transactions = transactionsData;
    globalData.fundDetails = fundDetailsData;

    initDashboard();
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    document.getElementById('lastUpdatedText').innerText = '載入錯誤，請確認檔案路徑';
  }
});

function formatCurrency(num) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return 'NT$ ' + Math.round(num).toLocaleString('zh-TW');
}

function formatNumber(num, decimals = 4) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return Number(num).toLocaleString('zh-TW', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function initDashboard() {
  const { accounts, transactions, fundDetails } = globalData;
  const acc = accounts.accounts[0];
  const holding = acc.holdings[0];

  // Update dates
  const valDate = accounts.valuation_date || '2026-09-03';
  document.getElementById('lastUpdatedText').innerText = `評價基準日: 115/09/03 (${valDate})`;

  // Key KPI Cards
  document.getElementById('totalValuation').innerText = formatCurrency(accounts.total_current_valuation);
  document.getElementById('totalCost').innerText = `首次投入: ${formatCurrency(accounts.total_initial_amount)} (累計再投入 ${formatCurrency(accounts.total_cumulative_investment)})`;

  document.getElementById('totalDividends').innerText = formatCurrency(accounts.total_dividends);
  document.getElementById('totalDeductions').innerText = formatCurrency(accounts.total_deductions);

  const sign = accounts.total_roi >= 0 ? '+' : '';
  document.getElementById('netProfitRate').innerText = `${sign}${accounts.total_roi.toFixed(2)}%`;
  document.getElementById('netProfitVal').innerHTML = `<i class="fa-solid fa-arrow-trend-up"></i> 含息總淨收益 ${sign}${formatCurrency(accounts.total_net_profit_with_div)} (淨投入 ${formatCurrency(accounts.total_net_invested_cost)})`;

  // Render Holdings
  renderHoldingsTable([holding]);

  // Render Transactions
  renderTransactionsTable(transactions.transactions);

  // Render Charts
  renderTrendChart('account');
  renderAllocationChart();
  renderCashflowChart();
}

function renderHoldingsTable(holdings) {
  const tbody = document.getElementById('holdingsTableBody');
  tbody.innerHTML = '';
  document.getElementById('holdingsCount').innerText = `${holdings.length} 檔核心標的`;

  holdings.forEach(h => {
    const unGain = h.unrealized_gain_loss;
    const unGainRate = h.unrealized_gain_loss_rate;
    const unGainSign = unGain >= 0 ? '+' : '';
    const unGainClass = unGain >= 0 ? 'text-emerald' : 'text-rose';

    const totGain = h.total_return_with_div;
    const totGainRate = h.total_return_with_div_rate;
    const totGainSign = totGain >= 0 ? '+' : '';
    const totGainClass = totGain >= 0 ? 'text-emerald' : 'text-rose';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge badge-primary"><code>${h.fund_id}</code></span></td>
      <td style="font-weight: 700; color: #1e1b4b;">${h.target_name}</td>
      <td><strong>${formatNumber(h.units, 5)}</strong></td>
      <td>NT$ ${formatNumber(h.avg_price, 4)}</td>
      <td><strong style="color: #4338ca;">NT$ ${formatNumber(h.latest_price, 4)}</strong></td>
      <td style="font-weight: 800;">${formatCurrency(h.current_valuation)}</td>
      <td class="text-emerald" style="font-weight: 700;">${formatCurrency(h.accumulated_dividends)}</td>
      <td class="${unGainClass}" style="font-weight: 700;">${unGainSign}${formatCurrency(unGain)} (${unGainSign}${unGainRate.toFixed(2)}%)</td>
      <td class="${totGainClass}" style="font-weight: 800;">${totGainSign}${formatCurrency(totGain)} (${totGainSign}${totGainRate.toFixed(2)}%)</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTransactionsTable(transactions) {
  const tbody = document.getElementById('transactionsTableBody');
  tbody.innerHTML = '';
  document.getElementById('transactionsCount').innerText = `共 ${transactions.length} 筆明細`;

  transactions.forEach(tx => {
    let typeBadge = '<span class="badge badge-primary">首次配置</span>';
    let amountColor = 'color: var(--text-primary);';

    if (tx.type === 'dividend') {
      typeBadge = '<span class="badge badge-emerald"><i class="fa-solid fa-arrow-down-long"></i> 配息再投入</span>';
      amountColor = 'color: var(--color-emerald); font-weight: 700;';
    } else if (tx.type === 'fee') {
      typeBadge = '<span class="badge badge-rose"><i class="fa-solid fa-arrow-up-long"></i> 費用扣除</span>';
      amountColor = 'color: var(--color-rose); font-weight: 700;';
    } else if (tx.type === 'buy') {
      typeBadge = '<span class="badge badge-gold"><i class="fa-solid fa-star"></i> 首次配置</span>';
      amountColor = 'font-weight: 800; color: var(--color-gold);';
    }

    const unitText = tx.units !== null ? `${tx.units > 0 ? '+' : ''}${formatNumber(tx.units, 5)} 單位` : '-';
    const navText = tx.price ? `NT$ ${formatNumber(tx.price, 4)}` : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${tx.id}</code></td>
      <td><strong>${tx.roc_date}</strong> <span style="color: var(--text-muted); font-size: 11.5px;">(${tx.date})</span></td>
      <td>${typeBadge}</td>
      <td><strong>${tx.fund_name}</strong></td>
      <td style="${amountColor}">${tx.type === 'fee' ? '-' : ''}${formatCurrency(tx.amount)}</td>
      <td>${unitText}</td>
      <td>${navText}</td>
      <td style="color: var(--text-secondary); font-size: 12.5px;">${tx.note}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filterTransactions(type, btn) {
  // Update button states
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const { transactions } = globalData.transactions;
  if (type === 'all') {
    renderTransactionsTable(transactions);
  } else {
    const filtered = transactions.filter(t => t.type === type);
    renderTransactionsTable(filtered);
  }
}

function switchTrendChart(mode) {
  currentTrendMode = mode;
  document.getElementById('btnShowAccountVal').classList.toggle('active', mode === 'account');
  document.getElementById('btnShowNav').classList.toggle('active', mode === 'nav');
  renderTrendChart(mode);
}

function renderTrendChart(mode) {
  const ctx = document.getElementById('trendChart').getContext('2d');
  const fund = globalData.fundDetails.funds[0];

  if (trendChartInstance) {
    trendChartInstance.destroy();
  }

  if (mode === 'account') {
    const history = fund.historical_account_values;
    const labels = history.map(h => h.month);
    const data = history.map(h => h.value);

    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '保單帳戶價值 (NTD)',
          data: data,
          borderColor: '#e11d48',
          backgroundColor: 'rgba(225, 29, 72, 0.08)',
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#e11d48',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom' },
          tooltip: {
            callbacks: {
              label: context => ` 帳戶價值: ${formatCurrency(context.raw)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            min: 950000,
            max: 1040000,
            grid: { color: '#f1f5f9' },
            ticks: {
              callback: val => 'NT$ ' + (val / 10000).toFixed(1) + '萬'
            }
          }
        }
      }
    });
  } else {
    const history = fund.historical_nav;
    const labels = history.map(h => h.date);
    const data = history.map(h => h.nav);

    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '官方公告單位淨值 (TWD)',
          data: data,
          borderColor: '#4338ca',
          backgroundColor: 'rgba(67, 56, 202, 0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.25,
          pointBackgroundColor: '#4338ca',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom' },
          tooltip: {
            callbacks: {
              label: context => ` 淨值: NT$ ${context.raw.toFixed(4)}`
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            min: 7.9,
            max: 8.3,
            grid: { color: '#f1f5f9' },
            ticks: {
              callback: val => 'NT$ ' + val.toFixed(2)
            }
          }
        }
      }
    });
  }
}

function renderAllocationChart() {
  const ctx = document.getElementById('allocationChart').getContext('2d');
  const fund = globalData.fundDetails.funds[0];
  const alloc = fund.asset_allocation;

  if (allocChartInstance) {
    allocChartInstance.destroy();
  }

  allocChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: alloc.map(a => a.name),
      datasets: [{
        data: alloc.map(a => a.percentage),
        backgroundColor: ['#4338ca', '#059669', '#d97706'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: context => ` ${context.label}: ${context.raw}%`
          }
        }
      },
      cutout: '62%'
    }
  });
}

function renderCashflowChart() {
  const ctx = document.getElementById('cashflowChart').getContext('2d');
  const months = ['115/01', '115/02', '115/03', '115/04', '115/05', '115/06', '115/07', '115/08'];
  const divData = [7289, 7328, 7367, 7408, 7449, 7490, 7531, 7572];
  const feeData = [1952, 1961, 1932, 1927, 1951, 1953, 1981, 2194];
  const netData = divData.map((d, i) => d - feeData[i]);

  if (cashflowChartInstance) {
    cashflowChartInstance.destroy();
  }

  cashflowChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: '收益分配撥回 (+)',
          data: divData,
          backgroundColor: '#059669',
          borderRadius: 4
        },
        {
          label: '每月保單費用 (-)',
          data: feeData,
          backgroundColor: '#e11d48',
          borderRadius: 4
        },
        {
          type: 'line',
          label: '每月淨增益額',
          data: netData,
          borderColor: '#d97706',
          backgroundColor: '#d97706',
          borderWidth: 2.5,
          tension: 0.2,
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: context => ` ${context.dataset.label}: ${formatCurrency(context.raw)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: '#f1f5f9' },
          ticks: {
            callback: val => 'NT$ ' + val.toLocaleString('zh-TW')
          }
        }
      }
    }
  });
}
