import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import LogoutButton from "../../components/LogoutButton.jsx"
import Card from "../../components/Card/Card.jsx"
import PasswordChangeGate from "../../components/PasswordChangeGate/PasswordChangeGate.jsx"
import api from "../../api"
import thumbsUp from "../../assets/thumbs-up.png"
import styles from './VoterDashboard.module.css'
import { useVoterDashboardBallotState } from "../../hooks/useVoterDashboardBallotState.js"

function VoterDashboard() {
    const navigate = useNavigate()
    const [meLoading, setMeLoading] = useState(true)
    const [mustChangePassword, setMustChangePassword] = useState(false)

    const refreshMe = useCallback(async () => {
        setMeLoading(true)
        try {
            const res = await api.get("/api/me/")
            setMustChangePassword(Boolean(res.data.must_change_password))
        } catch {
            setMustChangePassword(false)
        } finally {
            setMeLoading(false)
        }
    }, [])

    useEffect(() => {
        document.body.classList.add("dashboard-bg");
        document.body.classList.remove("login-bg");
        return () => document.body.classList.remove("dashboard-bg");
    }, []);

    useEffect(() => {
        refreshMe()
    }, [refreshMe])

    const { primaryAction, ballotSessionLoading } = useVoterDashboardBallotState(
        meLoading,
        mustChangePassword
    )

    return (
        <div className={styles.voterDashboard}>
            <LogoutButton />
            <Card
                className={styles.voterDashboardCard}
                title="UniVote"
                description="University-wide Student Council Election Management System"
            >
                {meLoading ? (
                    <p className={styles.voterLoading}>Loading your account…</p>
                ) : mustChangePassword ? (
                    <PasswordChangeGate onSuccess={refreshMe} />
                ) : ballotSessionLoading ? (
                    <p className={styles.voterLoading}>Loading election status…</p>
                ) : (
                    <div className={styles.voterActions}>
                        <button
                            className={`${styles.voterVoteButton} ${primaryAction.disabled ? styles.voterStatusButton : ""}`}
                            type="button"
                            disabled={primaryAction.disabled}
                            onClick={() =>
                                primaryAction.path &&
                                navigate(primaryAction.path)
                            }
                        >
                            <img src={thumbsUp} alt="" />
                            {primaryAction.label}
                        </button>
                    </div>
                )}
            </Card>
        </div>
    );
}

export default VoterDashboard
