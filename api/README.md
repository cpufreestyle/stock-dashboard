# Stock Dashboard API

基于 FastAPI 的 Stock CrewAI Dashboard 后端，支持实时股价刷新。

## 运行

```bash
cd api
pip install fastapi uvicorn
uvicorn main:app --reload --port 8080
```

## API 文档

启动后访问 `http://localhost:8080/docs`

## 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/latest | 最新交易数据 |
| GET | /api/latest?refresh=true | 最新数据 + 实时股价刷新 |
| GET | /api/dates | 可用日期列表 |
| GET | /api/by-date/{date} | 指定日期数据 |
| GET | /api/positions | 当前持仓 |
| GET | /api/positions?refresh=true | 持仓 + 实时股价 |
| GET | /api/summary | 总览摘要 |
| GET | /api/summary?refresh=true | 摘要 + 实时股价 |
| GET | /api/history | 历史收益曲线 |
| GET | /api/refresh | 显式刷新实时股价 |

## 实时股价

v2.0 新增：通过新浪财经 API 获取 A 股实时行情。

- 自动识别沪深京市场前缀（sh/sz/bj）
- 刷新后重新计算持仓盈亏和总资产
- 超时 5s，失败时回退到本地数据
