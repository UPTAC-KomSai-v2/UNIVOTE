import React from "react";
import { Navigate, Outlet, useLocation } from 'react-router-dom';

// We store the role in localStorage solely for UI routing logic.
// Security is handled by the backend rejecting the HttpOnly cookie if invalid.
const RequireAuth = ({ allowedRoles }) => {
    const location = useLocation();
    const userRole = localStorage.getItem('userRole');
    
    console.log("Allowed roles: ", allowedRoles);
    console.log("User Role: ", userRole)

    // if no role found, kick to login
    if (!userRole) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    if (!allowedRoles.map(r => r.toLowerCase()).includes(userRole.toLowerCase())) {
        return <Navigate to="/unauthorized" replace />;
    }

    return <Outlet />;
}

export default RequireAuth;