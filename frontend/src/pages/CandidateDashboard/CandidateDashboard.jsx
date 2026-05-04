import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LogoutButton from "../../components/LogoutButton.jsx"
import Card from "../../components/Card/Card";
import PasswordChangeGate from "../../components/PasswordChangeGate/PasswordChangeGate.jsx";
import api from "../../api"
import thumbsUp from "../../assets/thumbs-up.png";
import styles from './CandidateDashboard.module.css'
import { useVoterDashboardBallotState } from "../../hooks/useVoterDashboardBallotState.js";

function CandidateDashboard() {
    const navigate = useNavigate();
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
        <div className={styles.candidateDashboard}>
            <LogoutButton />
            <Card
                className={styles.candidateDashboardCard}
                title="UniVote"
                description="University-wide Student Council Election Management System"
            >
                {meLoading ? (
                    <p className={styles.candidateLoading}>Loading your account…</p>
                ) : mustChangePassword ? (
                    <PasswordChangeGate onSuccess={refreshMe} />
                ) : (
                    <>
                        <div>
                            <button
                                type="button"
                                className={styles.manageProfileButton}
                                onClick={() => navigate("/candidate-profile")}
                            >
                                <img src={thumbsUp} alt="" />
                                Manage Profile
                            </button>
                        </div>
                        {ballotSessionLoading ? (
                            <p className={styles.candidateLoading}>
                                Loading election status…
                            </p>
                        ) : (
                            <div className={styles.ballotActions}>
                                <button
                                    type="button"
                                    className={`${styles.voteButton} ${primaryAction.disabled ? styles.voteStatusMuted : ""}`}
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
                    </>
                )}
            </Card>
        </div>
    );
}

export default CandidateDashboard
