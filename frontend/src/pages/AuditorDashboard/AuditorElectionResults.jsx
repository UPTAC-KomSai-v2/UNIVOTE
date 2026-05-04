import { memo, useEffect, useMemo, useState } from "react"
import api from "../../api"
import CustomPieChart from "../../components/PieChart/CustomPieChart.jsx"
import styles from "./AuditorElectionResults.module.css"
import "./auditor-scrollbar.css"

function formatPct(n) {
    if (typeof n !== "number" || Number.isNaN(n)) return "0%"
    return `${n.toFixed(2)}%`
}

function chartRows(rows) {
    return rows.map((s) => ({ name: s.label, value: s.value }))
}

function positionSlices(block) {
    const choices = block?.choices ?? []
    return choices.map((c) => ({
        label: c.name,
        value: c.votes,
    }))
}

function PositionSection({ block }) {
    if (!block) return null
    const slices = positionSlices(block)
    const totalVotes = slices.reduce((a, s) => a + s.value, 0)
    const choices = block.choices ?? []
    return (
        <section className={styles.positionSection}>
            <div className={styles.positionCard}>
                <h3 className={styles.positionTitle}>{block.position}</h3>
                <div className={styles.positionBody}>
                    <div className={styles.chartCard}>
                        <CustomPieChart
                            data={chartRows(slices)}
                            width={200}
                            height={260}
                            outerRadius={53}
                        />
                    </div>
                    <div className={styles.positionStatsWrap}>
                        {!totalVotes ? (
                            <p className={styles.muted}>No votes recorded for this seat.</p>
                        ) : (
                            <div
                                className={`${styles.tableScroll} auditor-scrollbar`}
                            >
                                <table className={`${styles.dataTable} ${styles.positionTable}`}>
                                    <thead>
                                        <tr>
                                            <th scope="col">Choice</th>
                                            <th scope="col">Votes</th>
                                            <th scope="col">% of ballots cast</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {choices.map((c) => (
                                            <tr
                                                key={`${c.name}-${c.abstain}-${c.candidate_voter_id}`}
                                            >
                                                <td>{c.name}</td>
                                                <td>{c.votes}</td>
                                                <td>{formatPct(c.pct_of_ballots_cast)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}

function AuditorElectionResults({ electionId }) {
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
                            : "Could not load election results."
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

    const degreeSlices = useMemo(() => {
        const rows = data?.degree_programs ?? []
        return rows.map((d) => ({
            label: d.program,
            value: d.voted,
        }))
    }, [data])

    const turnoutPct = useMemo(() => {
        const cast = data?.ballots_cast ?? 0
        const elig = data?.eligible_voters ?? 0
        if (!elig) return 0
        return Math.round((cast / elig) * 10000) / 100
    }, [data])

    const chairBlock = useMemo(
        () => data?.positions?.find((p) => p.position === "Chairperson"),
        [data]
    )
    const viceBlock = useMemo(
        () => data?.positions?.find((p) => p.position === "Vice Chairperson"),
        [data]
    )
    const councilBlock = useMemo(
        () => data?.positions?.find((p) => p.position === "Councilor"),
        [data]
    )

    if (loading) {
        return <p className={styles.centerNote}>Loading results…</p>
    }
    if (error) {
        return (
            <p className={styles.errorNote} role="alert">
                {error}
            </p>
        )
    }
    if (!data) {
        return <p className={styles.centerNote}>No data.</p>
    }

    const ballots = data.ballots_cast ?? 0
    const eligible = data.eligible_voters ?? 0

    return (
        <div className={styles.root}>
            <section className={styles.degreeSection} aria-labelledby="degree-results-heading">
                <h3 id="degree-results-heading" className={styles.sectionHeading}>
                    Voters per degree program
                </h3>
                <div className={styles.majorPanel}>
                    <div className={styles.degreeGrid}>
                        <div className={styles.chartCard}>
                            <CustomPieChart
                                data={chartRows(degreeSlices)}
                                width={260}
                                height={320}
                                outerRadius={70}
                            />
                        </div>
                        <div className={styles.statsCard}>
                            <p className={styles.bigStatLabel}>No. of voters</p>
                            <p className={styles.bigStatValue}>
                                {ballots} out of {eligible}{" "}
                                <span className={styles.pctMuted}>
                                    ({formatPct(turnoutPct)})
                                </span>
                            </p>
                            <p className={styles.subHeading}>Breakdown by program</p>
                            <div
                                className={`${styles.degreeTableScroll} auditor-scrollbar`}
                            >
                                <table className={`${styles.dataTable} ${styles.degreeTable}`}>
                                    <thead>
                                        <tr>
                                            <th scope="col">Degree program</th>
                                            <th scope="col">Voted</th>
                                            <th scope="col">Eligible</th>
                                            <th scope="col">% of ballots cast</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(data.degree_programs ?? []).map((d) => (
                                            <tr key={d.program}>
                                                <td>{d.program}</td>
                                                <td>{d.voted}</td>
                                                <td>{d.eligible}</td>
                                                <td>{formatPct(d.pct_of_ballots_cast)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {!ballots ? (
                                <p className={styles.muted}>
                                    No ballots cast in this election yet — charts will fill as
                                    voters submit.
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>
            </section>

            <section
                className={styles.candidateSections}
                aria-labelledby="position-results-heading"
            >
                <h3 id="position-results-heading" className={styles.sectionHeading}>
                    Results by position
                </h3>
                <div className={styles.majorPanel}>
                    <div className={styles.positionsStack}>
                        <PositionSection block={chairBlock} />
                        <PositionSection block={viceBlock} />
                        <PositionSection block={councilBlock} />
                    </div>
                </div>
            </section>

            <section className={styles.yearHint} aria-label="Year level data">
                <p className={styles.muted}>
                    Year-level splits for bar charts and analytics use the same{" "}
                    <code>year_level</code> field on voters (populated via CSV or admin).
                    This tab focuses on degree turnout and positional tallies.
                </p>
            </section>
        </div>
    )
}

export default memo(AuditorElectionResults)
