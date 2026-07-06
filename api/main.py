"""
Stock CrewAI Dashboard REST API
从 stock-crewai 生成的 JSON 数据文件提供 REST 接口。
支持多日数据查询、历史趋势、持仓详情、实时股价刷新。
"""

import json
import glob
import asyncio
from pathlib import Path
from datetime import datetime, date
from typing import Optional
import urllib.request
import urllib.parse
import re

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# ============================================================
# 配置
# ============================================================

DATA_DIR = Path(__file__).parent.parent / "data"
WIKI_DATA_DIR = Path.home() / ".qclaw" / "workspace" / "wiki" / "stock-dashboard" / "data"

# ============================================================
# 数据加载
# ============================================================

def get_data_dir() -> Path:
    if DATA_DIR.exists() and any(DATA_DIR.glob("*.json")):
        return DATA_DIR
    if WIKI_DATA_DIR.exists() and any(WIKI_DATA_DIR.glob("*.json")):
        return WIKI_DATA_DIR
    return DATA_DIR

def load_json(filepath: Path) -> dict:
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

def load_by_date(target_date: str) -> Optional[dict]:
    data_dir = get_data_dir()
    filepath = data_dir / f"{target_date}-stock-crewai.json"
    if filepath.exists():
        return load_json(filepath)
    return None

def get_available_dates() -> list[str]:
    data_dir = get_data_dir()
    files = glob.glob(str(data_dir / "*-stock-crewai.json"))
    dates = []
    for f in files:
        name = Path(f).stem.replace("-stock-crewai", "")
        dates.append(name)
    dates.sort(reverse=True)
    return dates

def get_latest_data() -> Optional[dict]:
    dates = get_available_dates()
    if not dates:
        sample = Path(__file__).parent.parent / "sample-data.json"
        if sample.exists():
            return load_json(sample)
        return None
    return load_by_date(dates[0])

# ============================================================
# 实时股价获取 (新浪财经 API)
# ============================================================

def _stock_code_to_sina(code: str) -> str:
    """将 A 股代码转换为新浪 API 前缀格式"""
    if code.startswith("6"):
        return f"sh{code}"
    elif code.startswith("0") or code.startswith("3"):
        return f"sz{code}"
    elif code.startswith("8") or code.startswith("4"):
        return f"bj{code}"
    return f"sh{code}"

def fetch_realtime_prices(codes: list[str]) -> dict[str, dict]:
    """
    从新浪财经获取实时股价
    返回: {"603259": {"name": "药明康德", "current": 96.58, "open": 96.0, "high": 97.5, "low": 95.2, "prev_close": 95.9}, ...}
    """
    if not codes:
        return {}

    sina_codes = [_stock_code_to_sina(c) for c in codes]
    url = f"http://hq.sinajs.cn/list={','.join(sina_codes)}"

    try:
        req = urllib.request.Request(url, headers={
            "Referer": "http://finance.sina.com.cn",
            "User-Agent": "Mozilla/5.0"
        })
        with urllib.request.urlopen(req, timeout=5) as resp:
            content = resp.read().decode("gbk", errors="replace")
    except Exception as e:
        print(f"[API] 实时股价获取失败: {e}")
        return {}

    results = {}
    for line in content.strip().split("\n"):
        # var hq_str_sh603259="药明康德,96.58,103.85,95.90,97.5,95.2,...";
        match = re.match(r'var hq_str_\w+(\d{6})="(.+)";', line.strip())
        if not match:
            continue
        code = match.group(1)
        fields = match.group(2).split(",")
        if len(fields) < 4:
            continue
        try:
            results[code] = {
                "name": fields[0],
                "open": float(fields[1]) if fields[1] else 0,
                "prev_close": float(fields[2]) if fields[2] else 0,
                "current": float(fields[3]) if fields[3] else 0,
                "high": float(fields[4]) if fields[4] else 0,
                "low": float(fields[5]) if fields[5] else 0,
            }
        except (ValueError, IndexError):
            continue

    return results

def refresh_positions_with_realtime(data: dict) -> dict:
    """用实时股价更新持仓数据"""
    positions = data.get("positions", [])
    if not positions:
        return data

    codes = [p["code"] for p in positions]
    realtime = fetch_realtime_prices(codes)

    updated_positions = []
    total_market_value = 0
    for pos in positions:
        code = pos["code"]
        rt = realtime.get(code)
        if rt and rt["current"] > 0:
            pos = {**pos, "current": rt["current"], "realtime_name": rt["name"]}
            if rt["high"] > 0:
                pos["day_high"] = rt["high"]
            if rt["low"] > 0:
                pos["day_low"] = rt["low"]
        # 重新计算盈亏
        avg_cost = pos.get("avg_cost", 0)
        current = pos.get("current", 0)
        if avg_cost > 0:
            pos["pnl_pct"] = round((current - avg_cost) / avg_cost * 100, 2)
        market_value = pos.get("shares", 0) * current
        total_market_value += market_value
        updated_positions.append(pos)

    data = {**data, "positions": updated_positions}
    data["total_asset"] = round(total_market_value + data.get("cash", 0), 2)
    data["updateTime"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S") + " (实时)"

    # 重新计算总收益率 (需要初始资金)
    initial_capital = data.get("initial_capital") or data.get("cash", 0) + sum(
        p.get("shares", 0) * p.get("avg_cost", 0) for p in updated_positions
    )
    if initial_capital > 0:
        data["total_pnl_pct"] = round((data["total_asset"] - initial_capital) / initial_capital * 100, 2)

    return data

# ============================================================
# FastAPI 应用
# ============================================================

app = FastAPI(
    title="Stock CrewAI Dashboard API",
    description="股票交易系统数据接口 — 支持实时股价刷新",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# 路由
# ============================================================

@app.get("/")
async def root():
    dates = get_available_dates()
    return {
        "name": "Stock CrewAI Dashboard API",
        "version": "2.0.0",
        "available_dates": len(dates),
        "latest_date": dates[0] if dates else None,
        "endpoints": [
            "/api/latest",
            "/api/latest?refresh=true",
            "/api/dates",
            "/api/by-date/{date}",
            "/api/positions",
            "/api/summary",
            "/api/history",
            "/api/refresh",
        ],
    }


@app.get("/api/latest")
async def get_latest(refresh: bool = Query(False, description="获取实时股价")):
    """获取最新交易数据，可选刷新实时股价"""
    data = get_latest_data()
    if not data:
        raise HTTPException(status_code=404, detail="无可用数据")
    if refresh:
        data = refresh_positions_with_realtime(data)
    return data


@app.get("/api/dates")
async def get_dates():
    dates = get_available_dates()
    return {"count": len(dates), "dates": dates}


@app.get("/api/by-date/{date}")
async def get_by_date(date: str):
    data = load_by_date(date)
    if not data:
        raise HTTPException(status_code=404, detail=f"日期 {date} 无数据")
    return data


@app.get("/api/positions")
async def get_positions(refresh: bool = Query(False)):
    """获取当前持仓，可选刷新实时股价"""
    data = get_latest_data()
    if not data:
        raise HTTPException(status_code=404, detail="无可用数据")
    if refresh:
        data = refresh_positions_with_realtime(data)
    return {
        "date": data.get("date"),
        "update_time": data.get("updateTime"),
        "positions": data.get("positions", []),
        "count": len(data.get("positions", [])),
    }


@app.get("/api/summary")
async def get_summary(refresh: bool = Query(False)):
    """获取总览摘要，可选刷新实时股价"""
    data = get_latest_data()
    if not data:
        raise HTTPException(status_code=404, detail="无可用数据")
    if refresh:
        data = refresh_positions_with_realtime(data)
    return {
        "date": data.get("date"),
        "update_time": data.get("updateTime"),
        "total_asset": data.get("total_asset"),
        "total_pnl_pct": data.get("total_pnl_pct"),
        "cash": data.get("cash"),
        "positions_count": len(data.get("positions", [])),
        "top_gainer": max(data.get("positions", []), key=lambda p: p.get("pnl_pct", -999)) if data.get("positions") else None,
        "top_loser": min(data.get("positions", []), key=lambda p: p.get("pnl_pct", 999)) if data.get("positions") else None,
    }


@app.get("/api/history")
async def get_history():
    dates = get_available_dates()
    history = []
    for d in reversed(dates):
        data = load_by_date(d)
        if data:
            history.append({
                "date": data.get("date"),
                "total_asset": data.get("total_asset"),
                "total_pnl_pct": data.get("total_pnl_pct"),
                "cash": data.get("cash"),
                "positions_count": len(data.get("positions", [])),
            })
    return {
        "count": len(history),
        "history": history,
    }


@app.get("/api/refresh")
async def refresh_realtime():
    """显式刷新实时股价"""
    data = get_latest_data()
    if not data:
        raise HTTPException(status_code=404, detail="无可用数据")
    data = refresh_positions_with_realtime(data)
    return data


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
