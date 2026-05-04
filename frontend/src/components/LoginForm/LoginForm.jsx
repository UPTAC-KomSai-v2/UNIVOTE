import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api'
import styles from './LoginForm.module.css'

function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const res = await api.post("/api/login/", {
                email,
                password
            })

            const data = res.data

            localStorage.setItem("token", data.access)
            localStorage.setItem("refresh", data.refresh)

            switch (data.role) {
                case "admin":
                    navigate("/admin-dashboard")
                    break;
                case "auditor":
                    navigate("/auditor-dashboard")
                    break;
                case "candidate":
                    navigate("/candidate-dashboard")
                    break;
                case "voter":
                    navigate("/voter-dashboard")
                    break;
                default:
                    navigate("/unauthorized");
            }
        } catch (error) {
            console.error("Login error:", error);

            if (!error.response) {
                setError(
                    "Cannot reach the server. Please check your connection and try again."
                );
                return;
            }

            const status = error.response.status;
            if (status === 401 || status === 400) {
                setError("Invalid email or password.");
            } else if (status >= 500) {
                setError("Server error. Please try again in a moment.");
            } else {
                setError("Login failed. Please try again.");
            }
        }
    };

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <div>
                <input type="text" placeholder='UP Mail' value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
                <input
                    type={showPassword ? "text" : "password"}
                    className={styles.passwordInput}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    spellCheck={false}
                />
            </div>
            <label className={styles.showPasswordRow}>
                <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                />
                Show password
            </label>
            <button type="submit" className={styles.submitButton}>LOGIN</button>
            {error && <p className={styles.errorMessage}>{error}</p>}
        </form>
    );
}

export default LoginForm
