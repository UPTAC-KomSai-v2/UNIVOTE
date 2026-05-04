import { useEffect, useMemo, useState } from "react"
import api from "../../api"
import styles from "./AuditorReportArchiveTables.module.css"

function formatPct(n) {
    if (typeof n !== "number" || Number.isNaN(n)) return "0%"
    return `${n.toFixed(2)}%`
}

function turnoutDegree(voted, eligible) {
    const v = Number(voted)
    const e = Number(eligible)
    if (!Number.isFinite(v) || !Number.isFinite(e) || e < 1) return 0
    return Math.min(100, Math.round((v / e) * 10000) / 100)
}

function leadingRow(block) {
    const choices = block?.choices ?? []
    if (!choices.length) return null
    const best = [...choices].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))[0]
    return best
}

function topCouncilChoices(block, limit) {
    const choices = [...(block?.choices ?? [])].sort(
        (a, b) => (b.votes ?? 0) - (a.votes ?? 0)
    )
    return choices.slice(0, limit)
}

export default function AuditorReportArchiveTables({
    electionId,
    activeView,
    reportSectionTitle,
    electionName,
    electionRangeLabel,
    electionStatusLabel,
    generatedAtDisplay,
    generatedAtIso,
}) {
    const [results, setResults] = useState(null)
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
                    `/api/auditor/election-results/${electionId}/`
                )
                if (cancelled) return
                setResults(res.data)
                if (activeView === "linegraph") {
                    const tl = await api.get(
                        `/api/auditor/election-ballot-timeline/${electionId}/`
                    )
                    if (cancelled) return
                    setTimeline(tl.data)
                } else {
                    if (!cancelled) setTimeline(null)
                }
            } catch (err) {
                const detail = err.response?.data?.detail
                if (!cancelled) {
                    setResults(null)
                    setTimeline(null)
                    setError(
                        typeof detail === "string"
                            ? detail
                            : "Could not load archival data."
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
    }, [electionId, activeView])

    const ballotsCast = results?.ballots_cast ?? 0
    const eligibleVoters = results?.eligible_voters ?? 0
    const overallTurnout =
        eligibleVoters > 0
            ? Math.round((ballotsCast / eligibleVoters) * 10000) / 100
            : 0

    const leadingSnapshotRows = useMemo(() => {
        const positions = results?.positions ?? []
        const rows = []

        const chairBlock = positions.find((p) => p.position === "Chairperson")
        const viceBlock = positions.find((p) => p.position === "Vice Chairperson")
        const councilBlock = positions.find((p) => p.position === "Councilor")

        const leadChair = leadingRow(chairBlock)
        rows.push({
            key: "chair",
            positionLabel: "Chairperson",
            choice: leadChair?.name ?? "—",
            votes: leadChair?.votes ?? 0,
            pct: leadChair?.pct_of_ballots_cast ?? 0,
        })

        const leadVice = leadingRow(viceBlock)
        rows.push({
            key: "vice",
            positionLabel: "Vice Chairperson",
            choice: leadVice?.name ?? "—",
            votes: leadVice?.votes ?? 0,
            pct: leadVice?.pct_of_ballots_cast ?? 0,
        })

        const topCouncil = topCouncilChoices(councilBlock, 7)
        if (!topCouncil.length) {
            rows.push({
                key: "council-empty",
                positionLabel: "Councilor (1)",
                choice: "—",
                votes: 0,
                pct: 0,
            })
        } else {
            topCouncil.forEach((c, i) => {
                rows.push({
                    key: `council-${i}-${c.name}-${c.candidate_voter_id ?? "x"}`,
                    positionLabel: `Councilor (${i + 1})`,
                    choice: c.name,
                    votes: c.votes ?? 0,
                    pct: c.pct_of_ballots_cast ?? 0,
                })
            })
        }

        return rows
    }, [results])

    const degreeRows = useMemo(() => {
        const list = results?.degree_programs ?? []
        return list.map((d) => ({
            program: d.program,
            voted: d.voted ?? 0,
            eligible: d.eligible ?? 0,
            turnoutEligible: turnoutDegree(d.voted, d.eligible),
            pctBallots: d.pct_of_ballots_cast ?? 0,
        }))
    }, [results])

    const apathyRows = useMemo(() => {
        return results?.position_participation ?? []
    }, [results])

    const lineRows = useMemo(() => {
        const dates = timeline?.dates ?? []
        const series = timeline?.series ?? []
        if (!dates.length) return []
        return dates.map((iso, i) => {
            const cells = series.map((s) => s.values?.[i] ?? 0)
            const dailyTotal = cells.reduce((a, n) => a + n, 0)
            return {
                iso,
                cells,
                dailyTotal,
            }
        })
    }, [timeline])

    const seriesLabels = timeline?.series ?? []

    if (loading) {
        return (
            <section className={styles.section} aria-label="Archival data">
                <h4 className={styles.sectionTitle}>Archival tabular data</h4>
                <p className={styles.loading}>Loading tables for print…</p>
            </section>
        )
    }

    if (error) {
        return (
            <section className={styles.section} aria-label="Archival data">
                <h4 className={styles.sectionTitle}>Archival tabular data</h4>
                <p className={styles.error} role="alert">
                    {error}
                </p>
            </section>
        )
    }

    return (
        <section className={styles.section} aria-label="Archival data">
            <h4 className={styles.sectionTitle}>Archival tabular data</h4>
            <p className={styles.hint}>
                The tables below mirror the figures used in this report and are
                included when you print — suitable for filing or audit trails.
            </p>

            <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.metaTable}`}>
                    <tbody>
                        <tr>
                            <th scope="row">Report section</th>
                            <td>{reportSectionTitle}</td>
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
                                <time dateTime={generatedAtIso}>
                                    {generatedAtDisplay}
                                </time>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">Ballots cast</th>
                            <td>{ballotsCast}</td>
                        </tr>
                        <tr>
                            <th scope="row">Eligible voters (roster)</th>
                            <td>{eligibleVoters}</td>
                        </tr>
                        <tr>
                            <th scope="row">Overall turnout</th>
                            <td>{formatPct(overallTurnout)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {activeView === "results" ? (
                <>
                    <h5 className={styles.sectionTitle}>Leading choice snapshot</h5>
                    <p className={styles.hint}>
                        Chairperson and Vice Chairperson show the top choice; Councilor
                        lists up to the top seven candidates by votes.
                    </p>
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th scope="col">Position</th>
                                    <th scope="col">Choice</th>
                                    <th className={styles.num} scope="col">
                                        Votes
                                    </th>
                                    <th className={styles.num} scope="col">
                                        % of ballots cast
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {leadingSnapshotRows.map((r) => (
                                    <tr key={r.key}>
                                        <td>{r.positionLabel}</td>
                                        <td>{r.choice}</td>
                                        <td className={styles.num}>{r.votes}</td>
                                        <td className={styles.num}>
                                            {formatPct(r.pct)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className={styles.hint}>
                        Full per-choice tallies and degree breakdowns appear in the
                        sections above.
                    </p>
                </>
            ) : null}

            {activeView === "barchart" ? (
                <>
                    <h5 className={styles.sectionTitle}>
                        Turnout by degree program
                    </h5>
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th scope="col">Degree program</th>
                                    <th className={styles.num} scope="col">
                                        Ballots (voters)
                                    </th>
                                    <th className={styles.num} scope="col">
                                        Eligible
                                    </th>
                                    <th className={styles.num} scope="col">
                                        % of eligible (chart)
                                    </th>
                                    <th className={styles.num} scope="col">
                                        % of ballots cast
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {degreeRows.map((r) => (
                                    <tr key={r.program}>
                                        <td>{r.program}</td>
                                        <td className={styles.num}>{r.voted}</td>
                                        <td className={styles.num}>{r.eligible}</td>
                                        <td className={styles.num}>
                                            {formatPct(r.turnoutEligible)}
                                        </td>
                                        <td className={styles.num}>
                                            {formatPct(r.pctBallots)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : null}

            {activeView === "apathy" ? (
                <>
                    <h5 className={styles.sectionTitle}>
                        Participation by race (eligible voters)
                    </h5>
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th scope="col">Position</th>
                                    <th className={styles.num} scope="col">
                                        Chose a candidate
                                    </th>
                                    <th className={styles.num} scope="col">
                                        Eligible
                                    </th>
                                    <th className={styles.num} scope="col">
                                        Participation %
                                    </th>
                                    <th className={styles.num} scope="col">
                                        Abstention %
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {apathyRows.map((r) => (
                                    <tr key={r.position}>
                                        <td>{r.position}</td>
                                        <td className={styles.num}>
                                            {r.selected_candidate ?? 0}
                                        </td>
                                        <td className={styles.num}>
                                            {r.eligible ?? 0}
                                        </td>
                                        <td className={styles.num}>
                                            {formatPct(r.participation_pct ?? 0)}
                                        </td>
                                        <td className={styles.num}>
                                            {formatPct(r.apathy_pct ?? 0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : null}

            {activeView === "linegraph" ? (
                <>
                    <h5 className={styles.sectionTitle}>
                        Ballots per day by year level
                    </h5>
                    {lineRows.length ? (
                        <div className={styles.tableWrap}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th scope="col">Date (ISO)</th>
                                        {seriesLabels.map((s, idx) => (
                                            <th
                                                key={`${s.key ?? "y"}-${idx}`}
                                                className={styles.num}
                                                scope="col"
                                            >
                                                {s.label ?? s.key}
                                            </th>
                                        ))}
                                        <th className={styles.num} scope="col">
                                            Daily total
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineRows.map((row) => (
                                        <tr key={row.iso}>
                                            <td>{row.iso}</td>
                                            {row.cells.map((v, j) => (
                                                <td key={j} className={styles.num}>
                                                    {v}
                                                </td>
                                            ))}
                                            <td className={styles.num}>
                                                {row.dailyTotal}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className={styles.hint}>
                            No timeline rows in range — chart may be empty.
                        </p>
                    )}
                </>
            ) : null}

            {activeView !== "results" &&
            activeView !== "barchart" &&
            activeView !== "linegraph" &&
            activeView !== "apathy" ? (
                <p className={styles.hint}>
                    Switch to Results, Bar Chart, Line Graph, or Apathy Index to
                    attach section-specific tables to this printout.
                </p>
            ) : null}
        </section>
    )
}
