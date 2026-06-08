# contracts/ — API 契約（單一真相來源）

前後端、跨 session 的**同步點**。S1 在此產出 OpenAPI（FastAPI 可自動匯出 `openapi.json`）。

規則：
- 前端（Claude design）與後端都**對著契約做**，不自己發明字段/端點。
- 契約變更要留痕（誰、為何、改了什麼）。
- 契約對齊 `docs/SDD.md` 的資料模型與狀態機。
