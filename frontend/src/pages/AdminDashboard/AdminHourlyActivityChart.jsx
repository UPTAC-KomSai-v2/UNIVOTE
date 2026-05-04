import { Fragment, useEffect, useMemo, useState } from "react"
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import api from "../../api"
import chartStyles from "../AuditorDashboard/AuditorCharts.module.css"
import archiveStyles from "../AuditorDashboard/AuditorReportArchiveTables.module.css"
import styles from "./AdminDashboard.module.css"

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

function HourTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const row = payload[0]?.payload
    if (!row) return null
    return (
        <div className={chartStyles.barTooltip}>
            <strong>{row.hourLabel}</strong>
            <div>{row.votes} ballot{row.votes === 1 ? "" : "s"}</div>
        </div>
    )
}

export default function AdminHourlyActivityChart({
    electionId,
    electionName,
    electionRangeLabel,
    electionStatusLabel,
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

    const [selectedDate, setSelectedDate] = useState(null)
    const [payload, setPayload] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        const today = localISODate(new Date())
        setSelectedDate(clampDateStr(today, bounds.min, bounds.max))
    }, [bounds])

    useEffect(() => {
        if (electionId == null || !selectedDate) return
        let cancelled = false
        const load = async () => {
            setLoading(true)
            setPayload(null)
            setError("")
            try {
                const res = await api.get(
                    `/api/admin/election-ballots-by-hour/${electionId}/`,
                    { params: { date: selectedDate } }
                )
                if (!cancelled) setPayload(res.data)
            } catch (err) {
                const detail = err.response?.data?.detail
                if (!cancelled) {
                    setPayload(null)
                    setError(
                        typeof detail === "string"
                            ? detail
                            : "Could not load hourly ballot data."
                    )
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [electionId, selectedDate])

    const rows = useMemo(() => {
        const labels = payload?.labels ?? []
        const counts = payload?.counts ?? []
        return labels.map((hourLabel, i) => ({
            hourLabel,
            votes: counts[i] ?? 0,
        }))
    }, [payload])

    const { yTop, yTicks } = useMemo(() => {
        const maxV = Math.max(0, ...rows.map((r) => r.votes))
        let top = maxV === 0 ? 20 : Math.ceil(Math.max(maxV, 5) / 5) * 5
        const step = top <= 40 ? 5 : top <= 100 ? 10 : Math.max(10, Math.ceil(top / 8))
        const ticks = []
        for (let v = 0; v <= top; v += step) ticks.push(v)
        return { yTop: top, ticks }
    }, [rows])

    const generatedAt = useMemo(() => {
        const d = new Date()
        return {
            iso: d.toISOString(),
            display: d.toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
            }),
        }
    }, [payload])

    const ink = "#6b1a32"
    const axisStyle = { fill: ink, fontSize: 11 }

    if (!selectedDate) {
        return (
            <div className={chartStyles.chartWrap}>
                <p className={chartStyles.message}>Preparing chart…</p>
            </div>
        )
    }

    const showArchive = Boolean(payload && !loading && !error)

    return (
        <Fragment>
            <div className={chartStyles.chartWrap}>
                <h3 className={chartStyles.chartTitle}>Voting activity by hour</h3>
                <p className={chartStyles.chartSubtitle}>
                    Ballots recorded in each clock hour on the selected calendar date
                    {payload?.timezone ? ` (${payload.timezone})` : ""}. Compare busy
                    hours to quiet periods across the voting window.
                </p>
                <div className={styles.hourlyFilter}>
                    <label className={styles.hourlyFilterLabel} htmlFor="admin-hourly-date">
                        Filter by date
                    </label>
                    <input
                        id="admin-hourly-date"
                        type="date"
                        className={styles.hourlyFilterInput}
                        value={selectedDate}
                        min={bounds.min}
                        max={bounds.max}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        disabled={loading}
                    />
                </div>
                {error ? (
                    <p className={chartStyles.message} role="alert">
                        {error}
                    </p>
                ) : loading ? (
                    <p className={chartStyles.message}>Loading chart…</p>
                ) : (
                    <div className={chartStyles.chartViewport}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={rows}
                                margin={{ top: 8, right: 8, left: 0, bottom: 72 }}
                                barCategoryGap="12%"
                            >
                                <CartesianGrid
                                    strokeDasharray="4 6"
                                    stroke={ink}
                                    strokeOpacity={0.22}
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="hourLabel"
                                    tick={axisStyle}
                                    tickLine={{ stroke: ink }}
                                    axisLine={{ stroke: ink }}
                                    interval={0}
                                    angle={-45}
                                    textAnchor="end"
                                    height={70}
                                />
                                <YAxis
                                    domain={[0, yTop]}
                                    ticks={yTicks}
                                    tick={axisStyle}
                                    tickLine={{ stroke: ink }}
                                    axisLine={{ stroke: ink }}
                                    width={44}
                                    allowDecimals={false}
                                />
                                <Tooltip
                                    cursor={{
                                        fill: "rgba(137, 20, 55, 0.06)",
                                    }}
                                    content={<HourTooltip />}
                                />
                                <Bar
                                    dataKey="votes"
                                    fill="#FFB81C"
                                    radius={[6, 6, 0, 0]}
                                    maxBarSize={36}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {showArchive ? (
                <section className={archiveStyles.section} aria-label="Archival data">
                    <h4 className={archiveStyles.sectionTitle}>Archival tabular data</h4>
                    <p className={archiveStyles.hint}>
                        The tables below mirror the hourly chart and are included when
                        you print — suitable for filing or audit trails.
                    </p>

                    <div className={archiveStyles.tableWrap}>
                        <table className={`${archiveStyles.table} ${archiveStyles.metaTable}`}>
                            <tbody>
                                <tr>
                                    <th scope="row">Report section</th>
                                    <td>Voting Activity by Hour</td>
                                </tr>
                                <tr>
                                    <th scope="row">Election</th>
                                    <td>
                                        {electionName} (ID {electionId})
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row">Voting period</th>
                                    <td>{electionRangeLabel || "—"}</td>
                                </tr>
                                <tr>
                                    <th scope="row">Election status</th>
                                    <td>{electionStatusLabel || "—"}</td>
                                </tr>
                                <tr>
                                    <th scope="row">Generated</th>
                                    <td>
                                        <time dateTime={generatedAt.iso}>
                                            {generatedAt.display}
                                        </time>
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row">Selected date</th>
                                    <td>{payload.date}</td>
                                </tr>
                                <tr>
                                    <th scope="row">Hour grouping timezone</th>
                                    <td>{payload.timezone ?? "—"}</td>
                                </tr>
                                <tr>
                                    <th scope="row">Ballots on selected date</th>
                                    <td>
                                        {payload.ballots_on_date ??
                                            rows.reduce((s, r) => s + r.votes, 0)}
                                    </td>
                                </tr>
                                <tr>
                                    <th scope="row">Total ballots cast (election)</th>
                                    <td>{payload.ballots_cast_total ?? 0}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <h5 className={archiveStyles.sectionTitle}>Ballots by hour</h5>
                    <div className={archiveStyles.tableWrap}>
                        <table className={archiveStyles.table}>
                            <thead>
                                <tr>
                                    <th scope="col">Hour</th>
                                    <th className={archiveStyles.num} scope="col">
                                        Ballots
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.hourLabel}>
                                        <td>{r.hourLabel}</td>
                                        <td className={archiveStyles.num}>{r.votes}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ) : null}
        </Fragment>
    )
}
