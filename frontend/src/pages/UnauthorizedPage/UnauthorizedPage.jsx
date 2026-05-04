import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../api";
import { logoutUser } from "../../utils/logout";
import styles from "./UnauthorizedPage.module.css";

const ROLE_TO_PATH = {
    admin: "/admin-dashboard",
    auditor: "/auditor-dashboard",
    voter: "/voter-dashboard",
    candidate: "/candidate-dashboard",
};

const ROLE_LABEL = {
    admin: "Administrator",
    auditor: "Auditor",
    voter: "Voter",
    candidate: "Candidate",
    unknown: "Unrecognized",
};

function UnauthorizedPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const initialRole = location.state?.role ?? null;
    const attempted = location.state?.attempted ?? null;

    const [role, setRole] = useState(initialRole);
    const [loading, setLoading] = useState(!initialRole);

    useEffect(() => {
        document.body.classList.add("login-bg");
        return () => document.body.classList.remove("login-bg");
    }, []);

    useEffect(() => {
        if (initialRole) return;
        const token = localStorage.getItem("token");
        if (!token) {
            setLoading(false);
            return;
        }

        let cancelled = false;
        api.get("/api/me/")
            .then((res) => {
                if (!cancelled) setRole(res.data.role);
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [initialRole]);

    const dashboardPath = role ? ROLE_TO_PATH[role] : null;
    const friendlyRole = role ? ROLE_LABEL[role] ?? role : null;

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.iconWrap} aria-hidden="true">
                    <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                </div>
                <h1 className={styles.title}>Access Denied</h1>
                <p className={styles.message}>
                    You don&rsquo;t have permission to view this page.
                    {friendlyRole && (
                        <>
                            {" "}Your account is registered as{" "}
                            <strong>{friendlyRole}</strong>.
                        </>
                    )}
                </p>

                {attempted && (
                    <p className={styles.attempted}>
                        Attempted: <code>{attempted}</code>
                    </p>
                )}

                <div className={styles.actions}>
                    {dashboardPath && (
                        <button
                            type="button"
                            className={styles.primaryBtn}
                            onClick={() => navigate(dashboardPath, { replace: true })}
                            disabled={loading}
                        >
                            Go to my dashboard
                        </button>
                    )}
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => logoutUser(navigate, "/login")}
                    >
                        Log out
                    </button>
                </div>
            </div>
        </div>
    );
}

export default UnauthorizedPage;
