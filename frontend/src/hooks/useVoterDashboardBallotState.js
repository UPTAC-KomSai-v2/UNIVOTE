import { useEffect, useState } from "react";
import api from "../api";

function formatElectionOpens(iso) {
    if (!iso) return "";
    try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        });
    } catch {
        return "";
    }
}

/**
 * Derive a single primary CTA from ``current_cycle`` on ballot-session (includes
 * enrollment when voting is scheduled / ended — not only while the window is open).
 */
export function deriveDashboardBallotPrimary(cycle) {
    if (!cycle?.election) {
        return {
            kind: "no_cycle",
            label: "No active election cycle",
            disabled: true,
            path: null,
        };
    }

    const { voting_open: votingOpen, is_enrolled: enrolled, has_cast_ballot: voted } =
        cycle;
    const state = cycle.election.state;

    if (votingOpen) {
        if (voted) {
            return {
                kind: "receipt",
                label: "View voting receipt",
                disabled: false,
                path: "/voter-receipt",
            };
        }
        if (enrolled) {
            return {
                kind: "vote",
                label: "Vote",
                disabled: false,
                path: "/voter-vote",
            };
        }
        return {
            kind: "not_enrolled",
            label: "Not enrolled for this election",
            disabled: true,
            path: null,
        };
    }

    if (voted) {
        return {
            kind: "receipt",
            label: "View voting receipt",
            disabled: false,
            path: "/voter-receipt",
        };
    }

    if (enrolled) {
        if (state === "scheduled") {
            const opens = formatElectionOpens(cycle.election.start_datetime);
            return {
                kind: "scheduled",
                label: opens ? `Voting opens ${opens}` : "Voting has not started yet",
                disabled: true,
                path: null,
            };
        }
        if (state === "ended") {
            return {
                kind: "ended_no_ballot",
                label: "Election ended — no ballot submitted",
                disabled: true,
                path: null,
            };
        }
        return {
            kind: "waiting",
            label: "Ballot not yet available",
            disabled: true,
            path: null,
        };
    }

    return {
        kind: "not_enrolled",
        label: "Not enrolled for the current election",
        disabled: true,
        path: null,
    };
}

/**
 * Single adaptive primary action for voter/candidate dashboards (Vote vs receipt vs status).
 */
function ballotCycleFromSessionPayload(data) {
    const c = data?.current_cycle;
    if (c?.election != null) return c;
    const d = data || {};
    if (d.election == null) return null;
    return {
        election: d.election,
        voting_open: true,
        is_enrolled: Boolean(d.is_enrolled),
        has_cast_ballot: Boolean(d.has_cast_ballot),
    };
}

export function useVoterDashboardBallotState(meLoading, mustChangePassword) {
    const [primaryAction, setPrimaryAction] = useState(() =>
        deriveDashboardBallotPrimary(null)
    );
    const [ballotSessionLoading, setBallotSessionLoading] = useState(true);

    useEffect(() => {
        if (meLoading || mustChangePassword) {
            setBallotSessionLoading(true);
            setPrimaryAction(
                deriveDashboardBallotPrimary(null)
            );
            return undefined;
        }
        let cancelled = false;
        setBallotSessionLoading(true);
        (async () => {
            try {
                const sessionRes = await api.get("/api/voters/ballot-session/");
                if (cancelled) return;
                const cycle = ballotCycleFromSessionPayload(sessionRes.data);
                setPrimaryAction(deriveDashboardBallotPrimary(cycle));
            } catch {
                if (!cancelled) {
                    setPrimaryAction(
                        deriveDashboardBallotPrimary(null)
                    );
                }
            } finally {
                if (!cancelled) setBallotSessionLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [meLoading, mustChangePassword]);

    return { primaryAction, ballotSessionLoading };
}
