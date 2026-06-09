# 寵物旅館與美容預約系統 · Pet Hotel & Grooming Booking System

寵物住宿 + 美容預約的一站式系統。**全端完成**：FastAPI 後端（140 測試全綠）＋ React 前端（飼主行動端 + 員工/管理員後台，RBAC 四角色），全程對著一份凍結的 OpenAPI 契約構建。

> 文件：[`docs/SRS.md`](docs/SRS.md)（需求）· [`docs/SDD.md`](docs/SDD.md)（設計）· [`contracts/api-overview.md`](contracts/api-overview.md)（API 契約）· UML 圖見 [`diagrams/png/`](diagrams/png)。

## 技術棧
- **前端**：React + Vite + TypeScript + Tailwind + shadcn/ui
- **後端**：FastAPI + SQLAlchemy 2.0 + Alembic（模組化單體）
- **資料**：PostgreSQL（AuditLog append-only trigger）
- 目標架構（部署圖）另含 Redis（分散式鎖）/ RabbitMQ（非同步通知稽核）/ Object Storage / Kubernetes；本機版以 **DB row-lock、同步通知、本機檔案**取代，核心業務邏輯不變（見 `docs/SDD.md`）。

## 功能（四角色 RBAC）
- **飼主**：寵物與疫苗檔案、瀏覽服務、預約（危險三段分流：高拒／中審／低付）、付訂金、進度追蹤、取消退款（24h 規則）。
- **櫃台**：報到核驗（晶片 + 疫苗有效期，逾期阻斷）、自動配床、床位看板、待審核佇列、緊急事件。
- **美容師**：工作單四階段（預檢→洗澡→烘乾→剪毛）、上傳照片、緊急事件。
- **管理員**：帳號管理（封鎖/建員工/指派角色）、角色權限矩陣、危險寵物（標記/解封）、異常取消報告。

## 快速開始
前置：Docker、Python 3.11+、Node 18+。

```bash
# 1) PostgreSQL（host 5433 → 容器 5432）
docker compose up -d postgres

# 2) 後端
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # DATABASE_URL → localhost:5433
alembic upgrade head                 # 建表 + AuditLog append-only trigger
python scripts/seed.py               # 角色/權限 + 服務 + 床位 + 測試帳號
python scripts/demo_data.py          # （可選）demo 用寵物/預約/工作單
uvicorn app.main:app --reload        # http://127.0.0.1:8000 · /docs

# 3) 前端（另開終端）
cd frontend && npm install && npm run dev   # http://localhost:5173
```

開 **http://localhost:5173**，測試帳號（密碼 `Passw0rd!`）：
`owner@` / `frontdesk@` / `groomer@` / `admin@` `demo.example.com`。
（`backend/scripts/reset_demo.sh` 可一鍵重置為乾淨 demo 資料。）

## 設計方法（契約優先）
SRS 鎖需求 → SDD 完成設計 → 從 SDD 導出 **OpenAPI 契約**作單一真相來源 → 前後端對著同一份凍結契約構建。契約自地基凍結後**逐位元未漂移**。資料模型與行為以一致的 PlantUML 一套為權威（`diagrams/puml/`）。

## 目錄
```
pet-hotel-system/
├── docs/         SRS.md · SDD.md
├── contracts/    OpenAPI 契約（openapi.json + 人讀 api-overview.md）
├── diagrams/     UML：png/（圖）· puml/（PlantUML 源）
├── backend/      FastAPI 模組化單體（auth·pet·booking·checkin·grooming·cancellation + payment·notification·audit）
└── frontend/     React（飼主行動端 + 員工/管理員後台）
```

## 測試 / 驗證
```bash
cd backend && python -m pytest        # 140 項
cd frontend && npm run build          # 型別檢查 + 打包
python backend/scripts/export_openapi.py   # 重新導出契約（應與凍結版一致）
```
