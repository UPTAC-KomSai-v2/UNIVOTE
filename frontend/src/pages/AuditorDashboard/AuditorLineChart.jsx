import { useEffect, useMemo, useState } from "react"
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import api from "../../api"
import chartStyles from "./AuditorCharts.module.css"

/* 5th line: slate rose — distinct on #f2dede */
const YEAR_COLORS = ["#5fbc9f", "#ff9f43", "#e8c547", "#c4b5fd", "#b4659d"]
const LINE_KEYS = ["y1", "y2", "y3", "y4", "y5"]

function formatShortDate(iso) {
    try {
        const [y, m, d] = iso.split("-").map(Number)
        if (!y || !m || !d) return iso
        const dt = new Date(y, m - 1, d)
        return dt.toLocaleDateString(undefined, {
            month: "short",
            day: "2-digit",
        })
    } catch {
        return iso
    }
}

function LineTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
        <div className={chartStyles.lineTooltip}>
            <div className={chartStyles.lineTooltipTitle}>{label}</div>
            {payload.map((p) => (
                <div key={String(p.dataKey)} className={chartStyles.lineTooltipRow}>
                    <span
                        className={chartStyles.lineTooltipDot}
                        style={{ background: p.color }}
                    />
                    <span>
                        {p.name}: {p.value ?? 0}
                    </span>
                </div>
            ))}
        </div>
    )
}

function renderLegend({ payload }) {
    if (!payload?.length) return null
    return (
        <div className={chartStyles.legendHost}>
            <ul className={chartStyles.legendList}>
                {payload.map((entry) => (
                    <li key={entry.value} className={chartStyles.legendRow}>
                        <span
                            className={chartStyles.legendStroke}
                            style={{ background: entry.color }}
                        />
                        {entry.value}
                    </li>
                ))}
            </ul>
        </div>
    )
}

function buildYScale(series) {
    const vals = series.flatMap((s) => s.values ?? [])
    const maxV = Math.max(0, ...vals)
    const padded = Math.ceil(Math.max(maxV * 1.08, 30))
    const top = padded <= 120 ? 120 : Math.ceil(padded / 30) * 30
    const step = top <= 120 ? 30 : Math.max(30, Math.ceil(top / 5 / 30) * 30)
    const ticks = []
    for (let v = 0; v <= top; v += step) ticks.push(v)
    return { top, ticks }
}

export default function AuditorLineChart({ electionId }) {
    const [timeline, setTimeline] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            setError("")
            try {
                const res = await api.get(
                    `/api/auditor/election-ballot-timeline/${electionId}/`
                )
                if (!cancelled) setTimeline(res.data)
            } catch (err) {
                const detail = err.response?.data?.detail
                if (!cancelled) {
                    setTimeline(null)
                    setError(
                        typeof detail === "string"
                            ? detail
                            : "Could not load timeline."
                    )
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        if (electionId != null) load()
        return () => {
            cancelled = true
        }
    }, [electionId])

    const chartData = useMemo(() => {
        const dates = timeline?.dates ?? []
        const series = timeline?.series ?? []
        if (!dates.length) return []
        return dates.map((iso, i) => {
            const row = {
                dateLabel: formatShortDate(iso),
                iso,
            }
            LINE_KEYS.forEach((key, j) => {
                row[key] = series[j]?.values?.[i] ?? 0
            })
            return row
        })
    }, [timeline])

    const { top: yTop, ticks: yTicks } = useMemo(
        () => buildYScale(timeline?.series ?? []),
        [timeline]
    )

    if (loading) {
        return (
            <div className={chartStyles.chartWrap}>
                <p className={chartStyles.message}>Loading chart…</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className={chartStyles.chartWrap}>
                <p className={chartStyles.message} role="alert">
                    {error}
                </p>
            </div>
        )
    }

    if (!chartData.length) {
        return (
            <div className={chartStyles.chartWrap}>
                <p className={chartStyles.message}>
                    No ballot dates in range for this election yet.
                </p>
            </div>
        )
    }

    const ink = "#6b1a32"
    const axisStyle = { fill: ink, fontSize: 11 }
    const series = timeline?.series ?? []

    return (
        <div className={chartStyles.chartWrap}>
            <h3 className={chartStyles.chartTitle}>
                Ballots cast per day by year level
            </h3>
            <p className={chartStyles.chartSubtitle}>
                Five lines track ballot submissions by calendar day for 1st through
                4th Year students and for 5 and Up students. Higher points mean more
                ballots from that cohort on that day — hover a date to see all values
                together.
            </p>
            <div className={chartStyles.chartViewportLine}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{ top: 12, right: 8, left: 0, bottom: 108 }}
                    >
                        <CartesianGrid
                            strokeDasharray="4 6"
                            stroke={ink}
                            strokeOpacity={0.22}
                        />
                        <XAxis
                            dataKey="dateLabel"
                            tick={axisStyle}
                            tickLine={{ stroke: ink }}
                            axisLine={{ stroke: ink }}
                            interval={0}
                            angle={-35}
                            textAnchor="end"
                            height={56}
                        />
                        <YAxis
                            domain={[0, yTop]}
                            ticks={yTicks}
                            tick={axisStyle}
                            tickLine={{ stroke: ink }}
                            axisLine={{ stroke: ink }}
                            width={44}
                        />
                        <Tooltip content={<LineTooltip />} />
                        <Legend
                            verticalAlign="bottom"
                            align="left"
                            content={renderLegend}
                        />
                        {LINE_KEYS.map((dataKey, j) => (
                            <Line
                                key={dataKey}
                                type="monotone"
                                dataKey={dataKey}
                                name={
                                    series[j]?.label ??
                                    [
                                        "1st Year students",
                                        "2nd Year students",
                                        "3rd Year students",
                                        "4th Year students",
                                        "5 and Up students",
                                    ][j]
                                }
                                stroke={YEAR_COLORS[j]}
                                strokeWidth={2}
                                dot={{
                                    r: 4,
                                    fill: YEAR_COLORS[j],
                                    strokeWidth: 0,
                                }}
                                activeDot={{
                                    r: 7,
                                    stroke: "#891437",
                                    strokeWidth: 2,
                                    fill: YEAR_COLORS[j],
                                }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
