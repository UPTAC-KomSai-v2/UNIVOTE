import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../api";
import styles from "./NotFoundPage.module.css";

const ROLE_TO_PATH = {
    admin: "/admin-dashboard",
    auditor: "/auditor-dashboard",
    voter: "/voter-dashboard",
    candidate: "/candidate-dashboard",
};

function NotFoundPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [homePath, setHomePath] = useState("/login");
    const [homeLabel, setHomeLabel] = useState("Go to login");

    useEffect(() => {
        document.body.classList.add("login-bg");
        return () => document.body.classList.remove("login-bg");
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;

        let cancelled = false;
        api.get("/api/me/")
            .then((res) => {
                if (cancelled) return;
                const role = res.data.role;
                const path = ROLE_TO_PATH[role];
                if (path) {
                    setHomePath(path);
                    setHomeLabel("Go to my dashboard");
                }
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <p className={styles.code} aria-hidden="true">404</p>
                <h1 className={styles.title}>Page Not Found</h1>
                <p className={styles.message}>
                    The page you&rsquo;re looking for doesn&rsquo;t exist or may
                    have been moved.
                </p>

                <p className={styles.attempted}>
                    Requested: <code>{location.pathname}</code>
                </p>

                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.primaryBtn}
                        onClick={() => navigate(homePath, { replace: true })}
                    >
                        {homeLabel}
                    </button>
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => navigate(-1)}
                    >
                        Go back
                    </button>
                </div>
            </div>
        </div>
    );
}

export default NotFoundPage;
