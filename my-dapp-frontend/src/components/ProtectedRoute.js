import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, allowedRole }) {
  const currentUserStr = sessionStorage.getItem("currentUser");
  let currentUser = {};
  try {
    if (currentUserStr) {
      currentUser = JSON.parse(currentUserStr);
    }
  } catch (e) {
    // ignore
  }

  if (!currentUser || !currentUser.id) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole) {
    const roles = Array.isArray(allowedRole) ? allowedRole : [allowedRole];
    if (!roles.includes(currentUser.role)) {
      // Redirect to proper dashboard based on role
      if (currentUser.role === "admin") {
        return <Navigate to="/admin/dashboard" replace />;
      } else {
        return <Navigate to="/dashboard" replace />;
      }
    }
  }

  return children;
}
