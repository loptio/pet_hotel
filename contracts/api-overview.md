# API 契約總覽 · Pet Hotel & Grooming System (S1)

> **單一真相來源**：機器版＝[`openapi.json`](openapi.json)（FastAPI 自動產出，OpenAPI 3.1）；本檔為人讀索引。
> 前端（Claude Design / S3）與後端都對著契約做，**別自己發明字段/端點**。
> 權威資料模型＝`diagrams/puml/class_diagram_plantuml.puml`；行為＝`docs/SDD.md` §4。

## S1 狀態
- 端點皆為**契約樁**：request/response schema 是真的，body 回 **HTTP 501**（業務邏輯／狀態機留給 S2）。
- 規模：**53 operations · 46 paths · 76 schemas**，覆蓋全部用例與 5 張時序圖。
- `uvicorn app.main:app` 起得來、`/docs`（Swagger）與 `/redoc` 看得到全部端點。

## 約定（conventions）
| 項目 | 約定 |
|---|---|
| 版本前綴 | 所有業務端點在 `/api/v1` 之下 |
| URL 命名 | path/query 參數 **snake_case**（`/pets/{pet_id}`、`?service_item_id=`） |
| JSON 命名 | request/response body 一律 **camelCase**（`displayName`、`dangerLevel`、`createdAt`） |
| 主鍵 | 一律 `UUID` |
| 金額 | `Money = { amount: decimal, currency: "TWD" }`（SDD §3.5） |
| 認證 | HTTP Bearer（JWT）。S1 只宣告 scheme + 掛 dependency 供 /docs 顯示，**不強制**；RBAC 與真 JWT 驗證在 S2 |
| 錯誤 | `ErrorOut = { detail, code? }`；建立預約遇高度危險回 **409** |

## 對外暴露範圍（API Gateway 邊界，SDD §2.1）
**只暴露 5 個 Gateway 服務**＝5 個路由前綴分組，**＋** 用例圖要求的飼主寵物資源：

| 分組 (tag) | 前綴 | 對應 SDD 服務 |
|---|---|---|
| **Auth** | `/api/v1/auth` | AuthService（＋帳號/RBAC 管理） |
| **Pets & Health** | `/api/v1/pets` | （飼主面；PetService 在組件圖為內部 — 見「偏離」） |
| **Booking** | `/api/v1/bookings` | BookingService |
| **CheckIn** | `/api/v1/checkin` | CheckInService（＋床位管理） |
| **Grooming** | `/api/v1/grooming` | GroomingService |
| **Cancellation** | `/api/v1/cancellation` | CancellationService |

**內部模組（不對外、無 router）**：`payment`、`notification`、`audit` — 只有 models＋service 樁，由其他服務內部呼叫（Notification/Audit 走 RabbitMQ，S4 接）。

---

## 端點清單

### Auth — `/api/v1/auth`（15）
| Method · Path | 用途 | 追溯 |
|---|---|---|
| POST `/register` | 註冊飼主帳號 | FR-01.1 / UC_Reg |
| POST `/login` | 登入取得 JWT | FR-01.1 / UC_Login |
| POST `/password-reset/request` | 申請密碼重設信 | FR-01.1 / UC_ResetPwd |
| POST `/password-reset/confirm` | 以 token 重設密碼 | FR-01.1 |
| GET `/me` | 取得個人資料 | FR-01.4 / UC_Profile |
| PATCH `/me` | 編輯姓名/電話 | FR-01.4 |
| GET `/accounts` | 列出帳號（管理員） | FR-01.3 |
| POST `/accounts/{account_id}/ban` | 封鎖帳號 | FR-01.3 / UC_Report |
| POST `/accounts/{account_id}/unban` | 解除封鎖 | FR-01.3 |
| POST `/staff` | 建立員工帳號 | FR-01.2 / UC_CreateStaff |
| GET `/roles` | 列出角色 | FR-01.2 / UC_RBAC |
| GET `/permissions` | 列出權限 | FR-01.2 |
| POST `/accounts/{account_id}/roles` | 指派角色 | FR-01.2 |
| DELETE `/accounts/{account_id}/roles/{role_id}` | 移除角色 | FR-01.2 |
| GET `/reports/abnormal-cancellations` | 異常取消報告 | FR-01.3 |

### Pets & Health — `/api/v1/pets`（11）
| Method · Path | 用途 | 追溯 |
|---|---|---|
| POST `` · GET `` | 建立 / 列出寵物檔案 | FR-02.1 / UC_ManagePet |
| GET `/{pet_id}` · PATCH `/{pet_id}` | 取得 / 編輯檔案（含行為備註） | FR-02.1 / 02.6 |
| POST `/{pet_id}/medical-records` | 新增醫療紀錄（**僅追加**） | FR-02.2 |
| GET `/{pet_id}/medical-records` | 列出醫療紀錄 | FR-02.2 |
| POST `/{pet_id}/vaccinations` | 預先錄入疫苗（選填） | FR-02.3 |
| GET `/{pet_id}/vaccinations` | 列出疫苗紀錄 | FR-02.3 |
| POST `/{pet_id}/vaccinations/{vaccination_id}/proof` | 上傳疫苗證明（multipart） | FR-02.4 / UC_UploadVax |
| POST `/{pet_id}/danger-level` | 標記危險等級（櫃台/美容師:低中；管理員:高） | FR-02.7 / UC_MarkDanger |
| POST `/{pet_id}/unblock` | 解除寵物封鎖（管理員） | FR-02.7 / UC_UnblockPet |

### Booking — `/api/v1/bookings`（9）
| Method · Path | 用途 | 追溯 |
|---|---|---|
| GET `/services` | 列出可預約服務項目（標準/豪華房・基礎/完整美容） | FR-03.1 / 03.7 |
| GET `/availability` | 驗證時段/床位可用性（只顯示可用） | FR-03.2 / 06.2 / UC_CheckAvail |
| GET `/pending-review` | 待審核預約清單（櫃台） | FR-02.8 / seq5 |
| POST `` | 建立住宿/美容預約（危險分流；高度→409） | FR-03.1 / 02.8 / seq1 |
| GET `` | 我的預約（current + 歷史，可依狀態過濾） | FR-03.4 / UC_History |
| GET `/{booking_id}` | 預約明細（含項目/寵物/進度） | FR-03.4 / 04.4 / UC_Track |
| POST `/{booking_id}/deposit` | 支付訂金(30%)並確認 | FR-05.3 / seq1 |
| POST `/{booking_id}/final-payment` | 結清尾款（線上/現場刷卡） | FR-05.3 / UC_FinalPay |
| POST `/{booking_id}/review` | 審核（核可/拒絕） | FR-02.8 / seq5 / UC_ReviewPending |

### CheckIn — `/api/v1/checkin`（8）
| Method · Path | 用途 | 追溯 |
|---|---|---|
| POST `` | 報到：核驗預約+晶片+疫苗、配床 | FR-04.1 / 06.1 / seq2 / UC_CheckIn |
| GET `/{booking_id}/verify` | 報到前核驗預約狀態 | FR-04.1 / UC_VerifyBooking |
| POST `/{booking_id}/vaccine` | 櫃台錄入疫苗+自動校驗有效期 | FR-02.5 / 06.1 / seq2 / UC_InputVax |
| POST `/{booking_id}/checkout` | 離開→床位轉清潔中 | FR-06.4 |
| POST `/{booking_id}/emergency` | 櫃台觸發緊急事件（強制 petId+description；建 Booking 層事件，無 workOrderId） | FR-06.3 / SDD §8 / UC_Emergency |
| GET `/kennels` | 列出床位+狀態+住客寵物 | FR-03.6 / UC_ManageKennel |
| PATCH `/kennels/{kennel_id}` | 更新床位狀態（櫃台） | FR-06.4 |
| POST `/kennels/{kennel_id}/available` | 清潔完手動標記空床 | FR-06.4 |

### Grooming — `/api/v1/grooming`（8）
| Method · Path | 用途 | 追溯 |
|---|---|---|
| GET `/work-orders` | 工作單清單 | FR-04.2 |
| GET `/work-orders/{work_order_id}` | 工作單明細（含照片） | FR-04.4 |
| POST `/work-orders/{work_order_id}/start` | 開啟工作單（Pending→PreCheck） | seq3 |
| POST `/work-orders/{work_order_id}/stage` | 更新四階段（PreCheck/Bathing/Drying/Grooming） | FR-04.5 / seq3 |
| POST `/work-orders/{work_order_id}/photos` | 上傳作業照片（multipart） | FR-04.2 |
| GET `/work-orders/{work_order_id}/photos` | 列出作業照片 | FR-04.4 |
| POST `/work-orders/{work_order_id}/complete` | 標記完成（Grooming→Completed） | seq3 |
| POST `/work-orders/{work_order_id}/emergency` | 美容觸發緊急事件（任一階段→Aborted；建 Booking 層事件，帶 workOrderId） | FR-06.3 / seq3 / SDD §8 |

### Cancellation — `/api/v1/cancellation`（1）
| Method · Path | 用途 | 追溯 |
|---|---|---|
| POST `/bookings/{booking_id}` | 取消預約＋套用 24h 退款規則 | FR-03.3 / 05.4 / seq4 / UC_Cancel |

### meta（1）
- GET `/health` — liveness probe。

---

## Enum 速查（紅線，照類圖）
- `PaymentMethod` = **Online · CardOnSite**（**無現金**）
- `BookingStatus`（9）= PendingDeposit · PendingReview · Confirmed · Cancelled · CheckedIn · InProgress · Completed · Aborted · NoShow
- `WorkStatus`（7）= Pending · PreCheck · Bathing · Drying · Grooming · Completed · Aborted
- `KennelStatus`（4）= Available · Reserved · Occupied · Cleaning
- `DangerLevel` = None · Low · Medium · High ｜ `VaccinationStatus` = Pending · Valid · Expired · Rejected
- `AccountStatus` = Active · Banned · Disabled ｜ `CheckInResult` = Success · Blocked
- `ServiceCategory` = Lodging · Grooming ｜ `RoomType` = Standard · Deluxe ｜ `GroomingType` = Basic · Full
- `PaymentType` = Deposit · FinalPay · Refund ｜ `PaymentStatus` = Pending · Authorized · Failed · Refunded ｜ `PaymentProvider` = ECPay
- `NotificationType` = BookingCreated · CheckInSuccess · VaccineExpired · ServiceStageUpdated · ServiceCompleted · Emergency
- `AuditActionType`（9）= BookingCreated · BookingCancelled · CheckInSuccess · CheckInBlocked · ServiceStatusChanged · PaymentProcessed · EmergencyTriggered · DangerLevelUpdated · KennelStatusChanged

---

## 偏離 / 詮釋 SDD 之處（請審）
1. **Pets & Health 對外暴露**：SDD 組件圖把 `PetService` 列為*內部*（判準＝只暴露時序圖中 FE 直接呼叫的服務，而 5 張時序圖未畫寵物 CRUD）。但**用例圖**明列飼主「管理寵物檔案/上傳疫苗證明」、員工/管理員「標記危險/解封」，且 S1 要求「為**每個用例**定義端點」。為使契約完整（前端才建得出寵物畫面），將寵物/健康檔案作為**飼主面資源**對外暴露。其餘內部服務（payment/notification/audit）維持不對外。
2. **床位管理掛在 CheckIn 群組**：`KennelService` 在 SDD 亦為內部；床位管理（UC_ManageKennel, FR-03.6/06.4）是櫃台職能，故端點併入 CheckIn（櫃台）群組，未另開對外服務。
3. **Cancellation 為「僅服務」模組**：類圖無取消實體；它跨 Booking＋PaymentTransaction 運作。實作為 router+schemas+service（無自有 models），以滿足「5 大對外服務含 Cancellation」。
4. **新增 `GET /bookings/services`**：類圖有 `ServiceItem`/`LodgingService`/`GroomingService` 但無「查詢服務目錄」用例；FR-03.1（選服務類型）/03.7（分級服務）與訂房流程需要它，故補上（屬 Booking 群組，非新服務）。
5. **付款結果內嵌於 Booking 流程**：因 PaymentService 內部化，訂金/尾款端點回 `BookingPaymentResultOut`（booking＋精簡 payment 結果），不另開 Payment CRUD（符合時序圖 FE 不直接呼叫 PaymentService）。
6. **欄位慣例補充**：依 CLAUDE.md，所有實體加 `createdAt`/`updatedAt`（僅追加類如 MedicalRecord/AuditLog/WorkPhoto/VaccineProofDocument 只有 `createdAt`）；`ServiceItem` 加 `isActive` 表停用（軟刪除），其餘以狀態 enum 表達。類圖未列這些慣例欄位。
7. **EmergencyEvent 改掛 Booking 層**（`docs/SDD.md §8` 權威修訂，**非本人詮釋**）：原 `WorkOrder *-- EmergencyEvent` → `Booking *-- EmergencyEvent`、`about → Pet`（必填）、`duringStage → WorkOrder`（可空、unique）、`reportedBy`（必填）。理由：FR-06.3 要櫃台亦可觸發、住宿寵物無工作單。契約有**兩個入口、皆建 Booking 層事件**：櫃台 `POST /checkin/{booking_id}/emergency`（強制 petId，無 workOrderId）；美容 `POST /grooming/work-orders/{id}/emergency`（帶 workOrderId、使 WorkOrder→Aborted）。

> 上述 1–6 為「使契約完整且自洽」的最小詮釋，未自行改動類圖；第 7 點依 `docs/SDD.md §8` 權威修訂跟進實作。如需更嚴格只留 5 群組（把寵物等塞進既有群組），或把 Pet 端點延後到 S2，請指示，調整成本低（只動樁路由與 tag）。
