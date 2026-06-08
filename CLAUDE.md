# CLAUDE.md — 寵物旅館與美容預約系統（build context）

> 給每個 build session 的精簡入口。**保持精簡**：臃腫的 context 反而有害（成功率↓、成本↑）。

## 專案
寵物旅館（住宿）+ 美容預約的一站式系統。需求 → `docs/SRS.md`，設計 → `docs/SDD.md`。

## 技術棧
- 後端：Python + FastAPI，**模組化單體先行**（部署圖的微服務拆分是目標架構，跑通後再拆）。
- 資料：PostgreSQL（主從）、Redis（快取＋分散式鎖）、RabbitMQ（通知/稽核非同步）、MinIO/S3（照片/疫苗文件）。
- 前端：React，在 **Claude Code** 實作、**對著契約做**；UI 視覺與 design system 用 **Claude Design** 產原型再「Handoff to Claude Code」（Claude Design 是設計/原型工具，**不接後端、不直接產 React**）。
- 模型：Claude Code 全程 Opus 4.8；Claude Design 跑自家 Opus 4.7（研究預覽，選不了）。

## 單一真相來源（對著它做，別自己編字段/端點）
1. `contracts/` — **API 契約（OpenAPI）＝前後端 / 跨 session 的同步點**。
2. `docs/SRS.md` — 做什麼（FR-01~06 / NFR-01~06，權威原文）。
3. `docs/SDD.md` — 架構 / 資料模型 / 行為 / 狀態機 / 需求追溯。
4. `diagrams/puml/class_diagram_plantuml.puml` — 權威資料模型。**不要用 GPT 版**（缺 Kennel/DangerLevel、enum 不一致）。

## 實作約定
- 每個實體 `id: UUID`；除特別說明含 `createdAt`/`updatedAt`；不物理刪除（用狀態/`isActive`）。
- Enum 一律照類圖：`PaymentMethod` 只有 `Online` / `CardOnSite`（**無現金**）。
- 狀態機照 SDD §4.4：Booking(9 態)、WorkOrder(7 態)、Kennel(4 態)。
- `AuditLog` 僅追加（DB 層禁 UPDATE/DELETE）；Notification/Audit 走 RabbitMQ 非同步。
- 防超額預約 = Redis 分散式鎖 + DB 唯一約束（FR-03.2）。
- API Gateway 對外只暴露 Booking/CheckIn/Grooming/Cancellation/Auth 五個（單體階段＝路由分組）。

## 工作方式
- AI＝飛快但不負責的初級工程師；人（＋指揮 session）做審查與決策。每個改動對照 SRS/SDD/契約審。
- 小批量：一個 session 一個清楚交付物，別一口氣做整個系統。
- 進度與決策寫進 `docs/learning-journey.md`；session 規劃見 `docs/build-plan.md`。
