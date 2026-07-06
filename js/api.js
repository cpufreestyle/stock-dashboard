/**
 * API Client — Stock Dashboard 数据接口层
 * 统一管理所有 API 调用，支持多数据源 fallback
 */

const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:8080' : '';
const USE_API = !!API_BASE;
const DATA_URL = '/data/';

/**
 * 加载最新数据
 * 优先级: REST API > 本地 JSON > sample-data.json
 */
async function fetchLatestData() {
    // 1. REST API
    if (USE_API) {
        try {
            const resp = await fetch(`${API_BASE}/api/latest`);
            if (resp.ok) {
                console.log('[Dashboard] 数据来源: REST API');
                return await resp.json();
            }
        } catch (err) {
            console.warn('[Dashboard] API 不可用:', err.message);
        }
    }

    // 2. 本地 JSON
    try {
        const today = new Date().toISOString().split('T')[0];
        const resp = await fetch(`${DATA_URL}${today}-stock-crewai.json`);
        if (resp.ok) {
            console.log('[Dashboard] 数据来源: 本地 JSON');
            return await resp.json();
        }
    } catch (err) {
        // ignore
    }

    // 3. Sample data
    const sampleResp = await fetch('sample-data.json');
    if (sampleResp.ok) {
        console.log('[Dashboard] 数据来源: 示例数据');
        return await sampleResp.json();
    }

    throw new Error('所有数据源均不可用');
}

/**
 * 加载指定日期数据
 */
async function fetchByDate(date) {
    if (USE_API) {
        try {
            const resp = await fetch(`${API_BASE}/api/by-date/${date}`);
            if (resp.ok) {
                console.log(`[Dashboard] 历史数据来源: REST API (${date})`);
                return await resp.json();
            }
        } catch (err) {
            console.warn('[Dashboard] API 历史数据不可用:', err.message);
        }
    }

    const resp = await fetch(`${DATA_URL}${date}-stock-crewai.json`);
    if (resp.ok) {
        console.log(`[Dashboard] 历史数据来源: 本地 JSON (${date})`);
        return await resp.json();
    }

    throw new Error(`日期 ${date} 无数据`);
}

/**
 * 加载历史趋势数据（真实数据，非随机数）
 * 调用 /api/history 获取真实历史资产记录
 */
async function fetchHistory() {
    if (USE_API) {
        try {
            const resp = await fetch(`${API_BASE}/api/history`);
            if (resp.ok) {
                const data = await resp.json();
                console.log(`[Dashboard] 历史趋势: REST API (${data.count} 条记录)`);
                return data.history || [];
            }
        } catch (err) {
            console.warn('[Dashboard] 历史趋势 API 不可用:', err.message);
        }
    }

    // Fallback: 从本地 JSON 文件列表构建历史
    return await fetchHistoryFromLocal();
}

/**
 * 从本地 data/ 目录构建历史数据
 */
async function fetchHistoryFromLocal() {
    // 无法直接列目录，用 sample-data 作为单点
    try {
        const resp = await fetch('sample-data.json');
        if (resp.ok) {
            const data = await resp.json();
            return [{
                date: data.date,
                total_asset: data.total_asset,
                total_pnl_pct: data.total_pnl_pct,
                cash: data.cash,
                positions_count: data.positions?.length || 0
            }];
        }
    } catch (err) {
        // ignore
    }
    return [];
}

/**
 * 初始化日期选择器范围
 */
async function initDateList() {
    if (!USE_API) return;
    try {
        const resp = await fetch(`${API_BASE}/api/dates`);
        if (!resp.ok) return;
        const data = await resp.json();
        const picker = document.getElementById('datePicker');
        if (picker && data.dates.length > 0) {
            picker.min = data.dates[data.dates.length - 1];
            picker.max = data.dates[0];
            console.log(`[Dashboard] 可用日期: ${data.count} 天`);
        }
    } catch (e) {
        console.warn('[Dashboard] 日期列表加载失败:', e.message);
    }
}
