import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../../api";
import styles from "./RedirectIfAuthenticated.module.css";

const ROLE_TO_PATH = {
    admin: "/admin-dashboard",
    auditor: "/auditor-dashboard",
    voter: "/voter-dashboard",
    candidate: "/candidate-dashboard",
};

function RedirectIfAuthenticated({ children }) {
    const [status, setStatus] = useState("checking");
    const [redirectPath, setRedirectPath] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            setStatus("anonymous");
            return;
        }

        let cancelled = false;
        api.get("/api/me/")
            .then((res) => {
                if (cancelled) return;
                const path = ROLE_TO_PATH[res.data.role];
                if (path) {
                    setRedirectPath(path);
                    setStatus("authenticated");
                } else {
                    setStatus("anonymous");
                }
            })
            .catch(() => {
                if (cancelled) return;
                setStatus("anonymous");
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (status === "checking") {
        return (
            <div className={styles.loader}>
                <span>Loading...</span>
            </div>
        );
    }

    if (status === "authenticated" && redirectPath) {
        return <Navigate to={redirectPath} replace />;
    }

    return children;
}

export default RedirectIfAuthenticated;
