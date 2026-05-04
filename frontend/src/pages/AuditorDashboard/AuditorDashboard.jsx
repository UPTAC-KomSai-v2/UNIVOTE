import React, { useEffect, useMemo, useState } from "react"
import DashboardLayout from "../../components/DashboardLayout/DashboardLayout.jsx"
import api from "../../api"
import AuditorElectionResults from "./AuditorElectionResults.jsx"
import AuditorBarChart from "./AuditorBarChart.jsx"
import AuditorLineChart from "./AuditorLineChart.jsx"
import AuditorApathyChart from "./AuditorApathyChart.jsx"
import AuditorReportArchiveTables from "./AuditorReportArchiveTables.jsx"
import styles from "./AuditorDashboard.module.css"
import "./auditor-scrollbar.css"
import { electionWithLivePublishedState } from "../../utils/electionLiveState"
import {
    AUDITOR_DASHBOARD_ACTIVE_VIEW_KEY as ACTIVE_VIEW_KEY,
    AUDITOR_DASHBOARD_ELECTION_ID_KEY as ELECTION_ID_KEY,
} from "../../utils/dashboardPreferences"

const VIEWS = [
    {
        id: "results",
        label: "GENERAL RESULTS",
        title: "Election Results",
        description:
            "Showing the consolidated tally for the selected election — winners, total votes, and per-position breakdowns will appear here.",
    },
    {
        id: "barchart",
        label: "PROGRAM PARTICIPATION",
        title: "Bar Chart",
        description:
            "Turnout by degree program: each bar shows what share of that program’s eligible voters cast a ballot. Gold bars read against the 0–100% scale.",
    },
    {
        id: "linegraph",
        label: "DAILY YEAR LEVEL VOTES",
        title: "Line Graph",
        description:
            "Ballots submitted per calendar day during the election period, with five colored lines for 1st–4th Year students and 5 and Up students so you can compare cohort activity over time.",
    },
    {
        id: "apathy",
        label: "APATHY INDEX",
        title: "Apathy Index",
        description:
            "Participation versus abstention on each race: among eligible voters, how many chose a candidate for Chairperson, Vice Chairperson, and Councilor rather than abstaining.",
    },
]

const VALID_VIEW_IDS = VIEWS.map((v) => v.id)

function formatElectionRange(isoStart, isoEnd) {
    try {
        const s = new Date(isoStart)
        const e = new Date(isoEnd)
        const opts = { month: "short", day: "numeric", year: "numeric" }
        return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`
    } catch {
        return ""
    }
}

function electionStatusBadge(e) {
    if (!e) return { label: "", variant: "unknown" }
    if (e.status === "draft")
        return { label: "Draft — not published", variant: "draft" }
    if (e.status === "archived") return { label: "Archived", variant: "archived" }
    if (e.state === "scheduled")
        return { label: "Published · voting not started yet", variant: "scheduled" }
    if (e.state === "ongoing")
        return { label: "Published · voting in progress", variant: "ongoing" }
    if (e.state === "ended")
        return { label: "Published · voting period ended", variant: "ended" }
    return { label: String(e.status ?? "Unknown"), variant: "unknown" }
}

function pickDefaultElectionId(list, preferredId) {
    if (!list.length) return null
    const idNum = preferredId != null ? Number(preferredId) : NaN
    if (Number.isFinite(idNum) && list.some((x) => x.id === idNum)) {
        return idNum
    }
    const published = list.filter((x) => x.status === "published")
    if (published.length) {
        const open = published.find((x) => x.is_voting_open)
        if (open) return open.id
        return published[0].id
    }
    return list[0].id
}

function groupElectionRows(list) {
    const published = list.filter((e) => e.status === "published")
    const archived = list.filter((e) => e.status === "archived")
    const drafts = list.filter((e) => e.status === "draft")
    return { published, archived, drafts }
}

function formatTimezoneHint() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || ""
    } catch {
        return ""
    }
}

function AuditorDashboard() {
    const [elections, setElections] = useState([])
    const [electionsLoading, setElectionsLoading] = useState(true)
    const [electionsError, setElectionsError] = useState("")
    const [selectedElectionId, setSelectedElectionId] = useState(null)
    const [electionFilter, setElectionFilter] = useState("")

    const [activeView, setActiveView] = useState(() => {
        if (typeof window === "undefined") return "results"
        const stored = window.localStorage.getItem(ACTIVE_VIEW_KEY)
        return VALID_VIEW_IDS.includes(stored) ? stored : "results"
    })

    useEffect(() => {
        document.body.classList.add("dashboard-bg")
        document.body.classList.remove("login-bg")
        return () => document.body.classList.remove("dashboard-bg")
    }, [])

    useEffect(() => {
        window.localStorage.setItem(ACTIVE_VIEW_KEY, activeView)
    }, [activeView])

    const [headerClock, setHeaderClock] = useState(() => new Date())

    useEffect(() => {
        setHeaderClock(new Date())
        const id = window.setInterval(() => setHeaderClock(new Date()), 1000)
        return () => window.clearInterval(id)
    }, [])

    const localTzHint = useMemo(() => formatTimezoneHint(), [])

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setElectionsLoading(true)
            setElectionsError("")
            try {
                const res = await api.get("/api/elections/")
                const raw = Array.isArray(res.data) ? res.data : []
                if (cancelled) return
                setElections(raw)
                const stored = window.localStorage.getItem(ELECTION_ID_KEY)
                const preferred = stored ? Number(stored) : NaN
                const defaultId = pickDefaultElectionId(
                    raw,
                    Number.isFinite(preferred) ? preferred : null
                )
                setSelectedElectionId(defaultId)
                if (defaultId != null) {
                    window.localStorage.setItem(ELECTION_ID_KEY, String(defaultId))
                }
            } catch {
                if (!cancelled) {
                    setElectionsError("Could not load elections.")
                    setElections([])
                    setSelectedElectionId(null)
                }
            } finally {
                if (!cancelled) setElectionsLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [])

    const filteredElections = useMemo(() => {
        const q = electionFilter.trim().toLowerCase()
        if (!q) return elections
        return elections.filter(
            (e) =>
                e.name.toLowerCase().includes(q) ||
                String(e.id).includes(q) ||
                (e.state && String(e.state).toLowerCase().includes(q)) ||
                (e.status && String(e.status).toLowerCase().includes(q))
        )
    }, [elections, electionFilter])

    useEffect(() => {
        if (!filteredElections.length) return
        const ok = filteredElections.some((e) => e.id === selectedElectionId)
        if (!ok) {
            const next = filteredElections[0].id
            setSelectedElectionId(next)
            window.localStorage.setItem(ELECTION_ID_KEY, String(next))
        }
    }, [filteredElections, selectedElectionId])

    const selectedElection = useMemo(
        () => elections.find((e) => e.id === selectedElectionId) ?? null,
        [elections, selectedElectionId]
    )

    const selectedElectionLive = useMemo(
        () =>
            electionWithLivePublishedState(
                selectedElection,
                headerClock.getTime()
            ),
        [selectedElection, headerClock]
    )

    const auditorStatusBadge = useMemo(
        () =>
            selectedElectionLive
                ? electionStatusBadge(selectedElectionLive)
                : null,
        [selectedElectionLive]
    )

    const groupedFiltered = useMemo(
        () => groupElectionRows(filteredElections),
        [filteredElections]
    )

    const currentView = VIEWS.find((v) => v.id === activeView) ?? VIEWS[0]

    const handleElectionChange = (e) => {
        const id = Number(e.target.value)
        if (!Number.isFinite(id)) return
        setSelectedElectionId(id)
        window.localStorage.setItem(ELECTION_ID_KEY, String(id))
    }

    const reportTimestamp = useMemo(() => {
        const d = new Date()
        return {
            iso: d.toISOString(),
            display: d.toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
            }),
        }
    }, [])

    const sidebar = (
        <>
            <div className={styles.electionPicker}>
                <div className={styles.electionPickerBlock}>
                    <label
                        className={styles.sidebarLabel}
                        htmlFor="auditor-election-filter"
                    >
                        Find election
                    </label>
                    <input
                        id="auditor-election-filter"
                        type="search"
                        className={styles.electionSearch}
                        placeholder="Search name, ID, status..."
                        value={electionFilter}
                        onChange={(ev) => setElectionFilter(ev.target.value)}
                        disabled={electionsLoading || !elections.length}
                        autoComplete="off"
                        spellCheck={false}
                    />
                </div>
                <div className={styles.electionPickerBlock}>
                    <label
                        className={styles.sidebarLabel}
                        htmlFor="auditor-election-select"
                    >
                        Election
                    </label>
                    {electionsLoading ? (
                        <p className={styles.sidebarHint}>Loading elections…</p>
                    ) : electionsError ? (
                        <p className={styles.sidebarError} role="alert">
                            {electionsError}
                        </p>
                    ) : !elections.length ? (
                        <p className={styles.sidebarHint}>No elections yet.</p>
                    ) : !filteredElections.length ? (
                        <p className={styles.sidebarHint}>
                            No matches — clear search.
                        </p>
                    ) : (
                        <select
                            id="auditor-election-select"
                            className={styles.electionSelect}
                            value={selectedElectionId ?? ""}
                            onChange={handleElectionChange}
                        >
                        {groupedFiltered.published.length ? (
                            <optgroup label="Published">
                                {groupedFiltered.published.map((el) => (
                                    <option key={el.id} value={el.id}>
                                        {el.name} (#{el.id}) ·{" "}
                                        {formatElectionRange(el.start_datetime, el.end_datetime)}
                                    </option>
                                ))}
                            </optgroup>
                        ) : null}
                        {groupedFiltered.archived.length ? (
                            <optgroup label="Archived">
                                {groupedFiltered.archived.map((el) => (
                                    <option key={el.id} value={el.id}>
                                        {el.name} (#{el.id}) ·{" "}
                                        {formatElectionRange(el.start_datetime, el.end_datetime)}
                                    </option>
                                ))}
                            </optgroup>
                        ) : null}
                        {groupedFiltered.drafts.length ? (
                            <optgroup label="Draft">
                                {groupedFiltered.drafts.map((el) => (
                                    <option key={el.id} value={el.id}>
                                        {el.name} (#{el.id}) ·{" "}
                                        {formatElectionRange(el.start_datetime, el.end_datetime)}
                                    </option>
                                ))}
                            </optgroup>
                        ) : null}
                        </select>
                    )}
                </div>
                {!electionsLoading && elections.length > 0 ? (
                    <p className={styles.sidebarMeta}>
                        {filteredElections.length === elections.length
                            ? `${elections.length} total`
                            : `${filteredElections.length} of ${elections.length}`}
                    </p>
                ) : null}
            </div>
        </>
    )

    return (
        <DashboardLayout sidebar={sidebar}>
            <div className={`${styles.printRoot} printable`}>
                <div className={styles.header}>
                <h1>
                    {selectedElection?.name ?? "Auditor reports"}
                </h1>
                <h2>{currentView.title}</h2>
                <p
                    className={`${styles.headerRunningClock} ${styles.noPrint}`}
                    aria-live="polite"
                >
                    <time dateTime={headerClock.toISOString()}>
                        {headerClock.toLocaleString(undefined, {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            second: "2-digit",
                        })}
                    </time>
                    {localTzHint ? (
                        <span className={styles.headerRunningClockTz}>
                            {" "}
                            · {localTzHint}
                        </span>
                    ) : null}
                </p>
                {selectedElection ? (
                    <>
                        <p className={styles.headerMeta}>
                            {formatElectionRange(
                                selectedElection.start_datetime,
                                selectedElection.end_datetime
                            )}
                        </p>
                        <div className={styles.headerStatusRow}>
                            <span
                                className={`${styles.statusPill} ${styles[`status_${auditorStatusBadge.variant}`]}`}
                                role="status"
                            >
                                {auditorStatusBadge.label}
                            </span>
                        </div>
                    </>
                ) : null}
                <p className={styles.headerAsOf}>
                    <span className={styles.asOfPill}>
                        <span className={styles.asOfLead}>As of</span>
                        <time dateTime={reportTimestamp.iso}>
                            {reportTimestamp.display}
                        </time>
                    </span>
                </p>
                </div>

                <div className={`${styles.buttons} ${styles.noPrint}`}>
                {VIEWS.map((view) => (
                    <button
                        key={view.id}
                        type="button"
                        className={
                            activeView === view.id ? styles.activeView : ""
                        }
                        onClick={() => setActiveView(view.id)}
                    >
                        {view.label}
                    </button>
                ))}
                </div>

                <div className={styles.descriptionRow}>
                <p className={styles.reportDescription}>
                    {currentView.description}
                </p>
                <button
                    type="button"
                    className={`${styles.printButton} ${styles.noPrint}`}
                    onClick={() => window.print()}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    PRINT REPORT
                </button>
                </div>

                <div className={`${styles.contentBox} auditor-scrollbar`}>
                {!selectedElection ? (
                    <p className={styles.viewPlaceholder}>
                        Select an election from the left when data is available.
                    </p>
                ) : (
                    <>
                        {activeView === "results" ? (
                            <AuditorElectionResults
                                electionId={selectedElection.id}
                            />
                        ) : activeView === "barchart" ? (
                            <AuditorBarChart electionId={selectedElection.id} />
                        ) : activeView === "linegraph" ? (
                            <AuditorLineChart electionId={selectedElection.id} />
                        ) : activeView === "apathy" ? (
                            <AuditorApathyChart electionId={selectedElection.id} />
                        ) : (
                            <p className={styles.viewPlaceholder}>
                                (Placeholder — &ldquo;{currentView.label}&rdquo; for{" "}
                                <strong>{selectedElection.name}</strong> will
                                render here.)
                            </p>
                        )}
                        <AuditorReportArchiveTables
                            electionId={selectedElection.id}
                            activeView={activeView}
                            reportSectionTitle={currentView.title}
                            electionName={selectedElection.name}
                            electionRangeLabel={formatElectionRange(
                                selectedElection.start_datetime,
                                selectedElection.end_datetime
                            )}
                            electionStatusLabel={
                                auditorStatusBadge?.label ?? ""
                            }
                            generatedAtDisplay={reportTimestamp.display}
                            generatedAtIso={reportTimestamp.iso}
                        />
                    </>
                )}
                </div>
            </div>
        </DashboardLayout>
    )
}

export default AuditorDashboard
