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
            `<div class="error">❌ 无法加载数据<br>错误: ${data.reason.message}<br>请检查 API 服务或 data/ 目录</div>`;
        document.getElementById('positionsBody').innerHTML =
            `<tr><td colspan="6" class="error">无数据</td></tr>`;
    }

    if (history.status === 'fulfilled') {
        historyData = history.value;
    } else {
        console.warn('[Dashboard] 历史趋势加载失败:', history.reason?.message);
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
        `最后更新: ${data.updateTime || data.date || '未知'}`;

    const pnlPct = data.total_pnl_pct || 0;
    const pnlClass = pnlPct >= 0 ? 'positive' : 'negative';
    const pnlEmoji = pnlPct >= 0 ? '📈' : '📉';

    document.getElementById('summaryGrid').innerHTML = `
        <div class="card">
            <div class="card-title">总资产</div>
            <div class="card-value">¥${formatNumber(data.total_asset)}</div>
        </div>
        <div class="card">
            <div class="card-title">总收益</div>
            <div class="card-value ${pnlClass}">${pnlEmoji} ${pnlPct > 0 ? '+' : ''}${pnlPct.toFixed(2)}%</div>
        </div>
        <div class="card">
            <div class="card-title">现金</div>
            <div class="card-value">¥${formatNumber(data.cash)}</div>
        </div>
        <div class="card">
            <div class="card-title">持仓数</div>
            <div class="card-value">${data.positions?.length || 0} 只</div>
        </div>
    `;

    renderPositions(data.positions || []);

    // 使用真实历史数据渲染资产走势图
    renderAssetChart(historyData, data.total_asset);
    renderPieChart(data.positions || []);

    checkAlerts(data);
}

function renderPositions(positions) {
    const tbody = document.getElementById('positionsBody');
    tbody.innerHTML = '';

    if (positions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="loading">未找到匹配的持仓</td></tr>`;
        return;
    }

    positions.forEach(pos => {
        const pnl = pos.pnl_pct || 0;
        const pnlClass = pnl >= 0 ? 'positive' : 'negative';
        const pnlEmoji = pnl >= 0 ? '📈' : '📉';
        const marketValue = pos.shares * pos.current;
        const dayHighLow = pos.day_high && pos.day_low
            ? `<div style="font-size:10px;color:var(--text2)">日内: ${pos.day_low} ~ ${pos.day_high}</div>`
            : '';

        tbody.innerHTML += `
            <tr>
                <td>
                    <div class="stock-name">
                        <span>${pos.name}</span>
                        <span class="stock-code">${pos.code}</span>
                    </div>
                    ${dayHighLow}
                </td>
                <td>${pos.shares}</td>
                <td>¥${pos.avg_cost.toFixed(2)}</td>
                <td>¥${pos.current.toFixed(2)}</td>
                <td>¥${formatNumber(marketValue)}</td>
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
    btn.textContent = '⏳ 加载中...';

    showSkeleton();

    try {
        const data = await fetchByDate(selectedDate);
        if (!data || typeof data !== 'object') {
            throw new Error('数据格式错误');
        }
        renderDashboard(data);
    } catch (error) {
        console.error('加载历史数据失败:', error);
        document.getElementById('summaryGrid').innerHTML =
            `<div class="error">❌ 无法加载 ${selectedDate} 的数据<br>错误: ${error.message}</div>`;
    }

    isLoading = false;
    btn.disabled = false;
    btn.textContent = '🔄 刷新数据';
}

// ============================================
// 刷新
// ============================================

async function loadData() {
    if (isLoading) return;
    isLoading = true;

    const btn = document.getElementById('refreshBtn');
    btn.disabled = true;
    btn.textContent = '⏳ 加载中...';

    showSkeleton();

    try {
        const data = await fetchLatestData();
        if (!data || typeof data !== 'object') {
            throw new Error('数据格式错误');
        }
        renderDashboard(data);
    } catch (error) {
        console.error('加载数据失败:', error);
        document.getElementById('summaryGrid').innerHTML =
            `<div class="error">❌ 无法加载数据<br>错误: ${error.message}<br>请检查 API 服务或 data/ 目录</div>`;
        document.getElementById('positionsBody').innerHTML =
            `<tr><td colspan="6" class="error">无数据</td></tr>`;
    }

    isLoading = false;
    btn.disabled = false;
    btn.textContent = '🔄 刷新数据';
}

/**
 * 刷新实时股价
 */
async function refreshRealtime() {
    if (isLoading) return;
    isLoading = true;

    const btn = document.getElementById('refreshBtn');
    btn.disabled = true;
    btn.textContent = '⏳ 获取实时行情...';

    try {
        const data = await fetchLatestData(true);
        if (!data || typeof data !== 'object') {
            throw new Error('数据格式错误');
        }
        renderDashboard(data);
        console.log('[Dashboard] 实时股价已刷新');
    } catch (error) {
        console.error('实时刷新失败:', error);
        alert('实时刷新失败: ' + error.message);
    }

    isLoading = false;
    btn.disabled = false;
    btn.textContent = '🔄 刷新数据';
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
        alerts.push(`总收益低于阈值: ${pnlPct.toFixed(2)}% < -5%`);
    }

    data.positions?.forEach(pos => {
        if (pos.pnl_pct < -10.0) {
            alerts.push(`${pos.name} 亏损超过阈值: ${pos.pnl_pct.toFixed(2)}%`);
        }
    });

    if (data.positions && data.positions.length > 0) {
        const totalValue = data.total_asset || 1;
        data.positions.forEach(pos => {
            const posValue = (pos.shares || 0) * (pos.current || 0);
            const concentration = (posValue / totalValue) * 100;
            if (concentration > 50) {
                alerts.push(`${pos.name} 持仓集中度过高: ${concentration.toFixed(2)}% > 50%`);
            }
        });
    }

    if (alerts.length > 0) {
        document.getElementById('alertContent').innerHTML = alerts.map(a => `<div>• ${a}</div>`).join('');
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

// 双击刷新按钮 = 实时刷新
document.getElementById('refreshBtn').addEventListener('dblclick', (e) => {
    e.preventDefault();
    refreshRealtime();
});

// 初始化加载
init();

// 定时刷新 (5 分钟)
setInterval(loadData, 5 * 60 * 1000);
