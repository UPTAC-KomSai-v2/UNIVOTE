/**
 * Mirrors backend Election.state for published elections using the client clock,
 * so scheduled → ongoing → ended updates without refetching.
 *
 * See backend/api/models.py Election.state.
 */
export function electionWithLivePublishedState(election, nowMs = Date.now()) {
    if (!election) return null;
    if (election.status !== "published") return election;
    const start = new Date(election.start_datetime).getTime();
    const end = new Date(election.end_datetime).getTime();
    let state = "ongoing";
    if (nowMs < start) state = "scheduled";
    else if (nowMs > end) state = "ended";
    if (state === election.state) return election;
    return { ...election, state };
}
