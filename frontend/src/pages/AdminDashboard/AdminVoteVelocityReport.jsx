import { useEffect, useMemo, useState } from "react"
import {
    CartesianGrid,
    ResponsiveContainer,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import api from "../../api"
import styles from "./AdminVoteVelocityReport.module.css"

function pad2(n) {
    return String(n).padStart(2, "0")
}

function localISODate(d) {
    const y = d.getFullYear()
    const m = pad2(d.getMonth() + 1)
    const day = pad2(d.getDate())
    return `${y}-${m}-${day}`
}

function parseElectionDateBounds(startIso, endIso) {
    const min = localISODate(new Date(startIso))
    const max = localISODate(new Date(endIso))
    return min <= max ? { min, max } : { min: max, max: min }
}

function clampDateStr(iso, min, max) {
    if (iso < min) return min
    if (iso > max) return max
    return iso
}

const PERIODS = [
    { id: "all", label: "All Day" },
    { id: "morning", label: "Morning (12a–12p)" },
    { id: "afternoon", label: "Afternoon (12p–6p)" },
    { id: "evening", label: "Evening (6p–12a)" },
]

const CORROBORATION_LABELS = {
    fingerprint: "Same device fingerprint",
    install_id: "Same browser install ID",
    ip: "Same submit IP",
}

function VelocityTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const p = payload[0]?.payload
    if (!p) return null
    const signals = Array.isArray(p.corroboration_signals)
        ? p.corroboration_signals
        : []
    const headline = p.flagged
        ? "Needs review (corroborated)"
        : p.rapid_gap
          ? "Rapid gap, not flagged"
          : "Normal"
    return (
        <div
            style={{
                background: "#fff",
                border: "1px solid rgba(107,26,50,0.25)",
                borderRadius: 10,
                padding: "10px 12px",
                boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
            }}
        >
            <div style={{ fontWeight: 700, color: "#891437" }}>{headline}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
                Gap: <strong>{p.gap_seconds}s</strong>
            </div>
            <div style={{ fontSize: 13 }}>
                Latency: <strong>{p.latency_ms} ms</strong>
            </div>
            {p.flagged && signals.length > 0 ? (
                <div
                    style={{
                        fontSize: 12,
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: "1px solid rgba(107,26,50,0.12)",
                        lineHeight: 1.45,
                        color: "#334155",
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        Shared with prior ballot:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {signals.map((s) => (
                            <li key={s}>{CORROBORATION_LABELS[s] ?? s}</li>
                        ))}
                    </ul>
                </div>
            ) : null}
            {p.rapid_gap && !p.flagged ? (
                <div style={{ fontSize: 12, marginTop: 8, color: "#475569" }}>
                    Different device signals vs prior ballot—typical when many people
                    vote close together.
                </div>
            ) : null}
        </div>
    )
}

function AdminVoteVelocityReport({
    electionId,
    electionStartDatetime,
    electionEndDatetime,
}) {
    const bounds = useMemo(
        () =>
            parseElectionDateBounds(
                electionStartDatetime,
                electionEndDatetime
            ),
        [electionStartDatetime, electionEndDatetime]
    )

    const [subTab, setSubTab] = useState("velocity")
    const [selectedDate, setSelectedDate] = useState(null)
    const [period, setPeriod] = useState("all")
    const [flaggedOnly, setFlaggedOnly] = useState(false)

    const [velocityPayload, setVelocityPayload] = useState(null)
    const [velocityLoading, setVelocityLoading] = useState(false)
    const [velocityError, setVelocityError] = useState("")

    const [devicePayload, setDevicePayload] = useState(null)
    const [deviceLoading, setDeviceLoading] = useState(false)
    const [deviceError, setDeviceError] = useState("")

    useEffect(() => {
        const today = localISODate(new Date())
        setSelectedDate(clampDateStr(today, bounds.min, bounds.max))
    }, [bounds])

    useEffect(() => {
        if (electionId == null || subTab !== "velocity" || !selectedDate) return
        let cancelled = false
        const load = async () => {
            setVelocityLoading(true)
            setVelocityError("")
            try {
                const res = await api.get(
                    `/api/admin/election-vote-velocity/${electionId}/`,
                    {
                        params: {
                            date: selectedDate,
                            period,
                            flagged_only: flaggedOnly ? "1" : "0",
                        },
                    }
                )
                if (!cancelled) setVelocityPayload(res.data)
            } catch (err) {
                const detail = err.response?.data?.detail
                if (!cancelled) {
                    setVelocityPayload(null)
                    setVelocityError(
                        typeof detail === "string"
                            ? detail
                            : "Could not load vote velocity."
                    )
                }
            } finally {
                if (!cancelled) setVelocityLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [electionId, selectedDate, period, flaggedOnly, subTab])

    useEffect(() => {
        if (electionId == null || subTab !== "fingerprint") return
        let cancelled = false
        const load = async () => {
            setDeviceLoading(true)
            setDeviceError("")
            try {
                const res = await api.get(
                    `/api/admin/election-device-fingerprints/${electionId}/`
                )
                if (!cancelled) setDevicePayload(res.data)
            } catch (err) {
                const detail = err.response?.data?.detail
                if (!cancelled) {
                    setDevicePayload(null)
                    setDeviceError(
                        typeof detail === "string"
                            ? detail
                            : "Could not load device fingerprint report."
                    )
                }
            } finally {
                if (!cancelled) setDeviceLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [electionId, subTab])

    const normalPoints = useMemo(() => {
        const pts = velocityPayload?.points ?? []
        return pts.filter((p) => !p.flagged)
    }, [velocityPayload])

    const flaggedPoints = useMemo(() => {
        const pts = velocityPayload?.points ?? []
        return pts.filter((p) => p.flagged)
    }, [velocityPayload])

    const flaggedCount = velocityPayload?.flagged_count ?? 0
    const uncorroboratedRapid =
        velocityPayload?.uncorroborated_rapid_count ?? 0
    const fpClusters = devicePayload?.suspicious_device_count ?? 0
    const installClusters = devicePayload?.suspicious_install_count ?? 0
    const ipClusters = devicePayload?.suspicious_ip_count ?? 0
    const totalCorroboration =
        devicePayload?.corroborating_signal_rows ??
        fpClusters + installClusters + ipClusters

    const fpRows = devicePayload?.devices ?? []
    const installRows = devicePayload?.install_collisions ?? []
    const ipRows = devicePayload?.ip_collisions ?? []
    const hasFingerprintEvidence =
        fpRows.length > 0 || installRows.length > 0 || ipRows.length > 0

    return (
        <div className={styles.wrap}>
            <div className={styles.subTabs}>
                <button
                    type="button"
                    className={
                        subTab === "velocity"
                            ? `${styles.subTab} ${styles.subTabActive}`
                            : styles.subTab
                    }
                    onClick={() => setSubTab("velocity")}
                >
                    Vote Velocity
                </button>
                <button
                    type="button"
                    className={
                        subTab === "fingerprint"
                            ? `${styles.subTab} ${styles.subTabActive}`
                            : styles.subTab
                    }
                    onClick={() => setSubTab("fingerprint")}
                >
                    Device Fingerprint
                </button>
            </div>

            {subTab === "velocity" ? (
                <>
                    <div className={styles.insightsPanel}>
                        <p className={styles.insightsTitle}>
                            What to do with this report
                        </p>
                        <ul className={styles.insightsList}>
                            <li>
                                <strong>Interpret the dots:</strong> Each point is one
                                ballot versus time since the ballot immediately before it
                                (any voter) and submit latency.{" "}
                                <strong>Red</strong> means the gap is under the threshold{" "}
                                <em>and</em> this ballot shares device fingerprint, browser
                                install ID, or submit IP with that prior ballot—so busy
                                turnout alone does not turn dots red.
                            </li>
                            <li>
                                <strong>If many red dots appear:</strong> Treat as a review
                                queue: use <strong>Flagged only</strong>, scan neighboring
                                dates, and compare with the{" "}
                                <strong>Device Fingerprint</strong> tab.
                            </li>
                            <li>
                                <strong>Rapid but not red?</strong> Fast gaps between
                                unrelated devices or networks stay unflagged—expected
                                during peak voting.
                            </li>
                            <li>
                                <strong>Still not automatic proof:</strong> Shared labs,
                                family devices, or NAT can explain matches. Follow
                                institutional policy before formal action.
                            </li>
                            <li>
                                <strong>No dots on this slice?</strong> Try another date or
                                &quot;All Day&quot;; quiet periods may have no sequential pairs.
                            </li>
                        </ul>
                    </div>

                    <div className={styles.legendRow}>
                        <span className={styles.legendItem}>
                            <span
                                className={`${styles.legendDot} ${styles.legendDotNormal}`}
                                aria-hidden
                            />
                            Normal
                        </span>
                        <span className={styles.legendItem}>
                            <span
                                className={`${styles.legendDot} ${styles.legendDotFlag}`}
                                aria-hidden
                            />
                            Needs review (corroborated)
                        </span>
                    </div>

                    <div className={styles.filters}>
                        <div className={styles.filterGroup}>
                            <label className={styles.filterLabel} htmlFor="vv-date">
                                Date
                            </label>
                            <input
                                id="vv-date"
                                type="date"
                                className={styles.dateInput}
                                min={bounds.min}
                                max={bounds.max}
                                value={selectedDate ?? ""}
                                onChange={(e) =>
                                    setSelectedDate(
                                        clampDateStr(
                                            e.target.value,
                                            bounds.min,
                                            bounds.max
                                        )
                                    )
                                }
                                disabled={velocityLoading}
                            />
                        </div>
                        <div className={styles.filterGroup}>
                            <label className={styles.filterLabel} htmlFor="vv-period">
                                Period
                            </label>
                            <select
                                id="vv-period"
                                className={styles.periodSelect}
                                value={period}
                                onChange={(e) => setPeriod(e.target.value)}
                                disabled={velocityLoading}
                            >
                                {PERIODS.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <label className={styles.checkboxRow}>
                            <input
                                type="checkbox"
                                checked={flaggedOnly}
                                onChange={(e) =>
                                    setFlaggedOnly(e.target.checked)
                                }
                                disabled={velocityLoading}
                            />
                            <span>Flagged only</span>
                        </label>
                    </div>

                    {flaggedCount > 0 && !flaggedOnly ? (
                        <div className={styles.alertBanner} role="status">
                            <span className={styles.alertIcon} aria-hidden>
                                ⚠️
                            </span>
                            <div className={styles.alertBannerTextCol}>
                                <p className={styles.alertText}>
                                    {flaggedCount} corroborated rapid submission(s): gap under{" "}
                                    {velocityPayload?.gap_threshold_seconds ?? 5}s{" "}
                                    <em>and</em> matching fingerprint, install ID, or submit
                                    IP vs the ballot immediately before.
                                </p>
                            </div>
                        </div>
                    ) : null}

                    {uncorroboratedRapid > 0 && !flaggedOnly ? (
                        <p className={styles.velocityContextNote} role="note">
                            {uncorroboratedRapid} other rapid transition(s) on this slice—gap
                            under {velocityPayload?.gap_threshold_seconds ?? 5}s between
                            ballots with <strong>different</strong> device/network signals—
                            expected during busy voting and intentionally not flagged red.
                        </p>
                    ) : null}

                    <div className={styles.chartCard}>
                        {velocityLoading ? (
                            <p className={styles.loadingText}>Loading chart…</p>
                        ) : velocityError ? (
                            <p className={styles.errorText}>{velocityError}</p>
                        ) : (velocityPayload?.points?.length ?? 0) === 0 ? (
                            <p className={styles.emptyScatter}>
                                No sequential ballot gaps for this filter. Try
                                another date or period.
                            </p>
                        ) : (
                            <ResponsiveContainer width="100%" height={360}>
                                <ScatterChart
                                    margin={{
                                        top: 12,
                                        right: 18,
                                        bottom: 52,
                                        left: 8,
                                    }}
                                >
                                    <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                                    <XAxis
                                        type="number"
                                        dataKey="gap_seconds"
                                        name="Time Between Votes"
                                        unit=" s"
                                        stroke="#64748b"
                                        tick={{ fill: "#475569", fontSize: 11 }}
                                        label={{
                                            value: "Time Between Votes (s)",
                                            position: "bottom",
                                            offset: 28,
                                            fill: "#334155",
                                            fontSize: 13,
                                            fontWeight: 600,
                                        }}
                                    />
                                    <YAxis
                                        type="number"
                                        dataKey="latency_ms"
                                        name="Latency"
                                        unit=" ms"
                                        stroke="#64748b"
                                        tick={{ fill: "#475569", fontSize: 11 }}
                                        label={{
                                            value: "Latency (ms)",
                                            angle: -90,
                                            position: "insideLeft",
                                            offset: 4,
                                            fill: "#334155",
                                            fontSize: 13,
                                            fontWeight: 600,
                                        }}
                                    />
                                    <Tooltip
                                        cursor={{
                                            strokeDasharray: "4 4",
                                            stroke: "#94a3b8",
                                        }}
                                        content={<VelocityTooltip />}
                                    />
                                    <Scatter
                                        name="Normal"
                                        data={normalPoints}
                                        fill="rgba(137, 20, 55, 0.42)"
                                    />
                                    <Scatter
                                        name="Corroborated"
                                        data={flaggedPoints}
                                        fill="#dc2626"
                                    />
                                </ScatterChart>
                            </ResponsiveContainer>
                        )}
                        <p className={styles.chartFootnote}>
                            Red = gap under{" "}
                            {velocityPayload?.gap_threshold_seconds ?? 5}s{" "}
                            <em>and</em> matching device fingerprint, browser install ID, or
                            submit IP vs the prior ballot. Other dots may still show short
                            gaps from unrelated voters during peak turnout.
                        </p>
                    </div>
                </>
            ) : (
                <>
                    <p className={styles.evidenceNote}>
                        Each row is a <strong>cluster</strong> where multiple
                        distinct voters submitted from the same signal. Signals are
                        strongest when <strong>fingerprint</strong>,{" "}
                        <strong>install ID</strong>, and <strong>submit IP</strong>{" "}
                        align. Server fields (IP, User-Agent) are taken from the
                        ballot HTTP request. Use alongside institutional procedures;
                        technical patterns alone are not automatic proof of intent.
                    </p>

                    <div className={styles.insightsPanel}>
                        <p className={styles.insightsTitle}>
                            What to do with this report
                        </p>
                        <ul className={styles.insightsList}>
                            <li>
                                <strong>Understand each table:</strong> A row appears only
                                when <strong>more than one voter</strong> shares that
                                fingerprint hash, browser install ID, or observed submit IP
                                for this election.
                            </li>
                            <li>
                                <strong>Triage severity:</strong> Clusters where{" "}
                                <strong>all three</strong> signals overlap for the same
                                voters deserve the fastest review; IP-only overlaps may be
                                dorms, VPNs, or misconfigured proxies—confirm network context.
                            </li>
                            <li>
                                <strong>Recommended workflow:</strong> Export or note cluster
                                IDs, pull voter identities from your admin roster, and record
                                whether a legitimate shared device or official polling
                                station explains the overlap.
                            </li>
                            <li>
                                <strong>Operational checks:</strong> Ask IT whether reverse
                                proxies forward client IPs correctly; wrong IPs inflate false
                                “shared IP” clusters in production.
                            </li>
                            <li>
                                <strong>Governance:</strong> Treat findings as sensitive,
                                involve your designated authority, and avoid public accusations
                                based only on telemetry.
                            </li>
                            <li>
                                <strong>Empty tables?</strong> Ballots cast without client
                                metadata, or genuinely distinct devices, produce no rows—still
                                review <strong>Vote Velocity</strong> or ballot audits if other
                                red flags exist.
                            </li>
                        </ul>
                    </div>

                    <div className={styles.fpLegend}>
                        <span className={styles.fpDot} aria-hidden />
                        Corroborating submission clusters
                    </div>

                    {totalCorroboration > 0 ? (
                        <div className={styles.alertBanner} role="status">
                            <span className={styles.alertIcon} aria-hidden>
                                ⚠️
                            </span>
                            <p className={styles.alertText}>
                                {totalCorroboration} corroborating fraud-pattern
                                signal(s): {fpClusters} fingerprint cluster(s),{" "}
                                {installClusters} shared browser install(s),{" "}
                                {ipClusters} shared submit IP(s).
                            </p>
                        </div>
                    ) : null}

                    <div className={styles.deviceCard}>
                        {deviceLoading ? (
                            <p className={styles.loadingText}>Loading evidence…</p>
                        ) : deviceError ? (
                            <p className={styles.errorText}>{deviceError}</p>
                        ) : !hasFingerprintEvidence ? (
                            <p className={styles.emptyScatter}>
                                No multi-voter clusters detected for fingerprint hash,
                                install ID, or submit IP (or audit fields were not
                                recorded for these ballots).
                            </p>
                        ) : (
                            <>
                                {fpRows.length > 0 ? (
                                    <>
                                        <h3 className={styles.fpSectionTitle}>
                                            Fingerprint hash (client environment digest)
                                        </h3>
                                        <div className={styles.deviceTableWrap}>
                                            <table className={styles.deviceTable}>
                                                <thead>
                                                    <tr>
                                                        <th>Fingerprint ID</th>
                                                        <th>Unique Voters</th>
                                                        <th>Total Votes</th>
                                                        <th>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {fpRows.map((row) => (
                                                        <tr key={row.device_hash}>
                                                            <td
                                                                className={
                                                                    styles.deviceIdCell
                                                                }
                                                            >
                                                                {row.device_id_display}
                                                            </td>
                                                            <td>{row.unique_voters}</td>
                                                            <td>{row.total_votes}</td>
                                                            <td>
                                                                <span
                                                                    className={
                                                                        styles.statusCell
                                                                    }
                                                                >
                                                                    <span aria-hidden>
                                                                        ⚠️
                                                                    </span>
                                                                    Pattern
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                ) : null}

                                {installRows.length > 0 ? (
                                    <>
                                        <h3
                                            className={`${styles.fpSectionTitle} ${fpRows.length ? styles.fpSectionSpaced : ""}`}
                                        >
                                            Browser install ID (first-party UUID)
                                        </h3>
                                        <div className={styles.deviceTableWrap}>
                                            <table className={styles.deviceTable}>
                                                <thead>
                                                    <tr>
                                                        <th>Install ID</th>
                                                        <th>Unique Voters</th>
                                                        <th>Total Votes</th>
                                                        <th>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {installRows.map((row) => (
                                                        <tr key={row.install_id}>
                                                            <td
                                                                className={
                                                                    styles.deviceIdCell
                                                                }
                                                                title={row.install_id}
                                                            >
                                                                {
                                                                    row.install_id_display
                                                                }
                                                            </td>
                                                            <td>{row.unique_voters}</td>
                                                            <td>{row.total_votes}</td>
                                                            <td>
                                                                <span
                                                                    className={
                                                                        styles.statusCell
                                                                    }
                                                                >
                                                                    <span aria-hidden>
                                                                        ⚠️
                                                                    </span>
                                                                    Pattern
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                ) : null}

                                {ipRows.length > 0 ? (
                                    <>
                                        <h3
                                            className={`${styles.fpSectionTitle} ${fpRows.length || installRows.length ? styles.fpSectionSpaced : ""}`}
                                        >
                                            Submit IP (server-observed)
                                        </h3>
                                        <div className={styles.deviceTableWrap}>
                                            <table className={styles.deviceTable}>
                                                <thead>
                                                    <tr>
                                                        <th>IP Address</th>
                                                        <th>Unique Voters</th>
                                                        <th>Total Votes</th>
                                                        <th>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {ipRows.map((row) => (
                                                        <tr key={row.ip}>
                                                            <td
                                                                className={
                                                                    styles.deviceIdCell
                                                                }
                                                            >
                                                                {row.ip}
                                                            </td>
                                                            <td>{row.unique_voters}</td>
                                                            <td>{row.total_votes}</td>
                                                            <td>
                                                                <span
                                                                    className={
                                                                        styles.statusCell
                                                                    }
                                                                >
                                                                    <span aria-hidden>
                                                                        ⚠️
                                                                    </span>
                                                                    Pattern
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                ) : null}
                            </>
                        )}
                        <p className={styles.chartFootnote}>
                            Fingerprint = SHA-256 of expanded browser signals. Install
                            ID persists in the voter browser for this site. IP is read
                            from the connection when the ballot POST is received (proxy
                            headers must be configured correctly in production).
                        </p>
                    </div>
                </>
            )}
        </div>
    )
}

export default AdminVoteVelocityReport
