# frontend/ — React 前端

React + Vite + TypeScript + Tailwind + shadcn/ui。對著 `../contracts/`（凍結 OpenAPI 契約）構建；視覺與 design system 源自 Claude Design 的 handoff。

## 跑法
```bash
npm install && npm run dev      # http://localhost:5173（dev proxy /api → 後端 :8000，免 CORS）
npm run build                   # tsc -b + vite build
```
需後端在 `:8000`（見 `../README.md` 快速開始）。

## 結構
```
src/
├── api/          typed client（手寫，對齊凍結契約）+ endpoints
├── components/   UI primitives（Card/Table/Badge/Dialog/Alert/Input/Spinner…，shadcn 風格）
├── context/      auth（JWT，前端解碼角色做路由守衛）
├── lib/          money/date 格式化、status→label/tone 對映
├── layouts/      飼主行動端 shell · 員工後台 sidebar
└── pages/
    ├── owner/    飼主：Home/ServiceDetail/Booking/BookingDetail/Pets/PetDetail/Me
    └── staff/    櫃台 Checkin·Kennels·PendingReview · 美容師 WorkOrders·WorkOrderDetail
        └── admin/  Accounts·Roles·DangerPets·Reports（RBAC：僅 Admin）
```

## 四角色 RBAC
登入後依 JWT 角色顯示對應導覽與頁面：飼主（行動端）/ 櫃台 / 美容師 / 管理員。路由以 `RequireAuth roles={[...]}` 守衛，後端再以 `require_roles` 二次把關。
