# 軟體設計說明書（SDD）— 寵物旅館與美容預約系統

> 版本 v1.0　|　需求基準：`SRS.md`　|　圖檔：`../diagrams/png/`（視覺）、`../diagrams/puml/`（文字源）
> **設計基準＝手繪 draw.io 一套**：各圖之間彼此一致（類圖的 enum＝狀態機、組件＝時序 lifeline），這對實作最重要。
> ⚠️ 類圖**不採用 GPT/Opus 版**：它雖屬性較全，但漏掉 `Kennel` 與 `DangerLevel`、enum（CASH／超範圍服務類別／狀態值）與狀態機不一致。權威資料模型＝`diagrams/puml/class_diagram_plantuml.puml`。

---

## 1. 簡介
本文件描述系統的架構、資料模型與行為設計，作為實作依據。讀者為開發、架構與測試人員。所有設計可追溯至 `SRS.md` 之 FR/NFR。

**設計視圖對應圖檔**
| 視圖 | 圖 |
|---|---|
| 範圍 | `use_case_diagram_drawio.png` |
| 業務流程 | `activity_diagram_drawio1/2/3.png`（建立預約・報到・服務執行） |
| 資料模型 | `class_diagram_drawio.png` ＋ `class_diagram_plantuml.puml` |
| 邏輯架構 | `component_diagram_drawio.png` |
| 部署架構 | `deployment_diagram_drawio.png` |
| 元件協作 | `sequence_diagram_drawio1..5.png` |
| 物件生命週期 | `state_diagram_drawio1/2/3.png`（Kennel・WorkOrder・Booking） |

---

## 2. 架構設計

### 2.1 邏輯架構（Component）
五層、由 API Gateway 統一入口（`component_diagram_drawio.png`）：

- **Client**：Mobile App（iOS／Android）、Web App（SPA）
- **API Gateway**：RBAC 驗證入口（FR-01.2）；**僅對外暴露 5 個 Service**：Booking、CheckIn、Grooming、Cancellation、Auth
- **Application Layer（10 個 Service）**
  - 對外：`BookingService`、`CheckInService`、`GroomingService`、`CancellationService`、`AuthService`
  - 內部：`PetService`、`KennelService`、`PaymentService`、`NotificationService`、`AuditService`
- **Domain Layer**：Account & Authorization｜Pet & Health Records｜Booking & Service Execution｜Payment, Notification & Audit
- **External**：ECPay 金流、FCM／APNs 推播

**判準**：Frontend 在時序圖中直接呼叫過的 Service 才需從 Gateway 暴露，其餘為內部依賴。

### 2.2 部署架構（Deployment）
Docker 容器化微服務、跑在 Kubernetes、雲無關（`deployment_diagram_drawio.png`）：

- 每個 Service ＝ 1 容器／1 Pod。
- **資料層**：PostgreSQL（Primary＋Replica 串流複寫，NFR-04）、Redis（快取＋**分散式鎖**）、RabbitMQ（Notification／Audit 非同步）、Object Storage（MinIO／S3，存作業照片與疫苗文件）。
- **External**：ECPay（HTTPS，付款不落地 NFR-03）、FCM／APNs（HTTPS）。
- 本地以 `docker-compose` 起全套；上雲換任意託管 K8s。

### 2.3 關鍵架構決策
| 決策 | 理由 / 對應 |
|---|---|
| API Gateway 統一 RBAC | FR-01.2；單一驗證入口 |
| Notification／Audit 走 RabbitMQ 非同步 | 不阻塞主流程；Audit 以「事件→僅追加寫入」實作 FR-05.2 |
| Redis 分散式鎖鎖定時段／床位 | 防超額預約 FR-03.2；NFR-04 一致性的落點 |
| 二進位檔放 Object Storage | 疫苗證明 FR-02.4、作業照片 FR-04.2；DB 只存 metadata＋URL |
| 第三方金流 | NFR-03 付款不落地 |
| 模組化、不跨層依賴 | NFR-06 可維護性 |

---

## 3. 資料設計（Domain Model）

權威來源：`diagrams/puml/class_diagram_plantuml.puml`。四個套件如下。

### 3.1 Account & Authorization
`Account`、`Role`、`Permission`、`RoleAssignment`（Account ⇆ Role 多對多經 RoleAssignment；Role ⇆ Permission）。
Enum：`AccountStatus { Active, Banned, Disabled }`。

### 3.2 Pet & Health Records
`Pet`（含 `chipId`、`behaviorNote`、`dangerLevel`、`dangerNote`、`isBlocked`）、`VaccinationRecord`（`expiresAt`、`status`、`verifiedAt`、verifiedBy→Staff）、`VaccineProofDocument`、`MedicalRecord`（僅可新增，不可改刪 FR-02.2）。
Enum：`DangerLevel { None, Low, Medium, High }`、`VaccinationStatus { Pending, Valid, Expired, Rejected }`。

### 3.3 Booking & Service Execution
- 服務分級（FR-03.7）：抽象 `ServiceItem` ← `LodgingService`(`roomType`)、`GroomingService`(`groomingType`)。
- 床位（FR-03.6）：`Kennel`（`kennelNumber`、`type`、`status`）。
- 預約：`Booking`（`status`、`depositAmount`、`totalAmount`…）、`BookingItem`、`BookedPet`（中介，Booking⇆Pet）、`AvailabilitySlot`、`ResourceAllocation`（鎖定資源）。
- 執行：`CheckIn`（`result`、handledBy→Staff）、`WorkOrder`（`status`、assignedTo→Groomer）、`WorkPhoto`、`EmergencyEvent`。
- Enum：`ServiceCategory { Lodging, Grooming }`、`RoomType { Standard, Deluxe }`、`GroomingType { Basic, Full }`、`KennelStatus { Available, Reserved, Occupied, Cleaning }`、`BookingStatus`（見 §4.4，9 態）、`WorkStatus`（7 態）、`CheckInResult { Success, Blocked }`。

### 3.4 Payment, Notification & Audit
- `PaymentTransaction`（`type`、`method`、`status`、`provider`、`providerTxnId`）。
- `Notification`（`type`、`status`）。
- `AuditLog`（`actionType`、`entityType`＋`entityId`、`operatorId`）— **多態、獨立存在、不被任何聚合擁有、僅追加**（FR-05.2）。
- 外部介面：`PaymentGateway`、`PushGateway`（`<<external>>`）。
- Enum：`PaymentType { Deposit, FinalPay, Refund }`、`PaymentMethod { Online, CardOnSite }`（**無現金**）、`PaymentStatus { Pending, Authorized, Failed, Refunded }`、`PaymentProvider { ECPay }`、`NotificationType {...}`、`NotificationStatus { Pending, Sent, Failed }`、`AuditActionType {...}`。

### 3.5 實作慣例
- 所有實體：`id: UUID` 主鍵；除特別說明外含 `createdAt`／`updatedAt`。
- 軟刪除：以 `isActive`／狀態 enum 表達，不物理刪除（呼應 FR-02.2 不可改刪、FR-05.2 稽核）。
- 金額型別 `Money`（建議 decimal，含幣別）。
- `AuditLog` 不可 UPDATE／DELETE（DB 層 append-only）。

---

## 4. 行為設計

### 4.1 用例（範圍）
見 `use_case_diagram_drawio.png`：4 個人類 Actor＋2 個外部系統；含 include（報到核驗、訂金、稽核）與 extend（疫苗逾期、緊急事件、退款）關係。每個用例對應一條 FR。

### 4.2 業務流程（Activity，3 張）
1. **建立預約與支付訂金**（`activity_diagram_drawio1.png`）：危險等級三段分流（高拒／中審／低繼續）→ 時段驗證 → 鎖定資源 → 訂金付款（成功建單／失敗釋放）。
2. **報到與疫苗驗證**（`drawio2`）：晶片核對 → 疫苗錄入與有效期校驗（逾期阻斷）→ 分配床位 → 通知。
3. **服務執行與狀態通知**（`drawio3`）：工作單四階段逐步更新 → 每階段推播 → 正常完成／緊急事件終止。

### 4.3 元件協作（Sequence，5 張，Service 層粒度）
| # | 場景 | 檔 |
|---|---|---|
| 1 | 建立預約與支付訂金（危險分流／時段／付款 alt） | `sequence_diagram_drawio1.png` |
| 2 | 櫃台報到與疫苗驗證（晶片／逾期阻斷／配床） | `drawio2` |
| 3 | 美容服務執行（四階段 loop／緊急事件 alt） | `drawio3` |
| 4 | 取消與退款（24h 規則／ECPay 退款） | `drawio4` |
| 5 | 櫃台審核待審預約（核可後飼主付款） | `drawio5` |

約定：對 `NotificationService`／`AuditService` 一律非同步（`-->>`）；跨 Lifeline 同步呼叫才加 activation。

### 4.4 狀態機（State，3 個 — 實作為狀態機的權威）

**Booking（9 態）** `state_diagram_drawio3.png`
`PendingDeposit → Confirmed`（付款成功）｜`→ PendingReview`（中度危險）｜`→ Cancelled`（付款失敗／放棄）
`PendingReview → PendingDeposit`（審核通過）｜`→ Cancelled`（拒絕）
`Confirmed → CheckedIn`（報到）｜`→ Cancelled`（取消）｜`→ NoShow`（逾 2h，FR-03.5）
`CheckedIn → InProgress → Completed`（正常）｜`InProgress → Aborted`（緊急事件）
終態：Completed／Cancelled／NoShow／Aborted。

**WorkOrder（7 態）** `state_diagram_drawio2.png`
`Pending → PreCheck → Bathing → Drying → Grooming → Completed`；**任一階段（含 Pending）皆可 `emergencyTriggered → Aborted`**（FR-06.3）。

**Kennel（4 態，循環，無終態）** `state_diagram_drawio1.png`
`Available → Reserved`（預約確認）｜`Reserved → Available`（取消／未到場）｜`Reserved → Occupied`（報到配床）｜`Occupied → Cleaning`（離開）｜`Cleaning → Available`（櫃台手動，FR-06.4）。

---

## 5. 跨領域設計決策
- **RBAC**：Gateway 驗證 → 各 Service 依角色（Owner／FrontDesk／Groomer／Admin）授權（FR-01.2）。
- **一致性**：付款狀態與服務／資源狀態須在同一交易邊界內更新；跨服務以「事件＋冪等消費」收斂（NFR-04）。
- **防超額**：時段／床位以 Redis 分散式鎖 + DB 唯一約束雙重保障（FR-03.2）。
- **未到場排程**：背景排程器掃描 `Confirmed` 且逾時段+2h 之預約 → `NoShow` 並釋放資源（FR-03.5）。
- **退款**：取消時依 24h 規則決定全額退／不退，經 ECPay 退款；失敗標 Pending 重試（FR-05.4）。
- **稽核**：所有狀態變更發事件入 RabbitMQ，`AuditService` 僅追加寫入（FR-05.2）。

---

## 6. 需求 → 設計 追溯
| FR/NFR | 設計落點 |
|---|---|
| FR-01.2 RBAC | API Gateway＋AuthService |
| FR-02.7/02.8 危險等級 | `Pet.dangerLevel`／Booking 之 PendingReview 分支 |
| FR-03.2 防超額 | Redis 鎖＋`ResourceAllocation`＋DB 約束 |
| FR-03.5 未到場 | 排程器＋Booking.NoShow |
| FR-03.6 床位 | `Kennel` 實體＋Kennel 狀態機 |
| FR-03.7 服務分級 | `ServiceItem` 繼承＋RoomType／GroomingType |
| FR-04.5 四階段 | `WorkOrder`＋WorkStatus 狀態機 |
| FR-05.2 稽核 | `AuditLog`（多態、append-only）＋RabbitMQ |
| FR-05.3/05.4 訂金／退款 | `PaymentTransaction`（PaymentType）＋CancellationService |
| FR-06.1 疫苗校驗 | CheckInService＋`VaccinationRecord.expiresAt` |
| NFR-02 效能 | CDN＋Redis 快取 |
| NFR-03 付款不落地 | PaymentService → ECPay |
| NFR-04 一致性 | PostgreSQL 主從＋交易邊界 |
| NFR-06 可維護性 | 模組化微服務、雲無關 K8s |

---

## 7. 圖檔索引
- 視覺：`../diagrams/png/`（15 張，手繪 draw.io 一致版）
- 文字源（可 plantuml 編譯／供程式碼生成）：`../diagrams/puml/`（class／state／sequence×5／component／deployment／activity×3／use case）

---

## 8. S1 評審修訂（2026-06-09 · 契約凍結前）
契約評審時對著 FR 逐條核對，發現兩處需與設計對齊，已更新（**未改動類圖其他實體/enum/關係**）：

1. **EmergencyEvent 改掛 Booking 層**（原 `WorkOrder *-- EmergencyEvent`）。
   理由：FR-06.3 要求**櫃台與美容師皆可觸發**緊急事件；住宿（lodging）寵物無 grooming WorkOrder，原模型無法記錄其緊急事件。
   現：`Booking "1" *-- "0..*" EmergencyEvent`、`--> Pet : about`、可選 `--> WorkOrder : duringStage`、`--> Account : reportedBy`。
   契約對應：新增櫃台端點 `POST /api/v1/checkin/{booking_id}/emergency`；grooming 的 `.../work-orders/{id}/emergency` 保留（美容場景）。WorkOrder 的 `emergencyTriggered→Aborted` 轉移（§4.4）對美容場景仍適用。

2. **Pets & Health 對飼主暴露**（§2.1 組件圖原列 PetService 為內部）。
   理由：判準「只暴露時序圖中 FE 直接呼叫的服務」漏算——5 張時序圖未畫寵物 CRUD，但用例圖明列飼主管理寵物/上傳疫苗（FR-02.*）。組件圖屬**漏列**，非 Pet 應內部化。
   現：`/api/v1/pets` 作飼主面資源對外；payment/notification/audit 維持內部。

> 偏離/詮釋全清單見 `../contracts/api-overview.md` 末段。

---

## 9. S2b 評審決議（2026-06-09 · 後端完成）
S2b 實作訂單生命週期時提出三處與凍結契約的張力，指揮側裁決如下（**契約/enum 維持凍結，S3 不受影響**）：

1. **no-show 維持 CLI 腳本，不加 HTTP 端點**：FR-03.5 屬系統自動化（非使用者觸發），前端無需此端點；加端點會破壞凍結契約而無 demo 收益。實作＝`BookingService.mark_no_shows()` + `backend/scripts/no_show_sweep.py`（手動／cron 觸發）。
2. **住宿狀態支線成立**：補 `CheckedIn→Completed`（住宿退房直結，無 InProgress 子態）與 `CheckedIn→Aborted`（住宿緊急）。§4.4 原措辭偏美容，此為住宿路徑必要補全；權威轉移表見 `backend/app/modules/booking/state.py`。
3. **audit/notification enum 不擴充**：FR-05.2 要求的稽核事件（建立/取消、報到成功/阻斷、服務狀態變更、付款、緊急）已被現有 9 個 `AuditActionType` 涵蓋；額外的 confirmed/reviewed/no-show 非 FR-05.2 明列，以既有值替代、語意由通知標題/內容承載。擴 enum＝紅線改動＋migration，無需求支撐，故不改。
