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

function ApathyTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const row = payload[0]?.payload
    if (!row) return null
    return (
        <div className={chartStyles.barTooltip}>
            <strong>{row.position}</strong>
            <div>
                {row.engaged} out of {row.eligible} voters ({row.participation}%)
            </div>
            <div className={chartStyles.apathyTooltipNote}>
                Apathy index: {row.apathy}% abstained on this race
            </div>
        </div>
    )
}

export default function AuditorApathyChart({ electionId }) {
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
        const list = data?.position_participation ?? []
        return list.map((row) => {
            const participation = Number(row.participation_pct ?? 0)
            const eligible = Number(row.eligible ?? 0)
            const engaged = Number(row.selected_candidate ?? 0)
            const apathy = Number(row.apathy_pct ?? 0)
            return {
                position: row.position,
                participation,
                engaged,
                eligible,
                apathy,
            }
        })
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
                    No participation data for this election yet.
                </p>
            </div>
        )
    }

    const ink = "#6b1a32"
    const axisStyle = { fill: ink, fontSize: 11 }

    return (
        <div className={chartStyles.chartWrap}>
            <h3 className={chartStyles.chartTitle}>Apathy index by race</h3>
            <p className={chartStyles.chartSubtitle}>
                Share of eligible voters who selected a candidate for each office
                (not abstaining). Taller gold bars mean lower abstention on that race.
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
                            dataKey="position"
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
                            content={<ApathyTooltip />}
                        />
                        <Bar
                            dataKey="participation"
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
