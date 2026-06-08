import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/auth/AuthContext"
import { homeForRole, type Role } from "@/auth/auth"
import { PageLoader } from "@/components/ui/spinner"

/** Gate a subtree behind auth (and optionally specific roles). */
export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { token, role, loading } = useAuth()
  const loc = useLocation()

  if (!token) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (loading) return <PageLoader />
  if (roles && role && !roles.includes(role)) return <Navigate to={homeForRole(role)} replace />
  return <Outlet />
}
