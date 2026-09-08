document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [accountsData, transactionsData, fundDetailsData] = await Promise.all([
      fetch('data/accounts.json').then(r => r.json()),
      fetch('data/transactions.json').then(r => r.json()),
      fetch('data/fund_details.json').then(r => r.json())
    ]);

    initDashboard(accountsData, transactionsData, fundDetailsData);
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

function initDashboard(accountsData, transactionsData, fundDetailsData) {
  // Update timestamp
  const lastUpdated = accountsData.last_updated || new Date().toISOString();
  document.getElementById('lastUpdatedText').innerText = `更新時間: ${lastUpdated.split('T')[0]}`;

  // Process Accounts & Holdings
  let totalInitial = 0;
  let totalValuation = 0;
  let allHoldings = [];

  accountsData.accounts.forEach(acc => {
    totalInitial += (acc.initial_amount || 0);
    acc.holdings.forEach(h => {
      const val = h.units * h.latest_price;
      totalValuation += val;
      allHoldings.push({
        accountName: acc.name,
        targetName: h.target_name,
        units: h.units,
        avgPrice: h.avg_price,
        latestPrice: h.latest_price,
        costAmount: h.cost_amount || (h.units * h.avg_price),
        currentValuation: val
      });
    });
  });

  // Calculate Dividends & Deductions from transactions
  let calculatedDividends = 0;
  let calculatedDeductions = 0;

  transactionsData.transactions.forEach(tx => {
    if (tx.type === 'dividend') {
      calculatedDividends += (tx.amount || 0);
    } else if (tx.type === 'fee' || tx.type === 'deduction') {
      calculatedDeductions += (tx.amount || 0);
    }
  });

  // Fallback to accounts.json totals if transactions are empty
  const finalDividends = calculatedDividends || accountsData.total_dividends || 0;
  const finalDeductions = calculatedDeductions || accountsData.total_deductions || 0;

  // Net Profit & ROI
  const capitalGain = totalValuation - totalInitial;
  const netIncome = capitalGain + finalDividends - finalDeductions;
  const roi = totalInitial > 0 ? (netIncome / totalInitial) * 100 : 0;

  // Update KPI Cards
  document.getElementById('totalValuation').innerText = formatCurrency(totalValuation);
  document.getElementById('totalCost').innerText = `原始本金: ${formatCurrency(totalInitial)}`;

  document.getElementById('totalDividends').innerText = formatCurrency(finalDividends);
  document.getElementById('totalDeductions').innerText = formatCurrency(finalDeductions);

  const netProfitEl = document.getElementById('netProfitVal');
  const netProfitRateEl = document.getElementById('netProfitRate');
  const netCard = document.getElementById('netProfitCard');

  const sign = netIncome >= 0 ? '+' : '';
  netProfitEl.innerText = `${sign}${formatCurrency(netIncome)}`;
  netProfitRateEl.innerHTML = `<i class="fa-solid fa-arrow-trend-${netIncome >= 0 ? 'up' : 'down'}"></i> ${sign}${roi.toFixed(2)}% 總含息報酬率 (ROI)`;

  if (netIncome < 0) {
    netCard.classList.remove('emerald');
    netCard.classList.add('rose');
    netProfitEl.classList.add('text-rose');
    netProfitRateEl.classList.add('text-rose');
  }

  // Render Holdings Table
  renderHoldingsTable(allHoldings, totalValuation);

  // Render Transactions Table
  renderTransactionsTable(transactionsData.transactions);

  // Render Charts
  renderCharts(fundDetailsData, allHoldings);
}

function renderHoldingsTable(holdings, totalValuation) {
  const tbody = document.getElementById('holdingsTableBody');
  tbody.innerHTML = '';
  document.getElementById('holdingsCount').innerText = `${holdings.length} 檔基金`;

  holdings.forEach(h => {
    const unGain = h.currentValuation - h.costAmount;
    const unGainRate = h.costAmount > 0 ? (unGain / h.costAmount) * 100 : 0;
    const weight = totalValuation > 0 ? (h.currentValuation / totalValuation) * 100 : 0;
    const gainSign = unGain >= 0 ? '+' : '';
    const gainClass = unGain >= 0 ? 'text-emerald' : 'text-rose';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge badge-primary">${h.accountName}</span></td>
      <td style="font-weight: 700;">${h.targetName}</td>
      <td>${formatNumber(h.units, 4)}</td>
      <td>NT$ ${formatNumber(h.avgPrice, 4)}</td>
      <td>NT$ ${formatNumber(h.latestPrice, 4)}</td>
      <td style="font-weight: 700;">${formatCurrency(h.currentValuation)}</td>
      <td class="${gainClass}" style="font-weight: 700;">${gainSign}${formatCurrency(unGain)} (${gainSign}${unGainRate.toFixed(2)}%)</td>
      <td><strong>${weight.toFixed(1)}%</strong></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTransactionsTable(transactions) {
  const tbody = document.getElementById('transactionsTableBody');
  tbody.innerHTML = '';
  document.getElementById('transactionsCount').innerText = `${transactions.length} 筆明細`;

  transactions.forEach(tx => {
    let typeBadgeClass = 'badge-primary';
    if (tx.type === 'dividend') typeBadgeClass = 'badge-emerald';
    if (tx.type === 'fee' || tx.type === 'deduction') typeBadgeClass = 'badge-rose';

    const unitPriceText = tx.units ? `${formatNumber(tx.units, 4)} 單位 (淨值 NT$ ${formatNumber(tx.price, 4)})` : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${tx.id}</code></td>
      <td>${tx.date}</td>
      <td><span class="badge ${typeBadgeClass}">${tx.type_label || tx.type}</span></td>
      <td>${tx.fund_name}</td>
      <td style="font-weight: 700;">${formatCurrency(tx.amount)}</td>
      <td><small>${unitPriceText}</small></td>
      <td style="color: var(--text-secondary);">${tx.note || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCharts(fundDetailsData, holdings) {
  // 1. Trend Chart
  const trendCtx = document.getElementById('trendChart').getContext('2d');
  const mainFund = fundDetailsData.funds[0] || {};
  const history = mainFund.historical_nav || [];

  const labels = history.map(item => item.date.slice(5));
  const navData = history.map(item => item.nav);

  new Chart(trendCtx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `${mainFund.name || '主要標的'} 官方淨值走勢`,
        data: navData,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#4f46e5',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom' }
      },
      scales: {
        x: { grid: { display: false } },
        y: { 
          grid: { color: '#f1f5f9' },
          ticks: {
            callback: value => 'NT$ ' + value.toFixed(2)
          }
        }
      }
    }
  });

  // 2. Allocation Chart
  const allocCtx = document.getElementById('allocationChart').getContext('2d');
  const allocData = mainFund.asset_allocation || [
    { name: '成長型股票', percentage: 33.5 },
    { name: '高收益債券', percentage: 33.2 },
    { name: '可轉換公司債', percentage: 33.3 }
  ];

  new Chart(allocCtx, {
    type: 'doughnut',
    data: {
      labels: allocData.map(a => a.name),
      datasets: [{
        data: allocData.map(a => a.percentage),
        backgroundColor: ['#4f46e5', '#059669', '#d97706', '#0891b2', '#e11d48'],
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
      cutout: '65%'
    }
  });
}
