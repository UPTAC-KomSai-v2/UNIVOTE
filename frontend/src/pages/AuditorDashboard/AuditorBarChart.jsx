import { useEffect, useMemo, useState } from "react"
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
import chartStyles from "./AuditorCharts.module.css"

function turnoutPct(voted, eligible) {
    const v = Number(voted)
    const e = Number(eligible)
    if (!Number.isFinite(v) || !Number.isFinite(e) || e < 1) return 0
    return Math.min(100, Math.round((v / e) * 10000) / 100)
}

function BarTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const row = payload[0]?.payload
    if (!row) return null
    return (
        <div className={chartStyles.barTooltip}>
            <strong>{row.program}</strong>
            <div>{row.turnout}% turnout</div>
            <div>
                {row.voted} / {row.eligible} voted (eligible)
            </div>
        </div>
    )
}

export default function AuditorBarChart({ electionId }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            setLoading(true)
            setError("")
            try {
                const res = await api.get(
                    `/api/auditor/election-results/${electionId}/`
                )
                if (!cancelled) setData(res.data)
            } catch (err) {
                const detail = err.response?.data?.detail
                if (!cancelled) {
                    setData(null)
                    setError(
                        typeof detail === "string"
                            ? detail
                            : "Could not load chart data."
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

    const rows = useMemo(() => {
        const list = data?.degree_programs ?? []
        return list.map((d) => ({
            program: d.program,
            voted: d.voted ?? 0,
            eligible: d.eligible ?? 0,
            turnout: turnoutPct(d.voted, d.eligible),
        }))
    }, [data])

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

    if (!rows.length) {
        return (
            <div className={chartStyles.chartWrap}>
                <p className={chartStyles.message}>
                    No degree-program turnout data for this election yet.
                </p>
            </div>
        )
    }

    const ink = "#6b1a32"
    const axisStyle = { fill: ink, fontSize: 11 }

    return (
        <div className={chartStyles.chartWrap}>
            <h3 className={chartStyles.chartTitle}>
                Turnout by degree program (% of eligible voters)
            </h3>
            <p className={chartStyles.chartSubtitle}>
                For each degree program, the bar height is the share of that
                program’s eligible voters who submitted a ballot (capped at 100%).
                Taller gold bars mean stronger turnout within that program.
            </p>
            <div className={chartStyles.chartViewport}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={rows}
                        margin={{ top: 8, right: 8, left: 0, bottom: 72 }}
                        barCategoryGap="18%"
                    >
                        <CartesianGrid
                            strokeDasharray="4 6"
                            stroke={ink}
                            strokeOpacity={0.22}
                            vertical={false}
                        />
                        <XAxis
                            dataKey="program"
                            tick={axisStyle}
                            tickLine={{ stroke: ink }}
                            axisLine={{ stroke: ink }}
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            height={70}
                        />
                        <YAxis
                            domain={[0, 100]}
                            ticks={[0, 25, 50, 75, 100]}
                            tickFormatter={(v) => `${v}%`}
                            tick={axisStyle}
                            tickLine={{ stroke: ink }}
                            axisLine={{ stroke: ink }}
                            width={44}
                        />
                        <Tooltip
                            cursor={{ fill: "rgba(137, 20, 55, 0.06)" }}
                            content={<BarTooltip />}
                        />
                        <Bar
                            dataKey="turnout"
                            fill="#FFB81C"
                            radius={[6, 6, 0, 0]}
                            maxBarSize={48}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
