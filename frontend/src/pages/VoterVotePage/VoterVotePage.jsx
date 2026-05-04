import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import DashboardLayout from "../../components/DashboardLayout/DashboardLayout.jsx"
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.jsx"
import api from "../../api"
import { buildVoteDeviceFingerprint, getOrCreateBallotInstallId } from "../../utils/voteClientMetrics.js"
import upSeal from "../../assets/UP-Seal.png"
import styles from "./VoterVotePage.module.css"

const POSITIONS = ["Chairperson", "Vice Chairperson", "Councilor"]
const MAX_COUNCILORS = 7

/** Draft ballot (reload-safe). Cleared when the browser tab closes. Not a cast vote. */
const BALLOT_DRAFT_KEY = "univote_ballot_draft_v1"

function initialSelectionForPosition(position) {
    return position === "Councilor" ? [] : null
}

function defaultSelectionByPosition() {
    return Object.fromEntries(
        POSITIONS.map((p) => [p, initialSelectionForPosition(p)])
    )
}

function defaultAbstainByPosition() {
    return Object.fromEntries(POSITIONS.map((p) => [p, false]))
}

function voterIdSetForPosition(candidates, position) {
    return new Set(
        candidates.filter((c) => c.position === position).map((c) => c.voter_id)
    )
}

/**
 * @returns {{ selectionByPosition: Record<string, unknown>, abstainByPosition: Record<string, boolean> } | null}
 */
function sanitizeDraft(parsed, candidates) {
    if (!parsed || typeof parsed !== "object") return null

    const selectionByPosition = {}
    const abstainByPosition = {}

    for (const p of POSITIONS) {
        const abstain = Boolean(parsed.abstainByPosition?.[p])
        abstainByPosition[p] = abstain

        if (abstain) {
            selectionByPosition[p] = initialSelectionForPosition(p)
            continue
        }

        if (p === "Councilor") {
            const valid = voterIdSetForPosition(candidates, "Councilor")
            const raw = parsed.selectionByPosition?.[p]
            const ids = Array.isArray(raw)
                ? [
                      ...new Set(
                          raw
                              .map((id) =>
                                  typeof id === "number" ? id : Number(id)
                              )
                              .filter((id) => Number.isFinite(id) && valid.has(id))
                      ),
                  ]
                : []
            selectionByPosition[p] = ids.slice(0, MAX_COUNCILORS)
        } else {
            const valid = voterIdSetForPosition(candidates, p)
            const vid = parsed.selectionByPosition?.[p]
            const n = typeof vid === "number" ? vid : Number(vid)
            selectionByPosition[p] =
                Number.isFinite(n) && valid.has(n) ? n : null
        }
    }

    return { selectionByPosition, abstainByPosition }
}

function readBallotDraft(electionId, candidates) {
    if (typeof window === "undefined" || !electionId) return null
    try {
        const raw = sessionStorage.getItem(BALLOT_DRAFT_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (parsed?.electionId !== electionId) return null
        return sanitizeDraft(parsed, candidates)
    } catch {
        return null
    }
}

function writeBallotDraft(electionId, selectionByPosition, abstainByPosition) {
    if (typeof window === "undefined" || !electionId) return
    try {
        sessionStorage.setItem(
            BALLOT_DRAFT_KEY,
            JSON.stringify({
                electionId,
                selectionByPosition,
                abstainByPosition,
            })
        )
    } catch {
        /* quota / private mode */
    }
}

function clearBallotDraft() {
    if (typeof window === "undefined") return
    try {
        sessionStorage.removeItem(BALLOT_DRAFT_KEY)
    } catch {
        /* ignore */
    }
}

function positionSidebarLabel(position) {
    if (position === "Councilor") return "Councilors"
    return position
}

function abstainLabel(position) {
    return `ABSTAIN FROM ${position.toUpperCase()}`
}

function abstainButtonText(position, isAbstaining) {
    if (isAbstaining) return "Remove Abstention"
    return abstainLabel(position)
}

function instructionForPosition(position, isAbstaining) {
    if (isAbstaining) {
        return "(ABSTAINED - Not voting for this position)"
    }
    if (position === "Councilor") {
        return `(Choose at most ${MAX_COUNCILORS} candidates)`
    }
    return "(Choose only 1)"
}

/** Chair / Vice / Councilor each need either abstain or a valid vote before submit. */
function isPositionComplete(
    position,
    abstainByPosition,
    selectionByPosition,
    candidates
) {
    const hasCandidates = candidates.some((c) => c.position === position)
    if (!hasCandidates) {
        return Boolean(abstainByPosition[position])
    }
    if (abstainByPosition[position]) return true
    if (position === "Councilor") {
        const list = selectionByPosition[position]
        return (
            Array.isArray(list) &&
            list.length >= 1 &&
            list.length <= MAX_COUNCILORS
        )
    }
    const sel = selectionByPosition[position]
    return sel != null && typeof sel === "number"
}

function buildCastPayload(electionId, selectionByPosition, abstainByPosition) {
    return {
        election_id: electionId,
        chairperson: abstainByPosition.Chairperson
            ? { abstain: true }
            : {
                  abstain: false,
                  candidate_voter_id: selectionByPosition.Chairperson,
              },
        vice_chairperson: abstainByPosition["Vice Chairperson"]
            ? { abstain: true }
            : {
                  abstain: false,
                  candidate_voter_id:
                      selectionByPosition["Vice Chairperson"],
              },
        councilors: abstainByPosition.Councilor
            ? { abstain: true }
            : {
                  abstain: false,
                  candidate_voter_ids: selectionByPosition.Councilor,
              },
    }
}

function formatCastError(data) {
    if (!data || typeof data !== "object") return "Could not submit ballot."
    if (typeof data.detail === "string") return data.detail
    const parts = []
    for (const [k, v] of Object.entries(data)) {
        if (k === "detail") continue
        const msg = Array.isArray(v) ? v[0] : v
        if (typeof msg === "string") parts.push(msg)
    }
    return parts.length ? parts.join(" ") : "Could not submit ballot."
}

export default function VoterVotePage() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState("")
    const [voterPublicId, setVoterPublicId] = useState("")
    const [election, setElection] = useState(null)
    const [candidates, setCandidates] = useState([])
    const [activePosition, setActivePosition] = useState(POSITIONS[0])
    const [selectionByPosition, setSelectionByPosition] = useState(
        defaultSelectionByPosition
    )
    const [abstainByPosition, setAbstainByPosition] = useState(
        defaultAbstainByPosition
    )
    const [expandedVoterIds, setExpandedVoterIds] = useState(() => new Set())
    const [hasCastBallot, setHasCastBallot] = useState(false)
    const [isEnrolled, setIsEnrolled] = useState(false)
    const [submitModalOpen, setSubmitModalOpen] = useState(false)
    const [submitLoading, setSubmitLoading] = useState(false)
    const [submitError, setSubmitError] = useState("")
    const ballotMetricsStartRef = useRef(null)
    const [dashboardHome, setDashboardHome] = useState("/voter-dashboard")

    useEffect(() => {
        let cancelled = false
        api
            .get("/api/me/")
            .then((res) => {
                if (cancelled) return
                setDashboardHome(
                    res.data.role === "candidate"
                        ? "/candidate-dashboard"
                        : "/voter-dashboard"
                )
            })
            .catch(() => {
                if (!cancelled) setDashboardHome("/voter-dashboard")
            })
        return () => {
            cancelled = true
        }
    }, [])

    const loadBallot = useCallback(async () => {
        setLoading(true)
        setFetchError("")
        try {
            const res = await api.get("/api/voters/ballot-session/")
            setVoterPublicId(res.data.voter_public_id || "")
            const electionData = res.data.election ?? null
            const candidatesList = Array.isArray(res.data.candidates)
                ? res.data.candidates
                : []
            const cast = Boolean(res.data.has_cast_ballot)
            setHasCastBallot(cast)
            setIsEnrolled(Boolean(res.data.is_enrolled))
            setElection(electionData)
            setCandidates(candidatesList)

            if (cast) {
                clearBallotDraft()
                setSelectionByPosition(defaultSelectionByPosition())
                setAbstainByPosition(defaultAbstainByPosition())
            } else if (electionData?.id) {
                const restored = readBallotDraft(electionData.id, candidatesList)
                if (restored) {
                    setSelectionByPosition(restored.selectionByPosition)
                    setAbstainByPosition(restored.abstainByPosition)
                } else {
                    setSelectionByPosition(defaultSelectionByPosition())
                    setAbstainByPosition(defaultAbstainByPosition())
                }
            } else {
                setSelectionByPosition(defaultSelectionByPosition())
                setAbstainByPosition(defaultAbstainByPosition())
            }
        } catch (err) {
            const detail = err.response?.data?.detail
            setFetchError(
                typeof detail === "string"
                    ? detail
                    : "Could not load the ballot. Please try again."
            )
            setVoterPublicId("")
            setElection(null)
            setCandidates([])
            setHasCastBallot(false)
            setIsEnrolled(false)
            setSelectionByPosition(defaultSelectionByPosition())
            setAbstainByPosition(defaultAbstainByPosition())
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
        loadBallot()
    }, [loadBallot])

    const notOnRoster =
        Boolean(election?.id) && !isEnrolled && !hasCastBallot

    useEffect(() => {
        ballotMetricsStartRef.current = null
    }, [election?.id])

    useEffect(() => {
        if (
            loading ||
            !election?.id ||
            hasCastBallot ||
            notOnRoster ||
            ballotMetricsStartRef.current !== null ||
            typeof performance === "undefined"
        ) {
            return
        }
        ballotMetricsStartRef.current = performance.now()
    }, [loading, election?.id, hasCastBallot, notOnRoster])

    useEffect(() => {
        if (loading || !election?.id || !hasCastBallot) return
        navigate("/voter-receipt", { replace: true })
    }, [loading, election?.id, hasCastBallot, navigate])

    useEffect(() => {
        if (!election?.id || loading || hasCastBallot || notOnRoster) return
        writeBallotDraft(election.id, selectionByPosition, abstainByPosition)
    }, [election?.id, loading, hasCastBallot, notOnRoster, selectionByPosition, abstainByPosition])

    const ballotComplete = useMemo(
        () =>
            Boolean(election?.id) &&
            POSITIONS.every((p) =>
                isPositionComplete(
                    p,
                    abstainByPosition,
                    selectionByPosition,
                    candidates
                )
            ),
        [election?.id, abstainByPosition, selectionByPosition, candidates]
    )

    const votingLocked = hasCastBallot || submitLoading || notOnRoster

    const forActivePosition = useMemo(
        () => candidates.filter((c) => c.position === activePosition),
        [candidates, activePosition]
    )

    const councilorSelection = selectionByPosition.Councilor

    const toggleExpanded = (voterId) => {
        setExpandedVoterIds((prev) => {
            const next = new Set(prev)
            if (next.has(voterId)) next.delete(voterId)
            else next.add(voterId)
            return next
        })
    }

    const handleSelectSingle = (voterId) => {
        if (votingLocked) return
        setAbstainByPosition((prev) => ({ ...prev, [activePosition]: false }))
        setSelectionByPosition((prev) => ({ ...prev, [activePosition]: voterId }))
    }

    const toggleCouncilor = (voterId) => {
        if (votingLocked) return
        setAbstainByPosition((prev) => ({ ...prev, Councilor: false }))
        setSelectionByPosition((prev) => {
            const cur = prev.Councilor
            const list = Array.isArray(cur) ? cur : []
            const idx = list.indexOf(voterId)
            if (idx >= 0) {
                return { ...prev, Councilor: list.filter((id) => id !== voterId) }
            }
            if (list.length >= MAX_COUNCILORS) {
                return prev
            }
            return { ...prev, Councilor: [...list, voterId] }
        })
    }

    const handleAbstain = () => {
        if (votingLocked) return
        const nextAbstain = !abstainByPosition[activePosition]
        setAbstainByPosition((prev) => ({
            ...prev,
            [activePosition]: nextAbstain,
        }))
        if (nextAbstain) {
            setSelectionByPosition((prev) => ({
                ...prev,
                [activePosition]: initialSelectionForPosition(activePosition),
            }))
        }
    }

    const handleSubmitClick = () => {
        if (
            !election?.id ||
            !ballotComplete ||
            hasCastBallot ||
            submitLoading ||
            notOnRoster
        )
            return
        setSubmitError("")
        setSubmitModalOpen(true)
    }

    const handleConfirmSubmit = async () => {
        if (!election?.id || submitLoading || !isEnrolled) return
        setSubmitLoading(true)
        setSubmitError("")
        try {
            const payload = buildCastPayload(
                election.id,
                selectionByPosition,
                abstainByPosition
            )
            if (
                typeof performance !== "undefined" &&
                ballotMetricsStartRef.current != null
            ) {
                payload.client_latency_ms = Math.round(
                    performance.now() - ballotMetricsStartRef.current
                )
            }
            const fp = buildVoteDeviceFingerprint()
            if (fp) {
                payload.device_fingerprint = fp
            }
            const installId = getOrCreateBallotInstallId()
            if (installId) {
                payload.client_install_id = installId
            }
            await api.post("/api/voters/cast-ballot/", payload)
            clearBallotDraft()
            setSubmitModalOpen(false)
            navigate("/voter-receipt", { replace: true })
        } catch (err) {
            setSubmitError(formatCastError(err.response?.data))
        } finally {
            setSubmitLoading(false)
        }
    }

    const sidebar = notOnRoster ? (
        <>
            <button type="button" onClick={() => navigate(dashboardHome)}>
                BACK TO DASHBOARD
            </button>
            <div className={styles.voterIdBlock}>
                <p className={styles.voterIdLabel}>Voter ID</p>
                <p className={styles.voterIdValue}>
                    {loading ? "Loading…" : voterPublicId || "—"}
                </p>
            </div>
        </>
    ) : (
        <>
            <button type="button" onClick={() => navigate(dashboardHome)}>
                BACK TO DASHBOARD
            </button>
            <div className={styles.voterIdBlock}>
                <p className={styles.voterIdLabel}>Voter ID</p>
                <p className={styles.voterIdValue}>
                    {loading ? "Loading…" : voterPublicId || "—"}
                </p>
            </div>
            {POSITIONS.map((pos) => (
                <button
                    key={pos}
                    type="button"
                    className={activePosition === pos ? "active" : ""}
                    disabled={votingLocked}
                    onClick={() => setActivePosition(pos)}
                >
                    {positionSidebarLabel(pos)}
                </button>
            ))}
            <button
                type="button"
                className={
                    abstainByPosition[activePosition] ? "abstainActive" : ""
                }
                disabled={votingLocked}
                onClick={handleAbstain}
            >
                {abstainButtonText(
                    activePosition,
                    abstainByPosition[activePosition]
                )}
            </button>
            <div className={styles.sidebarSubmit}>
                <button
                    type="button"
                    className="submitVote"
                    disabled={
                        !election ||
                        !ballotComplete ||
                        hasCastBallot ||
                        submitLoading ||
                        notOnRoster
                    }
                    onClick={handleSubmitClick}
                >
                    SUBMIT
                </button>
            </div>
        </>
    )

    return (
        <>
        <DashboardLayout sidebar={sidebar}>
            <div className={styles.mainInner}>
                <header className={styles.headerBlock}>
                    <h1 className={styles.electionTitle}>
                        {election?.name ?? "Student Council Elections"}
                    </h1>
                    <h2 className={styles.positionLine}>{activePosition}</h2>
                    <p className={styles.instruction}>
                        {instructionForPosition(
                            activePosition,
                            abstainByPosition[activePosition]
                        )}
                    </p>
                    {activePosition === "Councilor" &&
                    election &&
                    !abstainByPosition.Councilor ? (
                        <p className={styles.councilorPickHint}>
                            Selected: {councilorSelection.length} / {MAX_COUNCILORS}
                        </p>
                    ) : null}
                </header>

                {fetchError && (
                    <p className={styles.errorText} role="alert">
                        {fetchError}
                    </p>
                )}

                {loading ? (
                    <p className={styles.loading}>Loading ballot…</p>
                ) : !election ? (
                    <p className={styles.noElectionBanner}>
                        Voting is not open right now. Either no election has been
                        published yet, voting has not started, or the voting period
                        has ended.
                    </p>
                ) : notOnRoster ? (
                    <p className={styles.noElectionBanner} role="status">
                        You are not enrolled for this election. Please contact your
                        election administrator to be added to the voter roster before
                        you can vote.
                    </p>
                ) : (
                    <>
                        {hasCastBallot ? (
                            <p className={styles.recordedBanner} role="status">
                                Your ballot has been recorded. Thank you for voting.
                            </p>
                        ) : null}
                        <h3 className={styles.sectionTitle}>List of Candidates</h3>
                        <div className={styles.candidateList}>
                            {forActivePosition.length === 0 ? (
                                <p className={styles.loading}>
                                    No candidates are listed for this position.
                                </p>
                            ) : (
                                forActivePosition.map((c) => {
                                    const expanded = expandedVoterIds.has(c.voter_id)
                                    const description =
                                        (c.description || "").trim() || "—"

                                    const isCouncilorSlot = activePosition === "Councilor"
                                    const abstain = abstainByPosition[activePosition]

                                    let selected = false
                                    let choiceDisabled = false
                                    if (isCouncilorSlot) {
                                        const list = Array.isArray(councilorSelection)
                                            ? councilorSelection
                                            : []
                                        selected =
                                            list.includes(c.voter_id) && !abstain
                                        choiceDisabled =
                                            votingLocked ||
                                            abstain ||
                                            (!selected &&
                                                list.length >= MAX_COUNCILORS)
                                    } else {
                                        selected =
                                            selectionByPosition[activePosition] ===
                                                c.voter_id && !abstain
                                        choiceDisabled =
                                            votingLocked || abstain
                                    }

                                    return (
                                        <article key={c.voter_id} className={styles.card}>
                                            <img
                                                className={`${styles.cardSeal} ${c.profile_photo_url ? styles.cardSealPhoto : ""}`}
                                                src={
                                                    c.profile_photo_url ||
                                                    upSeal
                                                }
                                                alt=""
                                            />
                                            <div className={styles.cardBody}>
                                                <h4 className={styles.cardName}>
                                                    {c.full_name ||
                                                        `${c.first_name || ""} ${c.last_name || ""}`.trim()}
                                                </h4>
                                                <p className={styles.meta}>
                                                    <strong>Alias:</strong>{" "}
                                                    {c.alias || "—"}
                                                    <br />
                                                    <strong>Party:</strong>{" "}
                                                    {c.party || "—"}
                                                    <br />
                                                    <strong>Running for:</strong>{" "}
                                                    {c.position || "—"}
                                                </p>
                                                <p
                                                    className={`${styles.description} ${expanded ? styles.descriptionExpanded : styles.descriptionCollapsed}`}
                                                >
                                                    {description}
                                                </p>
                                            </div>
                                            <div className={styles.cardActions}>
                                                <button
                                                    type="button"
                                                    className={styles.viewBtn}
                                                    onClick={() =>
                                                        toggleExpanded(c.voter_id)
                                                    }
                                                >
                                                    {expanded ? "Hide" : "View"}
                                                </button>
                                                <label
                                                    className={`${styles.choiceLabel} ${abstain || votingLocked ? styles.choiceLocked : ""}`}
                                                >
                                                    {isCouncilorSlot ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={selected}
                                                            disabled={choiceDisabled}
                                                            onChange={() =>
                                                                toggleCouncilor(
                                                                    c.voter_id
                                                                )
                                                            }
                                                        />
                                                    ) : (
                                                        <input
                                                            type="radio"
                                                            name={`vote-${activePosition}`}
                                                            checked={selected}
                                                            disabled={choiceDisabled}
                                                            onChange={() =>
                                                                handleSelectSingle(
                                                                    c.voter_id
                                                                )
                                                            }
                                                        />
                                                    )}
                                                    Vote
                                                </label>
                                            </div>
                                        </article>
                                    )
                                })
                            )}
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
        <ConfirmModal
            open={submitModalOpen}
            message="Have you finished voting? Tap Yes to submit."
            error={submitError || undefined}
            onConfirm={handleConfirmSubmit}
            onCancel={() => {
                setSubmitError("")
                setSubmitModalOpen(false)
            }}
            confirmLabel={submitLoading ? "…" : "YES"}
            loading={submitLoading}
        />
    </>
    )
}
