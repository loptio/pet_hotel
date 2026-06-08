# Handoff: 寵物旅館與美容預約系統 — UI（飼主端 + 員工後台）

## Overview
四套角色介面（RBAC）的高保真 UI 設計與設計系統，介面語言為**繁體中文**，風格「**專業 + 溫馨**」。本批交付涵蓋：

- **飼主 Owner**（手機 App，方案 C「服務優先」）：登入 → 探索/服務詳情 → 預約（選寵物＋時段）→ 危險分流 → 付訂金 → 預約成功；我的預約／明細（進度＋照片）／結清尾款／取消退款；我的寵物／檔案＋疫苗上傳。
- **櫃台 Front Desk**（Web）：報到核驗（預約＋晶片＋疫苗有效期，逾期阻斷）、床位看板、待審核佇列（核可/拒絕）、標記危險、觸發緊急事件。
- **美容師 Groomer**（Web）：工作單清單、明細（PreCheck→Bathing→Drying→Grooming 四階段、更新階段、上傳照片、完成、緊急事件）。
- **管理員 Admin**（Web）：帳號管理（封鎖/解封、建員工、指派角色）、RBAC 權限矩陣、危險寵物（標記高度/解封）、異常取消報告。

## About the Design Files
此 bundle 內的 HTML/CSS/JS 是**設計參考（design references）**——以 HTML 製作的原型，用來呈現預期外觀與行為，**不是要直接複製上線的程式碼**。

目標是在**既有 codebase**（`pet-hotel-system/frontend`，**React + Vite + Tailwind + shadcn/ui**）中，以其既有模式重建這些設計。重點：

1. **設計 token 已對齊 shadcn**：`theme.css` 內的 CSS 變數即 shadcn 的 `--background / --primary / --radius …`（HSL 格式）。把 `theme.css` 的 `:root` 內容覆蓋到 `frontend/src/index.css` 既有的（預設 slate）token 即可全域套用主題。`--success / --warning` 為本系統擴充（預約狀態徽章用）。
2. **元件對應 shadcn/ui**：`components.css` 的 class（`.btn`、`.card`、`.badge`、`.alert`、`.input`、`.seg`…）請對應到 shadcn 的 `Button / Card / Badge / Alert / Input / Tabs / Dialog / Sheet` 元件，不要照抄 CSS。
3. **一切對著契約做**：所有畫面只用 `contracts/openapi.json` 內**存在的字段與端點**；狀態用詞照狀態機（Booking 9 態、WorkOrder 四階段、Kennel 4 態）。每個畫面/動作旁的灰色 `mono` 標籤就是對應端點，照著接。

## Fidelity
**High-fidelity（hifi）** — 飼主 App 與員工後台為高保真：含最終配色、字體、間距、圓角、互動與狀態。請以 codebase 既有元件**像素級重建**。
（另有一份**低保真線框** `wireframe/` 供參考結構決策來源；實作以 hifi 為準。）

## Design Tokens（貼進 frontend/src/index.css 的 :root，light）
HSL（shadcn 格式，無 `hsl()` 包裹）：

| Token | HSL | Hex | 用途 |
|---|---|---|---|
| `--background` | `36 38% 96.5%` | #f7f2ea | 暖奶米底 |
| `--foreground` | `25 22% 16%` | #2e2620 | 暖墨文字 |
| `--card` | `40 50% 99.5%` | #fffdfa | 卡片 |
| `--secondary` | `33 32% 91%` | #ece2d6 | 次要面 |
| `--muted` | `35 28% 92.5%` | #efe7db | 靜音面 |
| `--muted-foreground` | `28 12% 46%` | #7d7064 | 次要文字 |
| `--accent` | `30 44% 88%` | #ecdcc9 | 強調面 |
| `--border` / `--input` | `32 24% 85%` | #e0d4c4 | 邊框/輸入框 |
| `--primary` / `--ring` | `22 72% 52%` | #d2733a | 主色 terracotta |
| `--primary-foreground` | `40 40% 98%` | — | 主色上文字 |
| `--destructive` | `6 64% 48%` | #c93f35 | 阻斷/高度危險 |
| `--success`（擴充） | `142 32% 38%` | #41804f | 低度/已確認/空床 |
| `--warning`（擴充） | `36 78% 44%` | #c8881a | 中度/待處理 |
| `--radius` | `0.85rem` | — | 基準圓角 |

- **字體**：UI 用 **Noto Sans TC**（400/500/600/700）；金額、ID、晶片號、時間用 **DM Mono**（等寬對齊）。
- **配色變體**（選配，design 內可切）：森林綠 `--primary:150 36% 34%`、珊瑚紅 `--primary:8 74% 58%`。**預設用 terracotta（latte）**。語意色（success/warning/destructive）跨變體固定。
- **陰影**：暖調，見 `theme.css` 的 `--shadow-xs/sm/md/lg`。
- **間距/圓角階梯**：見 `theme.css`（`--radius-sm…2xl`）。

## 狀態用詞與顏色（照狀態機，務必一致）
- **Booking（9 態）**：`PendingDeposit 待付訂金`(warn) · `PendingReview 待審核`(warn) · `Confirmed 已確認`(success) · `CheckedIn 已報到`(success) · `InProgress 服務中`(brand) · `Completed 已完成`(neutral) · `Cancelled 已取消`(neutral) · `NoShow 未到場`(neutral) · `Aborted 異常終止`(danger)
- **WorkOrder**：`Pending 待處理` · `PreCheck 預檢` · `Bathing 洗澡` · `Drying 烘乾` · `Grooming 剪毛` · `Completed 已完成`（進行中階段=brand）
- **Kennel（4 態）**：`Available 空床`(success/虛線) · `Reserved 已預約`(warn) · `Occupied 已入住`(brand) · `Cleaning 清潔中`(neutral)
- **DangerLevel**：`None 無` · `Low 低度`(success) · `Medium 中度`(warn) · `High 高度`(danger)
- **Vaccination**：`Valid 有效`(success) · `Pending 待驗證`(warn) · `Expired 逾期`(danger) · `Rejected 駁回`(danger)
- 徽章樣式對照見 `Design System.html` 的「狀態系統」。

## 關鍵業務規則（實作必守，源自 SRS/SDD）
- **危險分流（FR-02.8）**：建立預約 `POST /bookings` 時依寵物 `dangerLevel`：`High`→**409 拒絕**（須 Admin `POST /pets/{id}/unblock` 解封）；`Medium`→201 `status=PendingReview`（櫃台 `POST /bookings/{id}/review` 核可後才付款）；`None/Low`→201 `status=PendingDeposit`（低度報到時提醒）。
- **訂金（FR-05.3）**：訂金 = 預估總額 **30%**（`POST /bookings/{id}/deposit`）；尾款報到日結清（`POST /bookings/{id}/final-payment`），方式僅 `Online`/`CardOnSite`（無現金）。
- **退款 24h（FR-05.4）**：開始前 ≥24h 取消全額退；<24h 或未到場不退（`POST /cancellation/bookings/{id}`，原因必填）。
- **報到（FR-04.1/06.1）**：`POST /checkin {bookingId, chipId}` 核驗 預約＋晶片＋疫苗；疫苗逾期→`result=Blocked`、報到阻斷待補件；成功→`result=Success`＋`kennelNumber`，床位轉 Occupied、預約轉 CheckedIn。
- **防超額（FR-03.2/06.2）**：時段僅顯示可用（`GET /bookings/availability`）；後端 Redis 鎖＋DB 唯一約束。
- **緊急事件（FR-06.3）**：櫃台 `POST /checkin/{id}/emergency`、美容師 `POST /grooming/work-orders/{id}/emergency`，**事件描述必填**。
- **付款不落地（NFR-03）**：付款資訊全程由 ECPay 處理，不存系統。

## Files（design references）
- `index.html` — **飼主 App**（手機，方案 C）入口
- `員工後台.html` — **櫃台／美容師／管理員** Web 後台（含 RBAC 角色切換）
- `Design System.html` — 設計系統總覽（色/字/圓角/元件/狀態/可貼用 token）
- `hifi/theme.css` — **設計 token（shadcn 相容）**
- `hifi/components.css` — 共用元件樣式（對應 shadcn 元件）
- `hifi/app.css` `hifi/app.js` — 飼主 App 版面與路由/互動
- `hifi/staff.css` `hifi/staff.js` — 員工後台版面與路由/互動
- `hifi/image-slot.js` — 圖片占位元件（設計用；實作改為一般 `<img>`/上傳）
- `hifi/img/` — **品牌占位圖**（logo、hero、服務／分類、寵物頭像、作業照）：以暖色漸層＋肉球母題生成，供版位示意；實作時換成真實照片（疫苗證明、作業照片走 S3/MinIO）。`<image-slot src=…>` 已填這些圖為預設，仍可由使用者拖放替換。
- **RBAC 註記**：員工後台採單一固定角色（依登入身分）；側欄底部顯示當前身分＋登出。右下「預覽角色」浮層**僅為設計展示**用來切換三台預覽，**非系統功能**，實作請勿保留。
- `wireframe/` — 低保真線框（飼主流程三方案探索，僅供結構參考）
- 各畫面/動作旁的 `mono` 標籤＝對應 `contracts/openapi.json` 端點

詳細每屏的版面、元件、互動與狀態，見 `SCREENS.md`。
