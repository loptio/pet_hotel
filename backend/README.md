# backend/ — FastAPI 模組化單體

對著 `../contracts/`（API 契約）與 `../docs/SDD.md`（資料模型/狀態機）做。跑法見專案根 `../README.md`「快速開始」。

## 結構
```
app/
├── main.py              FastAPI app；掛載 6 個對外路由於 /api/v1
├── core/                config・database(Base+mixins+pg_enum)・security(JWT + RBAC)
├── common/              CamelModel・Money・ErrorOut・not_implemented(501)
├── db/base.py           匯入全部 models（供 Alembic metadata / 入口註冊）
└── modules/             auth・pet・booking・checkin・grooming・cancellation・payment・notification・audit
                         每模組 = models + schemas + service + router
alembic/                 env.py + versions/（初始 migration）
scripts/                 seed.py（幂等）・export_openapi.py
```

## 模組對外性（SDD §2.1）
- **對外（有 router）**：auth・pet(Pets&Health)・booking・checkin・grooming・cancellation。
- **內部（無 router）**：payment・notification・audit — 只有 models＋service 樁，由其他服務內部呼叫。
- 對外只暴露 5 大 Gateway 服務（Auth/Booking/CheckIn/Grooming/Cancellation）＋飼主面 Pets&Health；詳見 `../contracts/api-overview.md`。

## 約定
- 業務邏輯與三狀態機（Booking 9 / WorkOrder 7 / Kennel 4）**已全數實作、140 項 pytest 全綠**；契約自凍結後 byte-identical 未漂移。
- UUID 主鍵；JSON body camelCase、URL snake_case；金額 `Money{amount,currency}`。
- Enum 照類圖（`PaymentMethod` 無 cash）；`AuditLog` 由 DB trigger 禁 UPDATE/DELETE。

## 常用指令
```bash
alembic upgrade head             # 套用 migration
alembic revision --autogenerate -m "..."   # 改 model 後產 migration（檢查 enum 重複/觸發器）
python scripts/seed.py           # 幂等 seed
python scripts/export_openapi.py # 導出 contracts/openapi.json
uvicorn app.main:app --reload    # 起 API + /docs
```
