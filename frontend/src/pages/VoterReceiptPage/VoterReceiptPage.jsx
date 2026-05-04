import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import DashboardLayout from "../../components/DashboardLayout/DashboardLayout.jsx"
import api from "../../api"
import styles from "./VoterReceiptPage.module.css"

function formatSubmittedAt(iso) {
    if (!iso) return ""
    try {
        const d = new Date(iso)
        return d.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        })
    } catch {
        return String(iso)
    }
}

function LineBlock({ title, children }) {
    return (
        <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{title}</h2>
            {children}
        </section>
    )
}

function CandidateReceiptCard({ c }) {
    if (!c) return null
    return (
        <div className={styles.candidateCard}>
            <p className={styles.candidateName}>{c.full_name}</p>
            <p className={styles.candidateMeta}>
                <strong>Alias:</strong> {c.alias || "—"}
                <br />
                <strong>Party:</strong> {c.party || "—"}
            </p>
        </div>
    )
}

export default function VoterReceiptPage() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [ballot, setBallot] = useState(null)
    const [dashboardHome, setDashboardHome] = useState("/voter-dashboard")

    const loadReceipt = useCallback(async () => {
        setLoading(true)
        setError("")
        try {
            const [meRes, receiptRes] = await Promise.all([
                api.get("/api/me/"),
                api.get("/api/voters/voting-receipt/"),
            ])
            const home =
                meRes.data.role === "candidate"
                    ? "/candidate-dashboard"
                    : "/voter-dashboard"
            setDashboardHome(home)
            setBallot(receiptRes.data.ballot ?? null)
        } catch {
            setError("Could not load your voting receipt.")
            setBallot(null)
            try {
                const meRes = await api.get("/api/me/")
                setDashboardHome(
                    meRes.data.role === "candidate"
                        ? "/candidate-dashboard"
                        : "/voter-dashboard"
                )
            } catch {
                setDashboardHome("/voter-dashboard")
            }
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        document.body.classList.add("dashboard-bg")
        document.body.classList.remove("login-bg")
        return () => document.body.classList.remove("dashboard-bg")
    }, [])

    useEffect(() => {
        loadReceipt()
    }, [loadReceipt])

    useEffect(() => {
        if (loading || error) return
        if (ballot !== null) return
        navigate(dashboardHome, { replace: true })
    }, [loading, error, ballot, navigate, dashboardHome])

    const chairLine = useMemo(
        () => ballot?.lines?.find((l) => l.position === "Chairperson"),
        [ballot]
    )
    const viceLine = useMemo(
        () => ballot?.lines?.find((l) => l.position === "Vice Chairperson"),
        [ballot]
    )
    const councilorLines = useMemo(
        () =>
            (ballot?.lines ?? []).filter((l) => l.position === "Councilor"),
        [ballot]
    )
    const councilorAbstained = useMemo(
        () => councilorLines.some((l) => l.abstain),
        [councilorLines]
    )
    const councilorVotes = useMemo(
        () => councilorLines.filter((l) => !l.abstain && l.candidate),
        [councilorLines]
    )

    const sidebar = (
        <button type="button" onClick={() => navigate(dashboardHome)}>
            BACK TO DASHBOARD
        </button>
    )

    if (loading) {
        return (
            <DashboardLayout sidebar={sidebar}>
                <div className={styles.mainInner}>
                    <p className={styles.loading}>Loading receipt…</p>
                </div>
            </DashboardLayout>
        )
    }

    if (error) {
        return (
            <DashboardLayout sidebar={sidebar}>
                <div className={styles.mainInner}>
                    <p className={styles.errorText} role="alert">
                        {error}
                    </p>
                    <p className={styles.emptyHint}>
                        <button
                            type="button"
                            className={styles.backLink}
                            onClick={() => navigate(dashboardHome)}
                        >
                            Return to dashboard
                        </button>
                    </p>
                </div>
            </DashboardLayout>
        )
    }

    if (!ballot) {
        return (
            <DashboardLayout sidebar={sidebar}>
                <div className={styles.mainInner}>
                    <p className={styles.emptyHint}>Redirecting…</p>
                </div>
            </DashboardLayout>
        )
    }

    const electionName = ballot.election?.name ?? "Election"

    return (
        <DashboardLayout sidebar={sidebar}>
            <div className={styles.mainInner}>
                <header>
                    <h1 className={styles.pageTitle}>Voting Receipt</h1>
                    <p className={styles.subMeta}>
                        <strong>{electionName}</strong>
                        <br />
                        Submitted: {formatSubmittedAt(ballot.submitted_at)}
                    </p>
                </header>

                <LineBlock title="Chairperson">
                    {chairLine?.abstain ? (
                        <p className={styles.abstainRow}>Abstained</p>
                    ) : (
                        <CandidateReceiptCard c={chairLine?.candidate} />
                    )}
                </LineBlock>

                <LineBlock title="Vice Chairperson">
                    {viceLine?.abstain ? (
                        <p className={styles.abstainRow}>Abstained</p>
                    ) : (
                        <CandidateReceiptCard c={viceLine?.candidate} />
                    )}
                </LineBlock>

                <LineBlock title="Councilors">
                    {councilorAbstained ? (
                        <p className={styles.abstainRow}>Abstained</p>
                    ) : (
                        councilorVotes.map((line, idx) => (
                            <CandidateReceiptCard
                                key={
                                    line.candidate?.voter_id != null
                                        ? String(line.candidate.voter_id)
                                        : `c-${idx}`
                                }
                                c={line.candidate}
                            />
                        ))
                    )}
                </LineBlock>
            </div>
        </DashboardLayout>
    )
}
