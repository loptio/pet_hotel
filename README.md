# 寵物旅館與美容預約系統 — 工作區

一站式寵物住宿 + 美容預約系統。以 SDD/SRS 為基準、**契約優先**地由多個 Claude session 構建（全程 Opus 4.8）。

## 目錄
```
pet-hotel-system/
├── CLAUDE.md            每個 build session 的精簡入口（技術棧 / 真相來源 / 約定）
├── docs/
│   ├── SRS.md           需求規格（FR-01~06 / NFR-01~06）
│   ├── SDD.md           設計說明（架構 / 資料模型 / 行為 / 狀態機 / 追溯）
│   ├── build-plan.md    Session 規劃（開幾個、各做什麼）
│   ├── learning-journey.md  學習歷程（邊做邊記）
│   └── notes/           個人學習筆記（軟體方法・看懂軟體）
├── contracts/          API 契約（OpenAPI）＝前後端 / 跨 session 同步點【S1 產出】
├── diagrams/
│   ├── png/            15 張選定 UML（手繪 draw.io 一致版）
│   └── puml/           PlantUML 文字源（做系統時直接讀這個）
├── backend/            FastAPI 模組化單體【S1 起】
└── frontend/           React（Claude Code 實作；設計來自 Claude Design 交棒）【S3】
```

## 技術棧
React（**Claude Code 實作**，UI 設計用 **Claude Design** 產原型再交棒）＋ FastAPI ＋ PostgreSQL ＋ Redis ＋ RabbitMQ ＋ MinIO/S3；模組化單體先行。

## 兩條鐵律
1. **契約是單一真相來源**：前後端都對著 `contracts/` 做，別自己編字段/端點。
2. **類圖用手做版**（`diagrams/puml/class_diagram_plantuml.puml`），不用 GPT 版（缺 Kennel/DangerLevel、enum 不一致）。

## 快速開始（S1 · 本機跑通）
前置：Docker、Python 3.11+、Node 18+。

```bash
# 1) 起 PostgreSQL（S1 只接 postgres；host 5433 → 容器 5432，避開常見 5432 佔用）
docker compose up -d postgres            # 整套 pg+redis+rabbitmq+minio：docker compose --profile full up -d

# 2) 後端：依賴 → 套 migration（建 23 表 + AuditLog append-only trigger）→ seed
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                     # 預設已指向 localhost:5433
alembic upgrade head
python scripts/seed.py                   # 角色/權限・服務項目・床位・各角色測試帳號

# 3) 起 API → 看契約
uvicorn app.main:app --reload
#   http://127.0.0.1:8000/docs    ← Swagger（全端點，S1 為 501 樁但 schema 完整）
#   http://127.0.0.1:8000/redoc
#   http://127.0.0.1:8000/openapi.json

# 4)（可選）重新導出契約到 contracts/
python scripts/export_openapi.py

# 5) 前端骨架（給 Claude Design 連結用）
cd ../frontend && npm install && npm run dev   # http://localhost:5173
```

測試帳號（密碼 `Passw0rd!`）：`owner@` / `frontdesk@` / `groomer@` / `admin@` `demo.example.com`。
契約人讀索引見 [`contracts/api-overview.md`](contracts/api-overview.md)；偏離 SDD 之詮釋列於該檔末。

## 怎麼推進
路線：**SDD → S1 契約 →（D 設計 ∥ S2 後端）→ S3 前端實作 → S4 整合**（D=Claude Design 出設計並交棒，S3=Claude Code 實作 React）。
每個 session 做完 → 回來與 Claude 對照 SRS/SDD/契約審查 → 開下一個。詳見 `docs/build-plan.md`。
