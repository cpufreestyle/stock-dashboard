/**
 * Charts — 图表渲染模块
 * 使用 Chart.js 渲染资产走势和持仓分布
 * 注意: 资产走势使用 /api/history 真实数据，不再使用 Math.random()
 */

let assetChart = null;
let pieChart = null;

const CHART_COLORS = [
    '#00d4ff', '#7c3aed', '#00d4aa', '#ff4757', '#ffa502',
    '#2ed573', '#1e90ff', '#ff6b81', '#eccc68', '#a29bfe'
];

/**
 * 渲染资产走势图（使用真实历史数据）
 * @param {Array} historyData - 来自 /api/history 的历史记录
 * @param {number} currentAsset - 当前总资产（fallback）
 */
function renderAssetChart(historyData, currentAsset) {
    const ctx = document.getElementById('assetChart').getContext('2d');
    if (assetChart) assetChart.destroy();

    let labels, assetValues;

    if (historyData && historyData.length > 0) {
        // 使用真实历史数据
        labels = historyData.map(h => {
            const d = new Date(h.date);
            return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
        });
        assetValues = historyData.map(h => h.total_asset || 0);
        console.log(`[Dashboard] 资产走势: ${historyData.length} 天真实数据`);
    } else {
        // Fallback: 仅显示当前资产作为单点
        labels = ['当前'];
        assetValues = [currentAsset || 100000];
        console.warn('[Dashboard] 无历史数据，仅显示当前资产');
    }

    assetChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '总资产',
                data: assetValues,
                borderColor: '#00d4ff',
                backgroundColor: 'rgba(0, 212, 255, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#888', font: { size: 11 } },
                    beginAtZero: false
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#888', font: { size: 10 }, maxRotation: 45 }
                }
            },
            elements: {
                line: { borderWidth: 2 },
                point: { radius: 2, hoverRadius: 5 }
            }
        }
    });
}

/**
 * 渲染持仓分布饼图
 * @param {Array} positions - 持仓列表
 */
function renderPieChart(positions) {
    const ctx = document.getElementById('pieChart').getContext('2d');
    if (pieChart) pieChart.destroy();

    const pos = Array.isArray(positions) ? positions : [];
    const names = pos.length > 0 ? pos.map(p => p.name || '未知') : ['无持仓'];
    const values = pos.length > 0 ? pos.map(p => (p.shares || 0) * (p.current || 0)) : [1];

    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: names,
            datasets: [{
                data: values,
                backgroundColor: CHART_COLORS.slice(0, names.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#fff',
                        font: { size: 12 },
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff'
                }
            }
        }
    });
}
