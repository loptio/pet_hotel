# SCREENS — 逐畫面規格

> 量測單位 px；顏色用 token 名（值見 README）。字級用 `theme.css` 階梯：display 28 / h1 22 / h2 18 / h3 15.5 / body 14 / sm 12.5 / xs 11。圓角 `--radius`=0.85rem。每屏列出對應 `openapi.json` 端點。

---
# A. 飼主 App（手機，390×844，方案 C 服務優先）
全域：iPhone 直式，底部 Tab（探索／預約／寵物／我的，44px 命中區，選中 `--primary`）。畫面切換左右滑入 .26s。Overlay 分 sheet（底部彈窗，圓角 26 上緣）與 modal（置中卡）。

## A1 登入　`POST /auth/login`・`/auth/register`
- 垂直置中：LOGO（72 圓角方塊，主色漸層）＋「寵物旅館」display ＋副標「把毛孩，交給信賴的人」。
- 兩個 input（Email/密碼，高 46，圓角 md）＋ `btn primary lg block`「登入」＋「忘記密碼？／註冊新帳號」列。

## A2 探索首頁（home tab）　`GET /bookings/services`
- Hero 230px：image-slot 滿版＋底部漸層遮罩，疊「午安，王小明」eyebrow ＋「想為毛孩安排什麼？」display(白)。
- 服務分類：兩張 `cat-card`（住宿／美容），104px，圖上深色漸層＋白字標題＋副標（標準/豪華、基礎/完整）。點擊→設定 service→A3。
- 熱門方案：`svc-card`（圖 120px ＋標題＋副標＋評分星＋價格/單位）。點擊→A3。

## A3 服務詳情　`GET /bookings/services`
- 頂部大圖 248px（image-slot）＋左上返回圓鈕。
- 內容：分類 badge＋名稱 h1＋價格（主色）；5 星＋評價數；描述 body(muted)。
- 「方案內含」清單（✓ 綠＋項目）。「選擇分級」`seg`（標準/豪華 或 基礎/完整）→ 切換即時更新名稱/價格/內含/訂金。
- 疫苗提示卡（flat）。
- 底部固定列：訂金 30% 金額 ＋ `btn primary lg`「立即預約」→ 開 A4 sheet。

## A4 預約 sheet　`GET /bookings/availability`
- 標題「預約 · {分級}」＋關閉。
- 「為哪位毛孩預約？」chip（旺財/毛球，選中主色；危險寵物帶 ⚠）。
- 「選擇住宿期間/時段」：
  - 住宿→月曆（7 欄；可選日 .edge 主色實心、區間 .in 淡面、額滿劃線 .full、不可點）。
  - 美容→日期 chip 列＋時段清單（timeslot，選中主色、額滿虛線禁用）。
- info alert「僅顯示可預約時段」。底部訂金 30%＋`btn primary lg`「前往確認」→ 關 sheet、開 A5 modal。

## A5 確認 modal（危險分流核心）　`POST /bookings`
- 標題「確認預約」＋右上狀態 badge（依危險）。
- 摘要卡：寵物／服務／期間／預估總額／**訂金 30%（本次支付，主色）**／尾款（muted）。
- **分流 alert + CTA**（依 `pet.dangerLevel`）：
  - `None`：無 alert，CTA「確認並付訂金」→ A6 pay sheet。
  - `Low`：success alert「報到時提醒」，CTA 同上。
  - `Medium`：warn alert「送出後待審核」，CTA「送出待審核」→ **不收款**，開「待審核」modal（badge `PendingReview`）。
  - `High`：danger alert「無法線上預約…管理員解除封鎖」，CTA `disabled`「無法送出」＋「聯繫門市」。對應 `409 DANGER_LEVEL_HIGH`。

## A6 付訂金 sheet　`POST /bookings/{id}/deposit`
- 大字訂金金額（主色）＋「預估總額 30%」。
- 支付方式：兩張 radio 卡（線上付款 Online／現場刷卡 CardOnSite）。info alert「ECPay 處理，不留存」。
- `btn primary lg`「確認付款」→ A7 success modal。

## A7 預約成功 modal
- 🎉 success-icon（pop 動畫）＋「預約成功！」＋訂金已付文案＋badge `Confirmed`＋摘要列。
- CTA「查看預約明細」→ 預約明細；「回首頁」。

## A8 我的預約（bookings tab）　`GET /bookings?status=`
- 標題＋鈴鐺。`seg`（進行中／歷史）。
- 卡列：每筆＝寵物·服務＋狀態 badge＋時間/床位；`PendingDeposit` 卡帶「付訂金」按鈕；`Cancelled` 卡淡化。

## A9 預約明細　`GET /bookings/{id}`・`/grooming/work-orders`
- 返回列。標題＋狀態 badge＋床位/時間。
- 服務進度 stepper（住宿：報到→照護中→退房；美容：四階段）；節點 done=success、now=主色光暈。
- 照護照片 grid（image-slot＋空位）。
- 金額卡：預估／已付訂金（綠扣減）／**尾款（主色）**。
- 底部：`btn danger`「取消預約」(→A10) ＋ `btn primary`「結清尾款」(`POST /bookings/{id}/final-payment`)。

## A10 取消退款 sheet　`POST /cancellation/bookings/{id}`
- warn alert 退款規則（≥24h 全額／<24h 不退）。
- 卡：距開始（綠）＋可退訂金（綠/全額）。原因 textarea（必填）。`btn danger`「確認取消並退款」。

## A11 我的寵物（pets tab）　`GET /pets`
- 卡列：頭像＋名字＋危險 badge＋品種/性別/年齡＋chevron。`btn outline dashed`「新增寵物」。

## A12 寵物檔案　`GET /pets/{id}`・`POST …/vaccinations/{id}/proof`
- 頭像（circle）＋名字＋危險 badge＋品種。
- 資料卡：晶片號（mono）／行為備註／危險說明（危險時，紅）。
- 疫苗紀錄：有效卡（badge Valid＋有效期＋證明檔）／待上傳卡（虛線＋`btn outline`「上傳證明文件」）。
- 醫療背景卡（僅可新增不可改，FR-02.2）。

## A13 我的（me tab）
- 頭像＋姓名＋Email/電話。設定列（個人資料/我的寵物/預約紀錄/通知/付款/客服）＋登出。

---
# B. 員工後台（Web，sidebar 248 + main）
全域：左側深色 sidebar（brand＋角色功能 nav＋底部 RBAC 角色切換）；右側 topbar（頁標＋副標＋緊急事件鈕（非 admin）＋配色鈕＋角色 chip）＋可捲動 content（page 最大寬 1180）。Dialog 置中（480 寬）。**nav 依角色變化（RBAC）**。

## B-櫃台 1 報到核驗　`POST /checkin`・`GET /checkin/{id}/verify`・`POST /checkin/{id}/vaccine`
- 左：今日報到清單（卡，含危險 badge）。右：選取後顯示核驗面板。
- 核驗 4 列（vico ✓/✕/!）：預約狀態／晶片核對／疫苗有效期／危險等級。
- 疫苗有效→success alert＋`btn primary lg`「完成報到並分配床位」→「報到成功 床位 A-13」dialog（`result=Success, kennelNumber`）。
- 疫苗逾期→danger alert「報到阻斷（FR-06.1）」＋禁用按鈕。
- 下方：「標記危險等級」(`POST /pets/{id}/danger-level` Low/Medium)、「觸發緊急事件」(`POST /checkin/{id}/emergency`，描述必填) dialog。

## B-櫃台 2 床位看板　`GET /checkin/kennels`・`PATCH /checkin/kennels/{id}`・`POST …/available`
- 4 個 KPI（空床/已預約/已入住/清潔中數）。
- kennel-grid（auto-fill 132px）：每格 編號＋房型＋住客＋右上狀態 badge；色：available 虛線、occupied 主色、reserved 琥珀、cleaning 灰。
- 點 occupied/cleaning→dialog（住客/期間；cleaning 顯「標記為空床」＝清潔完成手動，FR-06.4）。

## B-櫃台 3 待審核佇列　`GET /bookings/pending-review`・`POST /bookings/{id}/review`
- table：寵物/飼主・服務・危險 badge・說明・送出時間・[拒絕][核可]。
- 點擊→dialog（核可備註/拒絕原因＋staffNote）；核可→`PendingDeposit`，拒絕→`Cancelled`。

## B-美容師 1 工作單清單　`GET /grooming/work-orders`
- wo-grid 卡（auto-fill 290px）：寵物＋服務＋狀態 badge＋四段 mini-stage 進度條＋飼主/開始時間。依狀態排序（進行中優先）。點擊→明細。

## B-美容師 2 工作單明細　`POST …/start`・`/stage`・`/photos`・`/complete`・`/emergency`
- 返回鈕。左 panel：標題＋狀態；Pending→「開始工作單」(`/start`)；四階段 `stage-btn`（done=綠、now=主色框可點→點擊推進至下一階段、未到=禁用）；底部「標記完成服務」(`/complete`)＋「緊急事件」(`/emergency`)。
- 右 panel：作業照片 grid（image-slot＋上傳位）＋info alert「每階段完成自動推播（FR-04.5）」。

## B-管理員 1 帳號管理　`GET /auth/accounts`・`POST …/ban`・`/unban`・`POST /auth/staff`
- toolbar：搜尋＋「建立員工帳號」(`/auth/staff`，roleName) dialog。
- table：姓名/Email(mono)/角色/狀態 badge/[指派角色][封鎖|解封]。指派角色→`POST/DELETE /auth/accounts/{id}/roles`。

## B-管理員 2 角色與權限　`GET /auth/roles`・`/auth/permissions`
- 左：角色清單。右：權限矩陣（權限 × 4 角色，✓ 綠）。

## B-管理員 3 危險寵物　`POST /pets/{id}/danger-level`・`/pets/{id}/unblock`
- table：寵物/品種/飼主/危險 badge/狀態（已封鎖紅）/[標記高度危險][解除封鎖]（僅 Admin 可 High/unblock）。

## B-管理員 4 異常取消報告　`GET /auth/reports/abnormal-cancellations`
- 3 KPI（近 30 天取消／不退款異常／高風險帳號）。table：預約/飼主/原因/已退款 badge/取消日；高風險帳號列淡紅底（保存 ≥180 天，NFR-05）。

---
## Interactions / State 摘要
- **路由**：飼主用 screen 切換（active class）＋ overlay 堆疊；後台用 view 切換（依角色 nav）。
- **危險分流 state**：`pet.dangerLevel` 驅動 A5 的 alert/CTA 與後台標記流程——這是全系統最關鍵的條件邏輯。
- **金額**：總額 = 單價 × 數量（住宿=晚數，美容=1）；訂金 = round(總額 × 0.3)；尾款 = 總額 − 訂金。
- **動畫**：screen 滑入 .26s；sheet translateY .3s cubic-bezier(.22,1,.36,1)；success-icon pop .4s。reduced-motion 應退化為直接顯示。
- **響應式**：後台 ≤1080px 時 `.cols.c2/.c3` 改單欄。

## Assets
- 圖片：design 用 `<image-slot>` 占位（hero/服務/寵物/作業照）；實作改為一般 `<img>` ＋上傳元件（疫苗證明、作業照片走 S3/MinIO，見 SDD）。
- 圖示：inline SVG（簡單線性），可替換為 codebase 既有 icon 庫（如 lucide-react，shadcn 預設）。
- 字體：Google Fonts — Noto Sans TC、DM Mono。
