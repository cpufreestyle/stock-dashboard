# Stock Dashboard REST API

基于 FastAPI 的 Stock CrewAI Dashboard 后端，替代静态 JSON 文件。

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
| GET | /api/dates | 可用日期列表 |
| GET | /api/{date} | 指定日期数据 |
| GET | /api/positions | 当前持仓 |
| GET | /api/summary | 总览摘要 |
| GET | /api/history | 历史收益曲线 |
