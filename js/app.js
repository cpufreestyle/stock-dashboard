/**
 * Stock CrewAI Dashboard — 主应用逻辑
 * 模块化版本：api.js (数据) + charts.js (图表) + app.js (主逻辑)
 */

let isLoading = false;
let currentData = null;
let historyData = null;

// ============================================
// 初始化
// ============================================

async function init() {
    await initDateList();

    // 并行加载主数据和历史趋势
    const [data, history] = await Promise.allSettled([
        fetchLatestData(),
        fetchHistory()
    ]);

    if (data.status === 'fulfilled') {
        currentData = data.value;
        renderDashboard(currentData);
    } else {
        document.getElementById('summaryGrid').innerHTML =
            `<div class="error">\u274c \u65e0\u6cd5\u52a0\u8f7d\u6570\u636e<br>\u9519\u8bef: ${data.reason.message}<br>\u8bf7\u68c0\u67e5 API \u670d\u52a1\u6216 data/ \u76ee\u5f55</div>`;
        document.getElementById('positionsBody').innerHTML =
            `<tr><td colspan="6" class="error">\u65e0\u6570\u636e</td></tr>`;
    }

    if (history.status === 'fulfilled') {
        historyData = history.value;
    } else {
        console.warn('[Dashboard] \u5386\u53f2\u8d8b\u52bf\u52a0\u8f7d\u5931\u8d25:', history.reason?.message);
        historyData = [];
    }
}

// ============================================
// 渲染
// ============================================

function renderDashboard(data) {
    if (!data || typeof data !== 'object') {
        console.error('renderDashboard: data is invalid');
        return;
    }

    currentData = data;

    document.getElementById('updateTime').textContent =
        `\u6700\u540e\u66f4\u65b0: ${data.updateTime || data.date || '\u672a\u77e5'}`;

    const pnlPct = data.total_pnl_pct || 0;
    const pnlClass = pnlPct >= 0 ? 'positive' : 'negative';
    const pnlEmoji = pnlPct >= 0 ? '\ud83d\udcc8' : '\ud83d\udcc9';

    document.getElementById('summaryGrid').innerHTML = `
        <div class="card">
            <div class="card-title">\u603b\u8d44\u4ea7</div>
            <div class="card-value">\u00a5${formatNumber(data.total_asset)}</div>
        </div>
        <div class="card">
            <div class="card-title">\u603b\u6536\u76ca</div>
            <div class="card-value ${pnlClass}">${pnlEmoji} ${pnlPct > 0 ? '+' : ''}${pnlPct.toFixed(2)}%</div>
        </div>
        <div class="card">
            <div class="card-title">\u73b0\u91d1</div>
            <div class="card-value">\u00a5${formatNumber(data.cash)}</div>
        </div>
        <div class="card">
            <div class="card-title">\u6301\u4ed3\u6570</div>
            <div class="card-value">${data.positions?.length || 0} \u53ea</div>
        </div>
    `;

    renderPositions(data.positions || []);

    // \u4f7f\u7528\u771f\u5b9e\u5386\u53f2\u6570\u636e\u6e32\u67d3\u8d44\u4ea7\u8d70\u52bf\u56fe
    renderAssetChart(historyData, data.total_asset);
    renderPieChart(data.positions || []);

    checkAlerts(data);
}

function renderPositions(positions) {
    const tbody = document.getElementById('positionsBody');
    tbody.innerHTML = '';

    if (positions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="loading">\u672a\u627e\u5230\u5339\u914d\u7684\u6301\u4ed3</td></tr>`;
        return;
    }

    positions.forEach(pos => {
        const pnl = pos.pnl_pct || 0;
        const pnlClass = pnl >= 0 ? 'positive' : 'negative';
        const pnlEmoji = pnl >= 0 ? '\ud83d\udcc8' : '\ud83d\udcc9';
        const marketValue = pos.shares * pos.current;

        tbody.innerHTML += `
            <tr>
                <td>
                    <div class="stock-name">
                        <span>${pos.name}</span>
                        <span class="stock-code">${pos.code}</span>
                    </div>
                </td>
                <td>${pos.shares}</td>
                <td>\u00a5${pos.avg_cost.toFixed(2)}</td>
                <td>\u00a5${pos.current.toFixed(2)}</td>
                <td>\u00a5${formatNumber(marketValue)}</td>
                <td><span class="pnl-badge ${pnlClass}">${pnlEmoji} ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}%</span></td>
            </tr>
        `;
    });
}

// ============================================
// 搜索
// ============================================

function searchPositions() {
    const keyword = document.getElementById('searchBox').value.toLowerCase().trim();

    if (!currentData || !Array.isArray(currentData.positions)) return;

    if (!keyword) {
        renderPositions(currentData.positions);
        return;
    }

    const filtered = currentData.positions.filter(pos =>
        pos.name.toLowerCase().includes(keyword) ||
        pos.code.toLowerCase().includes(keyword)
    );
    renderPositions(filtered);
}

// ============================================
// 日期切换
// ============================================

async function loadHistoryData() {
    const selectedDate = document.getElementById('datePicker').value;
    if (!selectedDate) {
        loadData();
        return;
    }

    if (isLoading) return;
    isLoading = true;

    const btn = document.getElementById('refreshBtn');
    btn.disabled = true;
    btn.textContent = '\u23f3 \u52a0\u8f7d\u4e2d...';

    showSkeleton();

    try {
        const data = await fetchByDate(selectedDate);
        if (!data || typeof data !== 'object') {
            throw new Error('\u6570\u636e\u683c\u5f0f\u9519\u8bef');
        }
        renderDashboard(data);
    } catch (error) {
        console.error('\u52a0\u8f7d\u5386\u53f2\u6570\u636e\u5931\u8d25:', error);
        document.getElementById('summaryGrid').innerHTML =
            `<div class="error">\u274c \u65e0\u6cd5\u52a0\u8f7d ${selectedDate} \u7684\u6570\u636e<br>\u9519\u8bef: ${error.message}</div>`;
    }

    isLoading = false;
    btn.disabled = false;
    btn.textContent = '\ud83d\udd04 \u5237\u65b0\u6570\u636e';
}

// ============================================
// 刷新
// ============================================

async function loadData() {
    if (isLoading) return;
    isLoading = true;

    const btn = document.getElementById('refreshBtn');
    btn.disabled = true;
    btn.textContent = '\u23f3 \u52a0\u8f7d\u4e2d...';

    showSkeleton();

    try {
        const data = await fetchLatestData();
        if (!data || typeof data !== 'object') {
            throw new Error('\u6570\u636e\u683c\u5f0f\u9519\u8bef');
        }
        renderDashboard(data);
    } catch (error) {
        console.error('\u52a0\u8f7d\u6570\u636e\u5931\u8d25:', error);
        document.getElementById('summaryGrid').innerHTML =
            `<div class="error">\u274c \u65e0\u6cd5\u52a0\u8f7d\u6570\u636e<br>\u9519\u8bef: ${error.message}<br>\u8bf7\u68c0\u67e5 API \u670d\u52a1\u6216 data/ \u76ee\u5f55</div>`;
        document.getElementById('positionsBody').innerHTML =
            `<tr><td colspan="6" class="error">\u65e0\u6570\u636e</td></tr>`;
    }

    isLoading = false;
    btn.disabled = false;
    btn.textContent = '\ud83d\udd04 \u5237\u65b0\u6570\u636e';
}

// ============================================
// 辅助
// ============================================

function showSkeleton() {
    document.getElementById('summaryGrid').innerHTML = `
        <div class="skeleton"><div class="skeleton-title"></div><div class="skeleton-value"></div></div>
        <div class="skeleton"><div class="skeleton-title"></div><div class="skeleton-value"></div></div>
        <div class="skeleton"><div class="skeleton-title"></div><div class="skeleton-value"></div></div>
        <div class="skeleton"><div class="skeleton-title"></div><div class="skeleton-value"></div></div>
    `;
    document.getElementById('positionsBody').innerHTML = `
        <tr><td colspan="6" class="loading">
            <div class="skeleton" style="height: 20px; margin: 10px 0;"></div>
            <div class="skeleton" style="height: 20px; margin: 10px 0;"></div>
            <div class="skeleton" style="height: 20px; margin: 10px 0;"></div>
        </td></tr>
    `;
}

function checkAlerts(data) {
    const alerts = [];
    const pnlPct = data.total_pnl_pct || 0;

    if (pnlPct < -5.0) {
        alerts.push(`\u603b\u6536\u76ca\u4f4e\u4e8e\u9608\u503c: ${pnlPct.toFixed(2)}% < -5%`);
    }

    data.positions?.forEach(pos => {
        if (pos.pnl_pct < -10.0) {
            alerts.push(`${pos.name} \u4e8f\u635f\u8d85\u8fc7\u9608\u503c: ${pos.pnl_pct.toFixed(2)}%`);
        }
    });

    if (data.positions && data.positions.length > 0) {
        const totalValue = data.total_asset || 1;
        data.positions.forEach(pos => {
            const posValue = (pos.shares || 0) * (pos.current || 0);
            const concentration = (posValue / totalValue) * 100;
            if (concentration > 50) {
                alerts.push(`${pos.name} \u6301\u4ed3\u96c6\u4e2d\u5ea6\u8fc7\u9ad8: ${concentration.toFixed(2)}% > 50%`);
            }
        });
    }

    if (alerts.length > 0) {
        document.getElementById('alertContent').innerHTML = alerts.map(a => `<div>\u2022 ${a}</div>`).join('');
        document.getElementById('alertBox').classList.add('show');
    } else {
        document.getElementById('alertBox').classList.remove('show');
    }
}

function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '--';
    return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(num);
}

// ============================================
// 启动
// ============================================

document.getElementById('searchBox').addEventListener('input', searchPositions);

document.getElementById('datePicker').addEventListener('change', loadHistoryData);

document.getElementById('refreshBtn').addEventListener('click', loadData);

// \u521d\u59cb\u5316\u52a0\u8f7d
init();

// \u5b9a\u65f6\u5237\u65b0 (5 \u5206\u949f)
setInterval(loadData, 5 * 60 * 1000);
