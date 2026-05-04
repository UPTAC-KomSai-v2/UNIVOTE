import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "../../api";
import styles from "./ProtectedRoute.module.css";

function ProtectedRoute({ allowedRoles, children }) {
    const [status, setStatus] = useState("loading");
    const [role, setRole] = useState(null);
    const location = useLocation();

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            setStatus("unauthenticated");
            return;
        }

        let cancelled = false;
        api.get("/api/me/")
            .then((res) => {
                if (cancelled) return;
                const userRole = res.data.role;
                setRole(userRole);
                if (allowedRoles.includes(userRole)) {
                    setStatus("allowed");
                } else {
                    setStatus("wrong-role");
                }
            })
            .catch(() => {
                if (cancelled) return;
                setStatus("unauthenticated");
            });

        return () => {
            cancelled = true;
        };
    }, [allowedRoles]);

    if (status === "loading") {
        return (
            <div className={styles.loader}>
                <span>Verifying access...</span>
            </div>
        );
    }

    if (status === "unauthenticated") {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    if (status === "wrong-role") {
        return (
            <Navigate
                to="/unauthorized"
                replace
                state={{ role, attempted: location.pathname }}
            />
        );
    }

    return children;
}

export default ProtectedRoute;
