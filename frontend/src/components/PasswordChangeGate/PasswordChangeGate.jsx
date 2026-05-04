import { useEffect, useRef, useState } from "react"
import api from "../../api"
import styles from "./PasswordChangeGate.module.css"

function extractFieldErrors(data) {
    if (!data || typeof data !== "object") return "Something went wrong. Please try again."
    if (typeof data.detail === "string") return data.detail
    const firstKey = Object.keys(data)[0]
    const val = data[firstKey]
    if (Array.isArray(val)) return val[0] || "Please check your input."
    if (typeof val === "string") return val
    return "Please check your input."
}

/**
 * First-login / CSV-import password change (same rules as POST /api/change-password/).
 * Used on voter and candidate dashboards when must_change_password is true.
 */
export default function PasswordChangeGate({ onSuccess }) {
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [pwError, setPwError] = useState("")
    const [pwSaving, setPwSaving] = useState(false)
    const [showPasswords, setShowPasswords] = useState(false)
    const submitRef = useRef(null)

    useEffect(() => {
        if (!pwError) return
        const id = requestAnimationFrame(() => {
            submitRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
        })
        return () => cancelAnimationFrame(id)
    }, [pwError])

    const handleChangePassword = async (e) => {
        e.preventDefault()
        if (pwSaving) return
        setPwError("")
        setPwSaving(true)
        try {
            await api.post("/api/change-password/", {
                current_password: currentPassword,
                new_password: newPassword,
                new_password_confirm: confirmPassword,
            })
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
            await onSuccess?.()
        } catch (err) {
            const data = err.response?.data
            setPwError(extractFieldErrors(data))
        } finally {
            setPwSaving(false)
        }
    }

    return (
        <div className={styles.passwordGate}>
            <p className={styles.passwordGateTitle}>Set a new password to continue</p>
            <p className={styles.passwordGateHint}>
                Log in with your university email and your <strong>student number</strong> as the
                current password, then choose a new password you have not used before (it cannot be
                your student number).
            </p>
            <form className={styles.passwordForm} onSubmit={handleChangePassword}>
                <label className={styles.passwordLabel}>
                    Current password
                    <input
                        type={showPasswords ? "text" : "password"}
                        className={styles.passwordInput}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        spellCheck={false}
                        disabled={pwSaving}
                    />
                </label>
                <label className={styles.passwordLabel}>
                    New password
                    <input
                        type={showPasswords ? "text" : "password"}
                        className={styles.passwordInput}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        spellCheck={false}
                        disabled={pwSaving}
                    />
                </label>
                <label className={styles.passwordLabel}>
                    Confirm new password
                    <input
                        type={showPasswords ? "text" : "password"}
                        className={styles.passwordInput}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        spellCheck={false}
                        disabled={pwSaving}
                    />
                </label>
                <label className={styles.showPasswordRow}>
                    <input
                        type="checkbox"
                        checked={showPasswords}
                        onChange={(e) => setShowPasswords(e.target.checked)}
                        disabled={pwSaving}
                    />
                    Show passwords
                </label>
                {pwError ? (
                    <p className={styles.passwordError} role="alert">
                        {pwError}
                    </p>
                ) : null}
                <button
                    ref={submitRef}
                    type="submit"
                    className={styles.passwordSubmit}
                    disabled={pwSaving}
                >
                    {pwSaving ? "Saving…" : "Update password"}
                </button>
            </form>
        </div>
    )
}
