"""
Stock CrewAI Dashboard REST API
从 stock-crewai 生成的 JSON 数据文件提供 REST 接口。
支持多日数据查询、历史趋势、持仓详情。
"""

import json
import glob
from pathlib import Path
from datetime import datetime, date
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# ============================================================
# 配置
# ============================================================

# 数据目录：优先用同级 data/，也支持 wiki/stock-dashboard/data/
DATA_DIR = Path(__file__).parent.parent / "data"
WIKI_DATA_DIR = Path.home() / ".qclaw" / "workspace" / "wiki" / "stock-dashboard" / "data"

# ============================================================
# 数据加载
# ============================================================

def get_data_dir() -> Path:
    """获取可用数据目录"""
    if DATA_DIR.exists() and any(DATA_DIR.glob("*.json")):
        return DATA_DIR
    if WIKI_DATA_DIR.exists() and any(WIKI_DATA_DIR.glob("*.json")):
        return WIKI_DATA_DIR
    return DATA_DIR  # fallback

def load_json(filepath: Path) -> dict:
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

def load_by_date(target_date: str) -> Optional[dict]:
    """按日期加载数据"""
    data_dir = get_data_dir()
    filepath = data_dir / f"{target_date}-stock-crewai.json"
    if filepath.exists():
        return load_json(filepath)
    return None

def get_available_dates() -> list[str]:
    """获取所有可用日期"""
    data_dir = get_data_dir()
    files = glob.glob(str(data_dir / "*-stock-crewai.json"))
    dates = []
    for f in files:
        name = Path(f).stem.replace("-stock-crewai", "")
        dates.append(name)
    dates.sort(reverse=True)
    return dates

def get_latest_data() -> Optional[dict]:
    """获取最新数据"""
    dates = get_available_dates()
    if not dates:
        # fallback 到 sample-data.json
        sample = Path(__file__).parent.parent / "sample-data.json"
        if sample.exists():
            return load_json(sample)
        return None
    return load_by_date(dates[0])

# ============================================================
# FastAPI 应用
# ============================================================

app = FastAPI(
    title="Stock CrewAI Dashboard API",
    description="股票交易系统数据接口",
    version="1.0.0",
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
    """API 根路径"""
    dates = get_available_dates()
    return {
        "name": "Stock CrewAI Dashboard API",
        "version": "1.0.0",
        "available_dates": len(dates),
        "latest_date": dates[0] if dates else None,
        "endpoints": [
            "/api/latest",
            "/api/dates",
            "/api/{date}",
            "/api/positions",
            "/api/summary",
            "/api/history",
        ],
    }


@app.get("/api/latest")
async def get_latest():
    """获取最新交易数据"""
    data = get_latest_data()
    if not data:
        raise HTTPException(status_code=404, detail="无可用数据")
    return data


@app.get("/api/dates")
async def get_dates():
    """获取所有可用日期列表"""
    dates = get_available_dates()
    return {"count": len(dates), "dates": dates}


@app.get("/api/by-date/{date}")
async def get_by_date(date: str):
    """获取指定日期的数据"""
    data = load_by_date(date)
    if not data:
        raise HTTPException(status_code=404, detail=f"日期 {date} 无数据")
    return data


@app.get("/api/positions")
async def get_positions():
    """获取当前持仓"""
    data = get_latest_data()
    if not data:
        raise HTTPException(status_code=404, detail="无可用数据")
    return {
        "date": data.get("date"),
        "positions": data.get("positions", []),
        "count": len(data.get("positions", [])),
    }


@app.get("/api/summary")
async def get_summary():
    """获取总览摘要"""
    data = get_latest_data()
    if not data:
        raise HTTPException(status_code=404, detail="无可用数据")
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
    """获取历史收益曲线"""
    dates = get_available_dates()
    history = []
    for d in reversed(dates):  # 从旧到新
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
