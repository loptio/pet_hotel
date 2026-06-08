import { Navigate, Route, Routes } from "react-router-dom"
import { useAuth } from "@/auth/AuthContext"
import { homeForRole } from "@/auth/auth"
import { RequireAuth } from "@/components/RequireAuth"
import { OwnerLayout } from "@/layouts/OwnerLayout"
import { StaffLayout } from "@/layouts/StaffLayout"

import LoginPage from "@/pages/LoginPage"
import HomePage from "@/pages/owner/HomePage"
import ServiceDetailPage from "@/pages/owner/ServiceDetailPage"
import PetsPage from "@/pages/owner/PetsPage"
import PetDetailPage from "@/pages/owner/PetDetailPage"
import BookingsPage from "@/pages/owner/BookingsPage"
import BookingDetailPage from "@/pages/owner/BookingDetailPage"
import MePage from "@/pages/owner/MePage"
import CheckinPage from "@/pages/staff/CheckinPage"
import KennelsPage from "@/pages/staff/KennelsPage"
import PendingReviewPage from "@/pages/staff/PendingReviewPage"
import WorkOrdersPage from "@/pages/staff/WorkOrdersPage"
import WorkOrderDetailPage from "@/pages/staff/WorkOrderDetailPage"
import AccountsPage from "@/pages/staff/admin/AccountsPage"
import RolesPage from "@/pages/staff/admin/RolesPage"
import DangerPetsPage from "@/pages/staff/admin/DangerPetsPage"
import ReportsPage from "@/pages/staff/admin/ReportsPage"

function RootRedirect() {
  const { token, role } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return <Navigate to={homeForRole(role)} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Owner (mobile) */}
      <Route element={<RequireAuth roles={["Owner"]} />}>
        <Route path="/app" element={<OwnerLayout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="service/:id" element={<ServiceDetailPage />} />
          <Route path="pets" element={<PetsPage />} />
          <Route path="pets/:id" element={<PetDetailPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="bookings/:id" element={<BookingDetailPage />} />
          <Route path="me" element={<MePage />} />
        </Route>
      </Route>

      {/* Staff (web backoffice) */}
      <Route element={<RequireAuth roles={["FrontDesk", "Groomer", "Admin"]} />}>
        <Route path="/staff" element={<StaffLayout />}>
          <Route index element={<RootRedirect />} />
          <Route path="checkin" element={<CheckinPage />} />
          <Route path="kennels" element={<KennelsPage />} />
          <Route path="pending-review" element={<PendingReviewPage />} />
          <Route path="work-orders" element={<WorkOrdersPage />} />
          <Route path="work-orders/:id" element={<WorkOrderDetailPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="danger-pets" element={<DangerPetsPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}
