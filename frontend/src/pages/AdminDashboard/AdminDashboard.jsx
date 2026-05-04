import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout/DashboardLayout.jsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal.jsx";
import AdminHourlyActivityChart from "./AdminHourlyActivityChart.jsx";
import AdminVoteVelocityReport from "./AdminVoteVelocityReport.jsx";
import api from "../../api";
import upSeal from "../../assets/UP-Seal.png";
import auditorStyles from "../AuditorDashboard/AuditorDashboard.module.css";
import "../AuditorDashboard/auditor-scrollbar.css";
import styles from './AdminDashboard.module.css'
import { electionWithLivePublishedState } from "../../utils/electionLiveState";
import {
    ADMIN_DASHBOARD_ACTIVE_REPORT_KEY as ACTIVE_REPORT_KEY,
    ADMIN_DASHBOARD_ACTIVE_SECTION_KEY as ACTIVE_SECTION_KEY,
    ADMIN_ELECTION_CONFIG_KEY as ELECTION_CONFIG_KEY,
} from "../../utils/dashboardPreferences";

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR + i);

const POSITIONS = ["Chairperson", "Vice Chairperson", "Councilor"];

const INITIAL_CANDIDATE = {
    firstName: "",
    lastName: "",
    alias: "",
    studentNumber: "",
    party: "",
    description: "",
    position: "",
};

const REPORTS = [
    {
        id: "hourly",
        label: "VOTING ACTIVITY BY HOUR",
        title: "Voting Activity by Hour",
        description:
            "Ballots submitted in each hour of the day for any date in the voting period. Pick a date to see when turnout peaked.",
    },
    {
        id: "velocity",
        label: "VOTE VELOCITY",
        title: "Vote Velocity",
        description:
            "Sequential ballots: gap vs latency. Red highlights tight timing plus matching fingerprint, install ID, or IP vs the prior ballot (busy unrelated voters stay unflagged). Pair with Device Fingerprint.",
    },
];

function daysInMonth(monthIndex, year) {
    return new Date(year, monthIndex + 1, 0).getDate();
}

const VALID_SECTIONS = ["elections", "candidates", "reports", "roster"];
const VALID_REPORT_IDS = REPORTS.map((r) => r.id);

/** Transient inline banners: hide after delay (✕ still clears immediately). */
const CSV_FEEDBACK_AUTO_DISMISS_MS = { success: 10_000, error: 14_000 };
const ROSTER_FEEDBACK_AUTO_DISMISS_MS = 8_000;
const PURGE_DRAFTS_FEEDBACK_AUTO_DISMISS_MS = 8_000;

const pad2 = (n) => String(n).padStart(2, "0");

function extractApiError(err, fallback) {
    if (!err.response) return "Cannot reach the server. Please check your connection.";
    const data = err.response.data;
    if (typeof data === "string") return data;
    if (data?.detail) return data.detail;
    if (data && typeof data === "object") {
        const firstKey = Object.keys(data)[0];
        const firstVal = data[firstKey];
        const msg = Array.isArray(firstVal) ? firstVal[0] : firstVal;
        if (msg) return typeof msg === "string" ? msg : fallback;
    }
    return fallback;
}

function formatAdminElectionRange(isoStart, isoEnd) {
    try {
        const s = new Date(isoStart);
        const e = new Date(isoEnd);
        const opts = { month: "short", day: "numeric", year: "numeric" };
        return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
    } catch {
        return "";
    }
}

function adminElectionStatusLabel(e) {
    if (!e) return "";
    if (e.status === "draft") return "Draft — not published";
    if (e.status === "archived") return "Archived";
    if (e.state === "scheduled") return "Published · voting not started yet";
    if (e.state === "ongoing") return "Published · voting in progress";
    if (e.state === "ended") return "Published · voting period ended";
    return String(e.status ?? "");
}

function adminElectionStatusBadge(e) {
    if (!e) return { label: "", variant: "unknown" };
    if (e.status === "draft")
        return { label: "Draft — not published", variant: "draft" };
    if (e.status === "archived") return { label: "Archived", variant: "archived" };
    if (e.state === "scheduled")
        return { label: "Published · voting not started yet", variant: "scheduled" };
    if (e.state === "ongoing")
        return { label: "Published · voting in progress", variant: "ongoing" };
    if (e.state === "ended")
        return { label: "Published · voting period ended", variant: "ended" };
    return { label: String(e.status ?? "Unknown"), variant: "unknown" };
}

function formatTimezoneHint() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
        return "";
    }
}

const DEFAULT_ELECTION_CONFIG = {
    startMonth: 2,
    startDay: 1,
    startYear: CURRENT_YEAR,
    startTime: "08:00",
    endMonth: 2,
    endDay: 31,
    endYear: CURRENT_YEAR,
    endTime: "17:00",
};

function loadElectionConfig() {
    if (typeof window === "undefined") return DEFAULT_ELECTION_CONFIG;
    try {
        const raw = window.localStorage.getItem(ELECTION_CONFIG_KEY);
        if (!raw) return DEFAULT_ELECTION_CONFIG;
        return { ...DEFAULT_ELECTION_CONFIG, ...JSON.parse(raw) };
    } catch {
        return DEFAULT_ELECTION_CONFIG;
    }
}

function AdminDashboard() {
    const [activeSection, setActiveSection] = useState(() => {
        if (typeof window === "undefined") return "elections";
        const stored = window.localStorage.getItem(ACTIVE_SECTION_KEY);
        return VALID_SECTIONS.includes(stored) ? stored : "elections";
    });

    const [activeReport, setActiveReport] = useState(() => {
        if (typeof window === "undefined") return REPORTS[0].id;
        const stored = window.localStorage.getItem(ACTIVE_REPORT_KEY);
        const migrated = stored === "heatmap" ? "hourly" : stored;
        return VALID_REPORT_IDS.includes(migrated) ? migrated : REPORTS[0].id;
    });

    useEffect(() => {
        window.localStorage.setItem(ACTIVE_SECTION_KEY, activeSection);
    }, [activeSection]);

    useEffect(() => {
        window.localStorage.setItem(ACTIVE_REPORT_KEY, activeReport);
    }, [activeReport]);

    const [adminHeaderClock, setAdminHeaderClock] = useState(() => new Date());

    useEffect(() => {
        setAdminHeaderClock(new Date());
        const id = window.setInterval(() => setAdminHeaderClock(new Date()), 1000);
        return () => window.clearInterval(id);
    }, []);

    const currentReport =
        REPORTS.find((r) => r.id === activeReport) ?? REPORTS[0];

    const [initialConfig] = useState(loadElectionConfig);
    const [startMonth, setStartMonth] = useState(initialConfig.startMonth);
    const [startDay, setStartDay] = useState(initialConfig.startDay);
    const [startYear, setStartYear] = useState(initialConfig.startYear);
    const [startTime, setStartTime] = useState(initialConfig.startTime);

    const [endMonth, setEndMonth] = useState(initialConfig.endMonth);
    const [endDay, setEndDay] = useState(initialConfig.endDay);
    const [endYear, setEndYear] = useState(initialConfig.endYear);
    const [endTime, setEndTime] = useState(initialConfig.endTime);

    const [publishedElection, setPublishedElection] = useState(null);
    const [lastElectionId, setLastElectionId] = useState(null);
    const [electionLoading, setElectionLoading] = useState(true);
    const [electionSaving, setElectionSaving] = useState(false);
    const [electionApiError, setElectionApiError] = useState("");
    /** null | "unpublish" | "archive" — custom confirm modal (same UX as logout) */
    const [electionConfirmKind, setElectionConfirmKind] = useState(null);
    /** Election id targeted by unpublish/archive modal (may differ from primary when multiple published). */
    const [electionModalElectionId, setElectionModalElectionId] = useState(null);
    /** While voting is open: PATCH end_datetime without unpublishing (close voting early). */
    const [adjustEndActive, setAdjustEndActive] = useState(false);
    const [purgeDraftsModalOpen, setPurgeDraftsModalOpen] = useState(false);
    const [purgeDraftsResult, setPurgeDraftsResult] = useState(null);
    /** Published rows past end_datetime — surfaced when /active/ points at a newer ongoing election. */
    const [endedPublishedElections, setEndedPublishedElections] = useState([]);
    const electionPublished = publishedElection !== null;

    const [overviewStats, setOverviewStats] = useState(null);
    const [overviewLoading, setOverviewLoading] = useState(false);

    const localTzHint = useMemo(() => formatTimezoneHint(), []);

    const publishedElectionLive = useMemo(
        () =>
            electionWithLivePublishedState(
                publishedElection,
                adminHeaderClock.getTime()
            ),
        [publishedElection, adminHeaderClock]
    );

    const votingOngoing = publishedElectionLive?.state === "ongoing";

    const [candidateForm, setCandidateForm] = useState(INITIAL_CANDIDATE);
    const [candidates, setCandidates] = useState([]);
    const [candidatesLoading, setCandidatesLoading] = useState(false);
    const [candidateSaving, setCandidateSaving] = useState(false);
    const [candidateError, setCandidateError] = useState("");
    const [candidateSnLookupHint, setCandidateSnLookupHint] = useState("");
    const [candidateBusyId, setCandidateBusyId] = useState(null);
    const [candidateRemoveVoterId, setCandidateRemoveVoterId] = useState(null);
    const [candidatePositionTab, setCandidatePositionTab] = useState(POSITIONS[0]);

    const csvInputRef = useRef(null);
    const prevLiveEndedRef = useRef(false);
    const [csvUploading, setCsvUploading] = useState(false);
    const [csvResult, setCsvResult] = useState(null);

    const [rosterElections, setRosterElections] = useState([]);
    const [rosterElectionId, setRosterElectionId] = useState(null);
    const [rosterLoading, setRosterLoading] = useState(false);
    const [rosterBusy, setRosterBusy] = useState(false);
    const [rosterError, setRosterError] = useState("");
    const [rosterMessage, setRosterMessage] = useState("");
    const [rosterPayload, setRosterPayload] = useState(null);
    const [rosterSearchDraft, setRosterSearchDraft] = useState("");
    const [rosterQ, setRosterQ] = useState("");
    const [rosterOffset, setRosterOffset] = useState(0);
    const rosterLimit = 20;
    const [rosterEnrollmentFilter, setRosterEnrollmentFilter] = useState("all");
    const [rosterBallotFilter, setRosterBallotFilter] = useState("all");
    const [rosterRefreshTick, setRosterRefreshTick] = useState(0);
    const [rosterSelected, setRosterSelected] = useState(() => new Set());
    const [rosterClearModalOpen, setRosterClearModalOpen] = useState(false);

    const bumpRosterRefresh = () => setRosterRefreshTick((t) => t + 1);

    useEffect(() => {
        const config = {
            startMonth, startDay, startYear, startTime,
            endMonth, endDay, endYear, endTime,
        };
        window.localStorage.setItem(ELECTION_CONFIG_KEY, JSON.stringify(config));
    }, [startMonth, startDay, startYear, startTime, endMonth, endDay, endYear, endTime]);

    const hydrateFormFromElection = (election) => {
        const start = new Date(election.start_datetime);
        const end = new Date(election.end_datetime);
        setStartMonth(start.getMonth());
        setStartDay(start.getDate());
        setStartYear(start.getFullYear());
        setStartTime(`${pad2(start.getHours())}:${pad2(start.getMinutes())}`);
        setEndMonth(end.getMonth());
        setEndDay(end.getDate());
        setEndYear(end.getFullYear());
        setEndTime(`${pad2(end.getHours())}:${pad2(end.getMinutes())}`);
    };

    const refreshEndedPublishedElections = useCallback(() => {
        return api.get("/api/elections/").then((res) => {
            const list = Array.isArray(res.data) ? res.data : [];
            setEndedPublishedElections(
                list.filter(
                    (e) => e.status === "published" && e.state === "ended"
                )
            );
        });
    }, []);

    useEffect(() => {
        refreshEndedPublishedElections().catch(() => {
            setEndedPublishedElections([]);
        });
    }, [refreshEndedPublishedElections]);

    useEffect(() => {
        prevLiveEndedRef.current = false;
    }, [publishedElection?.id]);

    useEffect(() => {
        const ended = publishedElectionLive?.state === "ended";
        if (
            ended &&
            !prevLiveEndedRef.current &&
            publishedElection?.id != null
        ) {
            refreshEndedPublishedElections().catch(() => {});
        }
        prevLiveEndedRef.current = ended;
    }, [
        publishedElectionLive?.state,
        publishedElection?.id,
        refreshEndedPublishedElections,
    ]);

    useEffect(() => {
        let cancelled = false;
        api
            .get("/api/elections/active/")
            .then((res) => {
                if (cancelled) return;
                if (res.status === 200 && res.data && res.data.id) {
                    setPublishedElection(res.data);
                    setLastElectionId(res.data.id);
                    hydrateFormFromElection(res.data);
                }
            })
            .catch((err) => {
                if (cancelled) return;
                setElectionApiError(
                    extractApiError(err, "Could not load election status.")
                );
            })
            .finally(() => {
                if (!cancelled) setElectionLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!publishedElection?.id) {
            setOverviewStats(null);
            return undefined;
        }
        if (activeSection !== "elections") {
            return undefined;
        }
        let cancelled = false;
        const load = async () => {
            setOverviewLoading(true);
            try {
                const res = await api.get(
                    `/api/admin/election-overview/${publishedElection.id}/`
                );
                if (!cancelled) setOverviewStats(res.data);
            } catch {
                if (!cancelled) setOverviewStats(null);
            } finally {
                if (!cancelled) setOverviewLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [publishedElection?.id, activeSection]);

    useEffect(() => {
        if (activeSection !== "roster") return undefined;
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get("/api/elections/");
                const list = Array.isArray(res.data)
                    ? res.data.filter((e) => e.status !== "archived")
                    : [];
                list.sort((a, b) => {
                    if (a.status === "published" && b.status !== "published") return -1;
                    if (b.status === "published" && a.status !== "published") return 1;
                    return b.id - a.id;
                });
                if (cancelled) return;
                setRosterElections(list);
                setRosterElectionId((prev) => {
                    if (prev != null && list.some((e) => e.id === prev)) return prev;
                    const pub = list.find((e) => e.status === "published");
                    return pub?.id ?? list[0]?.id ?? null;
                });
            } catch (err) {
                if (!cancelled) {
                    console.error(err);
                    setRosterElections([]);
                    setRosterElectionId(null);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeSection]);

    useEffect(() => {
        if (activeSection !== "roster" || rosterElectionId == null) {
            if (activeSection !== "roster") setRosterPayload(null);
            return undefined;
        }
        let cancelled = false;
        setRosterLoading(true);
        setRosterError("");
        (async () => {
            try {
                const res = await api.get(
                    `/api/admin/election-voter-roster/${rosterElectionId}/`,
                    {
                        params: {
                            q: rosterQ || undefined,
                            limit: rosterLimit,
                            offset: rosterOffset,
                            enrollment:
                                rosterEnrollmentFilter !== "all"
                                    ? rosterEnrollmentFilter
                                    : undefined,
                            ballot:
                                rosterBallotFilter !== "all"
                                    ? rosterBallotFilter
                                    : undefined,
                        },
                    }
                );
                if (!cancelled) {
                    setRosterPayload(res.data);
                    setRosterSelected(new Set());
                }
            } catch (err) {
                if (!cancelled) {
                    setRosterPayload(null);
                    setRosterError(
                        extractApiError(err, "Could not load voter roster.")
                    );
                }
            } finally {
                if (!cancelled) setRosterLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [
        activeSection,
        rosterElectionId,
        rosterQ,
        rosterOffset,
        rosterLimit,
        rosterEnrollmentFilter,
        rosterBallotFilter,
        rosterRefreshTick,
    ]);

    useEffect(() => {
        setAdjustEndActive(false);
    }, [publishedElection?.id, publishedElectionLive?.state]);

    useEffect(() => {
        document.body.classList.add("dashboard-bg");
        document.body.classList.remove("login-bg");
        return () => document.body.classList.remove("dashboard-bg");
    }, []);

    useEffect(() => {
        if (!csvResult) return undefined;
        const ms =
            csvResult.type === "error"
                ? CSV_FEEDBACK_AUTO_DISMISS_MS.error
                : CSV_FEEDBACK_AUTO_DISMISS_MS.success;
        const id = window.setTimeout(() => setCsvResult(null), ms);
        return () => window.clearTimeout(id);
    }, [csvResult]);

    useEffect(() => {
        if (!rosterMessage) return undefined;
        const id = window.setTimeout(
            () => setRosterMessage(""),
            ROSTER_FEEDBACK_AUTO_DISMISS_MS
        );
        return () => window.clearTimeout(id);
    }, [rosterMessage]);

    useEffect(() => {
        if (purgeDraftsResult == null) return undefined;
        const id = window.setTimeout(
            () => setPurgeDraftsResult(null),
            PURGE_DRAFTS_FEEDBACK_AUTO_DISMISS_MS
        );
        return () => window.clearTimeout(id);
    }, [purgeDraftsResult]);

    const startDays = Array.from(
        { length: daysInMonth(startMonth, startYear) },
        (_, i) => i + 1
    );
    const endDays = Array.from(
        { length: daysInMonth(endMonth, endYear) },
        (_, i) => i + 1
    );

    useEffect(() => {
        const max = daysInMonth(startMonth, startYear);
        if (startDay > max) setStartDay(max);
    }, [startMonth, startYear, startDay]);

    useEffect(() => {
        const max = daysInMonth(endMonth, endYear);
        if (endDay > max) setEndDay(max);
    }, [endMonth, endYear, endDay]);

    const formatTime = (value) => {
        const [hStr, mStr] = value.split(":");
        const h = Number(hStr);
        const m = Number(mStr);
        const period = h >= 12 ? "PM" : "AM";
        const hour12 = ((h + 11) % 12) + 1;
        return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
    };

    const buildDateTime = (year, month, day, time) => {
        const [hStr, mStr] = (time || "00:00").split(":");
        return new Date(year, month, day, Number(hStr), Number(mStr));
    };

    const startDateTime = buildDateTime(startYear, startMonth, startDay, startTime);
    const endDateTime = buildDateTime(endYear, endMonth, endDay, endTime);

    const validationError = (() => {
        if (electionPublished) return null;
        const nowMinute = Math.floor(Date.now() / 60000) * 60000;
        if (startDateTime.getTime() < nowMinute) {
            return "Start date and time cannot be in the past.";
        }
        if (endDateTime.getTime() <= startDateTime.getTime()) {
            return "End must be after Start.";
        }
        const minDurationMs = 5 * 60 * 1000;
        if (endDateTime.getTime() - startDateTime.getTime() < minDurationMs) {
            return "Voting period must be at least 5 minutes long.";
        }
        return null;
    })();

    const updateCandidateField = (field) => (e) => {
        setCandidateForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        if (activeSection !== "candidates") {
            setCandidateSnLookupHint("");
        }
    }, [activeSection]);

    useEffect(() => {
        if (activeSection !== "candidates" || !electionPublished) {
            return;
        }
        const sn = candidateForm.studentNumber.trim();
        if (!sn) {
            setCandidateSnLookupHint("");
            return;
        }

        const ac = new AbortController();
        const timer = window.setTimeout(async () => {
            try {
                const res = await api.get("/api/admin/voters/by-student-number/", {
                    params: { student_number: sn },
                    signal: ac.signal,
                });
                setCandidateForm((prev) => ({
                    ...prev,
                    firstName: res.data.first_name ?? "",
                    lastName: res.data.last_name ?? "",
                }));
                setCandidateSnLookupHint("");
            } catch (err) {
                if (err.code === "ERR_CANCELED" || err.name === "CanceledError") {
                    return;
                }
                if (err.response?.status === 404) {
                    setCandidateSnLookupHint(
                        "No voter with this student number — import them via Upload voter's CSV first."
                    );
                } else {
                    setCandidateSnLookupHint("");
                }
            }
        }, 450);

        return () => {
            window.clearTimeout(timer);
            ac.abort();
        };
    }, [
        candidateForm.studentNumber,
        activeSection,
        electionPublished,
    ]);

    const fetchCandidates = async () => {
        setCandidatesLoading(true);
        try {
            const res = await api.get("/api/candidates/");
            setCandidates(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Fetch candidates error:", err);
            setCandidates([]);
        } finally {
            setCandidatesLoading(false);
        }
    };

    const filteredCandidates = useMemo(
        () => candidates.filter((c) => c.position === candidatePositionTab),
        [candidates, candidatePositionTab]
    );

    useEffect(() => {
        if (activeSection !== "candidates") return;
        if (!electionPublished) {
            setCandidates([]);
            return;
        }
        fetchCandidates();
    }, [activeSection, electionPublished, publishedElection?.id]);

    const handleAddCandidate = async () => {
        if (candidateSaving) return;

        if (!electionPublished) {
            setCandidateError("Publish an election first before adding candidates.");
            return;
        }

        if (votingOngoing) {
            setCandidateError("Cannot add candidates while voting is in progress.");
            return;
        }

        const payload = {
            first_name: candidateForm.firstName.trim(),
            last_name: candidateForm.lastName.trim(),
            student_number: candidateForm.studentNumber.trim(),
            alias: candidateForm.alias.trim(),
            party: candidateForm.party.trim(),
            description: candidateForm.description.trim(),
            position: candidateForm.position,
        };

        if (!payload.first_name || !payload.last_name) {
            setCandidateError("First name and last name are required.");
            return;
        }
        if (!payload.student_number) {
            setCandidateError("Student number is required.");
            return;
        }
        if (!payload.position) {
            setCandidateError("Please select a position.");
            return;
        }

        setCandidateSaving(true);
        setCandidateError("");

        try {
            const res = await api.post("/api/candidates/", payload);
            setCandidates((prev) => [...prev, res.data]);
            setCandidateForm(INITIAL_CANDIDATE);
            if (res.data?.position && POSITIONS.includes(res.data.position)) {
                setCandidatePositionTab(res.data.position);
            }
        } catch (err) {
            console.error("Add candidate error:", err);
            setCandidateError(
                extractApiError(err, "Could not add candidate. Please try again.")
            );
        } finally {
            setCandidateSaving(false);
        }
    };

    const handleRemoveCandidateClick = (voterId) => {
        if (candidateBusyId !== null || publishedElectionLive?.state === "ongoing")
            return;
        setCandidateRemoveVoterId(voterId);
    };

    const handleCandidateRemoveConfirm = async () => {
        const voterId = candidateRemoveVoterId;
        setCandidateRemoveVoterId(null);
        if (voterId == null || candidateBusyId !== null) return;

        setCandidateBusyId(voterId);
        setCandidateError("");

        try {
            await api.delete(`/api/candidates/${voterId}/`);
            setCandidates((prev) => prev.filter((c) => c.voter_id !== voterId));
        } catch (err) {
            console.error("Remove candidate error:", err);
            setCandidateError(
                extractApiError(err, "Could not remove candidate. Please try again.")
            );
        } finally {
            setCandidateBusyId(null);
        }
    };

    const handleCsvFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        e.target.value = "";

        setCsvUploading(true);
        setCsvResult(null);

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await api.post("/api/voters/upload-csv/", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setCsvResult({ type: "success", ...res.data });
            if (activeSection === "roster") bumpRosterRefresh();
        } catch (err) {
            const msg = extractApiError(err, "Upload failed. Please try again.");
            setCsvResult({ type: "error", message: msg });
        } finally {
            setCsvUploading(false);
        }
    };

    const handleRosterApplySearch = () => {
        setRosterQ(rosterSearchDraft.trim());
        setRosterOffset(0);
    };

    const handleRosterElectionChange = (e) => {
        const raw = e.target.value;
        if (raw === "") {
            setRosterElectionId(null);
            setRosterOffset(0);
            setRosterEnrollmentFilter("all");
            setRosterBallotFilter("all");
            setRosterMessage("");
            return;
        }
        const id = Number(raw);
        setRosterElectionId(Number.isFinite(id) ? id : null);
        setRosterOffset(0);
        setRosterEnrollmentFilter("all");
        setRosterBallotFilter("all");
        setRosterMessage("");
    };

    const toggleRosterRow = (row) => {
        setRosterSelected((prev) => {
            const next = new Set(prev);
            if (next.has(row.voter_id)) next.delete(row.voter_id);
            else next.add(row.voter_id);
            return next;
        });
    };

    const rosterTogglePageSelection = () => {
        const rows = rosterPayload?.results ?? [];
        const idsOnPage = rows.map((r) => r.voter_id);
        const allSel =
            idsOnPage.length > 0 && idsOnPage.every((id) => rosterSelected.has(id));
        setRosterSelected((prev) => {
            const next = new Set(prev);
            if (allSel) idsOnPage.forEach((id) => next.delete(id));
            else idsOnPage.forEach((id) => next.add(id));
            return next;
        });
    };

    const handleRosterBulkEnroll = async () => {
        const ids = rosterPayload?.results?.filter((r) => rosterSelected.has(r.voter_id) && !r.enrolled).map((r) => r.voter_id) ?? [];
        if (!ids.length || rosterElectionId == null || rosterBusy) return;
        setRosterBusy(true);
        setRosterMessage("");
        try {
            const res = await api.post(
                `/api/admin/election-voter-roster/${rosterElectionId}/enroll/`,
                { voter_ids: ids }
            );
            const { created, already_enrolled: already } = res.data;
            setRosterMessage(
                `Enrolled: ${created} new${already ? `, ${already} already on roster` : ""}.`
            );
            bumpRosterRefresh();
        } catch (err) {
            setRosterMessage(extractApiError(err, "Could not enroll voters."));
        } finally {
            setRosterBusy(false);
        }
    };

    const handleRosterBulkUnenroll = async () => {
        const ids = rosterPayload?.results?.filter(
            (r) => rosterSelected.has(r.voter_id) && r.enrolled && !r.has_ballot
        ).map((r) => r.voter_id) ?? [];
        if (!ids.length || rosterElectionId == null || rosterBusy) return;
        setRosterBusy(true);
        setRosterMessage("");
        try {
            const res = await api.post(
                `/api/admin/election-voter-roster/${rosterElectionId}/unenroll/`,
                { voter_ids: ids }
            );
            const { removed, blocked_has_ballot: blocked } = res.data;
            let msg = `Removed from roster: ${removed}.`;
            if (blocked?.length)
                msg += ` ${blocked.length} skipped (already voted).`;
            setRosterMessage(msg);
            bumpRosterRefresh();
        } catch (err) {
            setRosterMessage(extractApiError(err, "Could not update roster."));
        } finally {
            setRosterBusy(false);
        }
    };

    const handleRosterClearConfirm = async () => {
        if (rosterElectionId == null || rosterBusy) return;
        setRosterBusy(true);
        setRosterMessage("");
        try {
            const res = await api.post(
                `/api/admin/election-voter-roster/${rosterElectionId}/clear/`
            );
            const removed = res.data?.removed_enrollments ?? 0;
            const remaining = res.data?.remaining_enrollments ?? 0;
            setRosterClearModalOpen(false);
            let msg = `Roster cleared: removed ${removed} enrollment${removed === 1 ? "" : "s"}.`;
            if (remaining > 0)
                msg += ` ${remaining} enrollment${remaining === 1 ? "" : "s"} kept for candidates.`;
            setRosterMessage(msg);
            bumpRosterRefresh();
        } catch (err) {
            setRosterClearModalOpen(false);
            setRosterMessage(extractApiError(err, "Could not clear roster."));
        } finally {
            setRosterBusy(false);
        }
    };

    const handleRosterRowEnroll = async (voterId) => {
        if (rosterElectionId == null || rosterBusy) return;
        setRosterBusy(true);
        setRosterMessage("");
        try {
            await api.post(
                `/api/admin/election-voter-roster/${rosterElectionId}/enroll/`,
                { voter_ids: [voterId] }
            );
            setRosterMessage("Voter enrolled.");
            bumpRosterRefresh();
        } catch (err) {
            setRosterMessage(extractApiError(err, "Could not enroll."));
        } finally {
            setRosterBusy(false);
        }
    };

    const handleRosterRowUnenroll = async (voterId) => {
        if (rosterElectionId == null || rosterBusy) return;
        setRosterBusy(true);
        setRosterMessage("");
        try {
            const res = await api.post(
                `/api/admin/election-voter-roster/${rosterElectionId}/unenroll/`,
                { voter_ids: [voterId] }
            );
            const { blocked_has_ballot: blocked } = res.data;
            if (blocked?.includes(voterId))
                setRosterMessage("Cannot remove: this voter already submitted a ballot.");
            else setRosterMessage("Removed from roster.");
            bumpRosterRefresh();
        } catch (err) {
            setRosterMessage(extractApiError(err, "Could not unenroll."));
        } finally {
            setRosterBusy(false);
        }
    };

    const sidebar = (
        <>
            <button
                className={activeSection === "elections" ? "active" : ""}
                onClick={() => setActiveSection("elections")}
            >
                MANAGE ELECTIONS
            </button>
            <button
                className={activeSection === "candidates" ? "active" : ""}
                onClick={() => setActiveSection("candidates")}
            >
                MANAGE CANDIDATES
            </button>
            <button
                className={activeSection === "roster" ? "active" : ""}
                onClick={() => setActiveSection("roster")}
            >
                VOTER ROSTER
            </button>
            <button
                className={activeSection === "reports" ? "active" : ""}
                onClick={() => setActiveSection("reports")}
            >
                VIEW REPORTS
            </button>
            <button
                className="uploadCsv"
                type="button"
                disabled={csvUploading}
                onClick={() => csvInputRef.current?.click()}
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {csvUploading ? "UPLOADING..." : "UPLOAD VOTER'S CSV"}
            </button>
            <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={handleCsvFileChange}
            />
        </>
    );

    const headerTitle = electionPublished
        ? `${startYear} Student Council Elections`
        : "Election Management";

    const handlePublish = async () => {
        if (validationError || electionSaving) return;
        setElectionSaving(true);
        setElectionApiError("");

        const payload = {
            name: `${startYear} Student Council Elections`,
            start_datetime: startDateTime.toISOString(),
            end_datetime: endDateTime.toISOString(),
        };

        try {
            let electionId = lastElectionId;
            if (electionId) {
                await api.patch(`/api/elections/${electionId}/`, payload);
            } else {
                const created = await api.post("/api/elections/", payload);
                electionId = created.data.id;
                setLastElectionId(electionId);
            }
            const published = await api.post(`/api/elections/${electionId}/publish/`);
            setPublishedElection(published.data);
            await refreshEndedPublishedElections();
        } catch (err) {
            console.error("Publish error:", err);
            setElectionApiError(
                extractApiError(err, "Could not publish the election. Please try again.")
            );
        } finally {
            setElectionSaving(false);
        }
    };

    const handleEditElection = () => {
        if (!publishedElection || electionSaving) return;
        if (publishedElectionLive?.state === "ongoing") return;
        setElectionModalElectionId(publishedElection.id);
        setElectionConfirmKind("unpublish");
    };

    const handleCancelAdjustEnd = () => {
        if (!publishedElection || electionSaving) return;
        hydrateFormFromElection(publishedElection);
        setAdjustEndActive(false);
        setElectionApiError("");
    };

    const handleSaveAdjustedEnd = async () => {
        if (!publishedElection || electionSaving) return;
        const start = new Date(publishedElection.start_datetime);
        const newEnd = buildDateTime(endYear, endMonth, endDay, endTime);
        if (newEnd.getTime() <= start.getTime()) {
            setElectionApiError("End must be after start.");
            return;
        }
        if (newEnd.getTime() - start.getTime() < 5 * 60 * 1000) {
            setElectionApiError("Voting period must be at least 5 minutes long.");
            return;
        }
        setElectionSaving(true);
        setElectionApiError("");
        try {
            const res = await api.patch(`/api/elections/${publishedElection.id}/`, {
                end_datetime: newEnd.toISOString(),
            });
            setPublishedElection(res.data);
            hydrateFormFromElection(res.data);
            setAdjustEndActive(false);
            await refreshEndedPublishedElections();
        } catch (err) {
            console.error("Adjust end error:", err);
            setElectionApiError(
                extractApiError(err, "Could not update voting end time. Please try again.")
            );
        } finally {
            setElectionSaving(false);
        }
    };

    const handleArchiveElection = () => {
        if (!publishedElection || electionSaving) return;
        setElectionModalElectionId(publishedElection.id);
        setElectionConfirmKind("archive");
    };

    const handleArchiveEndedElectionInList = (electionRow) => {
        if (electionSaving || !electionRow?.id) return;
        setElectionModalElectionId(electionRow.id);
        setElectionConfirmKind("archive");
    };

    const handleElectionConfirmYes = async () => {
        const kind = electionConfirmKind;
        const electionId = electionModalElectionId;
        setElectionConfirmKind(null);
        setElectionModalElectionId(null);
        if (!kind || electionId == null || electionSaving) return;

        setElectionSaving(true);
        setElectionApiError("");

        try {
            if (kind === "unpublish") {
                await api.post(`/api/elections/${electionId}/unpublish/`);
                setPublishedElection(null);
                setLastElectionId(electionId);
                await refreshEndedPublishedElections();
            } else if (kind === "archive") {
                await api.post(`/api/elections/${electionId}/archive/`);
                await refreshEndedPublishedElections();
                try {
                    const activeRes = await api.get("/api/elections/active/");
                    if (activeRes.status === 200 && activeRes.data?.id) {
                        setPublishedElection(activeRes.data);
                        setLastElectionId(activeRes.data.id);
                        hydrateFormFromElection(activeRes.data);
                    } else {
                        setPublishedElection(null);
                        setLastElectionId(null);
                    }
                } catch {
                    setPublishedElection(null);
                    setLastElectionId(null);
                }
            }
        } catch (err) {
            if (kind === "unpublish") {
                console.error("Unpublish error:", err);
                setElectionApiError(
                    extractApiError(err, "Could not unpublish the election. Please try again.")
                );
            } else {
                console.error("Archive error:", err);
                setElectionApiError(
                    extractApiError(err, "Could not archive the election. Please try again.")
                );
            }
        } finally {
            setElectionSaving(false);
        }
    };

    const handlePurgeDraftsConfirm = async () => {
        if (electionSaving) return;
        setElectionSaving(true);
        setElectionApiError("");
        try {
            const res = await api.post("/api/elections/purge_drafts/");
            const ids = Array.isArray(res.data?.deleted_ids) ? res.data.deleted_ids : [];
            const deletedCount =
                typeof res.data?.deleted_count === "number"
                    ? res.data.deleted_count
                    : ids.length;
            if (lastElectionId != null && ids.includes(lastElectionId)) {
                setLastElectionId(null);
            }
            setPurgeDraftsModalOpen(false);
            setPurgeDraftsResult({ deleted_count: deletedCount });
        } catch (err) {
            console.error("Purge drafts error:", err);
            setElectionApiError(
                extractApiError(err, "Could not delete draft elections.")
            );
            setPurgeDraftsModalOpen(false);
        } finally {
            setElectionSaving(false);
        }
    };

    const electionConfirmMessage =
        electionConfirmKind === "unpublish"
            ? "Unpublish this election to edit start/end dates? You will need to publish again before voters can vote. (While voting is in progress, unpublish is blocked — use Adjust voting end instead.)"
            : electionConfirmKind === "archive"
              ? "Archive this finished election? It will be moved to your election history and the form will unlock so you can create a new one."
              : "";

    const electionEnded = publishedElectionLive?.state === "ended";

    const reportsTimestamp = useMemo(() => {
        const d = new Date();
        return {
            iso: d.toISOString(),
            display: d.toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
            }),
        };
    }, [activeReport, activeSection]);

    const adminReportsStatusBadge = useMemo(
        () => adminElectionStatusBadge(publishedElectionLive),
        [publishedElectionLive]
    );

    const showAuditorReportsChrome =
        activeSection === "reports" && electionPublished;

    return (
        <DashboardLayout sidebar={sidebar}>
            <ConfirmModal
                open={electionConfirmKind !== null}
                message={electionConfirmMessage}
                onConfirm={handleElectionConfirmYes}
                onCancel={() => {
                    setElectionConfirmKind(null);
                    setElectionModalElectionId(null);
                }}
            />
            <ConfirmModal
                open={candidateRemoveVoterId !== null}
                message="Remove this candidate from the election?"
                onConfirm={handleCandidateRemoveConfirm}
                onCancel={() => setCandidateRemoveVoterId(null)}
            />
            <ConfirmModal
                open={purgeDraftsModalOpen}
                message="Permanently delete every draft election that has no submitted ballots? Published and archived elections are not affected. Use this to remove stray duplicate drafts."
                confirmLabel="DELETE DRAFTS"
                cancelLabel="CANCEL"
                loading={electionSaving}
                onConfirm={handlePurgeDraftsConfirm}
                onCancel={() => {
                    if (!electionSaving) setPurgeDraftsModalOpen(false);
                }}
            />
            <ConfirmModal
                open={rosterClearModalOpen}
                message="Remove every voter from this election roster except registered candidates? This is only allowed before anyone has submitted a ballot for this election. You can enroll voters again afterward from search or CSV import."
                confirmLabel="CLEAR ROSTER"
                cancelLabel="CANCEL"
                loading={rosterBusy}
                onConfirm={handleRosterClearConfirm}
                onCancel={() => {
                    if (!rosterBusy) setRosterClearModalOpen(false);
                }}
            />
            {!showAuditorReportsChrome ? (
            <div className={styles.header}>
                <h1>{headerTitle}</h1>
                {activeSection === "elections" && (
                    <h2>
                        {electionPublished
                            ? "Voting Period"
                            : "Set the voting period to publish a new election."}
                    </h2>
                )}
                {activeSection === "candidates" && <h2>Manage Candidates</h2>}
                {activeSection === "roster" && <h2>Voter roster</h2>}
                {activeSection === "reports" && <h2>Reports</h2>}
                <p className={styles.adminHeaderClock} aria-live="polite">
                    <time dateTime={adminHeaderClock.toISOString()}>
                        {adminHeaderClock.toLocaleString(undefined, {
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
                        <span className={styles.adminHeaderClockTz}>
                            {" "}
                            · {localTzHint}
                        </span>
                    ) : null}
                </p>
            </div>
            ) : null}

            {activeSection === "elections" && (
                <>
                    {endedPublishedElections.some(
                        (e) => !publishedElection || e.id !== publishedElection.id
                    ) ? (
                        <div
                            className={styles.endedElectionsBanner}
                            role="region"
                            aria-label="Ended elections pending archive"
                        >
                            <p className={styles.endedElectionsBannerTitle}>
                                Voting has ended for these published elections — archive each when
                                you no longer need it in the active cycle:
                            </p>
                            <ul className={styles.endedElectionsBannerList}>
                                {endedPublishedElections
                                    .filter(
                                        (e) =>
                                            !publishedElection ||
                                            e.id !== publishedElection.id
                                    )
                                    .map((e) => (
                                        <li
                                            key={e.id}
                                            className={styles.endedElectionsBannerRow}
                                        >
                                            <span>
                                                <strong>{e.name}</strong> — ID #{e.id}
                                            </span>
                                            <button
                                                type="button"
                                                className={styles.editButton}
                                                disabled={electionSaving}
                                                onClick={() =>
                                                    handleArchiveEndedElectionInList(e)
                                                }
                                            >
                                                Archive Election
                                            </button>
                                        </li>
                                    ))}
                            </ul>
                        </div>
                    ) : null}
                    <div className={styles.dateRange}>
                        <div className={styles.dateRow}>
                            <span className={styles.dateLabel}>Start:</span>
                            <select
                                className={styles.dateSelect}
                                value={startMonth}
                                onChange={(e) => setStartMonth(Number(e.target.value))}
                                disabled={electionPublished}
                            >
                                {MONTHS.map((m, i) => (
                                    <option key={m} value={i}>{m}</option>
                                ))}
                            </select>
                            <select
                                className={styles.dateSelect}
                                value={startDay}
                                onChange={(e) => setStartDay(Number(e.target.value))}
                                disabled={electionPublished}
                            >
                                {startDays.map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                            <select
                                className={styles.dateSelect}
                                value={startYear}
                                onChange={(e) => setStartYear(Number(e.target.value))}
                                disabled={electionPublished}
                            >
                                {YEARS.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            <input
                                type="time"
                                className={styles.timeInput}
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                disabled={electionPublished}
                            />
                        </div>

                        <div className={styles.dateRow}>
                            <span className={styles.dateLabel}>End:</span>
                            <select
                                className={styles.dateSelect}
                                value={endMonth}
                                onChange={(e) => setEndMonth(Number(e.target.value))}
                                disabled={electionPublished && !adjustEndActive}
                            >
                                {MONTHS.map((m, i) => (
                                    <option key={m} value={i}>{m}</option>
                                ))}
                            </select>
                            <select
                                className={styles.dateSelect}
                                value={endDay}
                                onChange={(e) => setEndDay(Number(e.target.value))}
                                disabled={electionPublished && !adjustEndActive}
                            >
                                {endDays.map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                            <select
                                className={styles.dateSelect}
                                value={endYear}
                                onChange={(e) => setEndYear(Number(e.target.value))}
                                disabled={electionPublished && !adjustEndActive}
                            >
                                {YEARS.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            <input
                                type="time"
                                className={styles.timeInput}
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                disabled={electionPublished && !adjustEndActive}
                            />
                        </div>
                    </div>

                    {electionApiError && (
                        <p className={styles.validationError} role="alert">
                            {electionApiError}
                        </p>
                    )}

                    {electionLoading ? (
                        <p className={styles.loadingText}>Loading election status...</p>
                    ) : electionPublished ? (
                        electionEnded ? (
                            <div className={styles.publishedRow}>
                                <span className={`${styles.publishedBadge} ${styles.endedBadge}`}>
                                    <span
                                        className={`${styles.publishedDot} ${styles.endedDot}`}
                                        aria-hidden="true"
                                    />
                                    Voting Ended
                                </span>
                                <button
                                    type="button"
                                    className={styles.editButton}
                                    onClick={handleArchiveElection}
                                    disabled={electionSaving}
                                >
                                    {electionSaving ? "Archiving..." : "Archive Election"}
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className={styles.publishedRow}>
                                    <span className={styles.publishedBadge}>
                                        <span className={styles.publishedDot} aria-hidden="true" />
                                        Election Published
                                    </span>
                                    <div className={styles.publishedActions}>
                                        {publishedElectionLive?.state === "ongoing" ? (
                                            adjustEndActive ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className={styles.editButton}
                                                        onClick={handleSaveAdjustedEnd}
                                                        disabled={electionSaving}
                                                    >
                                                        {electionSaving ? "Saving..." : "Save new end time"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.cancelAdjustButton}
                                                        onClick={handleCancelAdjustEnd}
                                                        disabled={electionSaving}
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={styles.editButton}
                                                    onClick={() => {
                                                        setElectionApiError("");
                                                        setAdjustEndActive(true);
                                                    }}
                                                    disabled={electionSaving}
                                                >
                                                    Adjust voting end
                                                </button>
                                            )
                                        ) : (
                                            <button
                                                type="button"
                                                className={styles.editButton}
                                                onClick={handleEditElection}
                                                disabled={electionSaving}
                                            >
                                                Edit dates
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {publishedElectionLive?.state === "ongoing" ? (
                                    <p className={styles.electionPeriodHint}>
                                        {adjustEndActive
                                            ? "New end must be at least 5 minutes after the election start. After saving, voting closes once the current time is past that end."
                                            : "Unpublish is disabled while voting is open. To end voting early, click Adjust voting end and set an earlier end date/time."}
                                    </p>
                                ) : null}
                            </>
                        )
                    ) : (
                        <>
                            {validationError && (
                                <p className={styles.validationError} role="alert">
                                    {validationError}
                                </p>
                            )}
                            <button
                                className={styles.publishButton}
                                onClick={handlePublish}
                                disabled={Boolean(validationError) || electionSaving}
                            >
                                {electionSaving ? "Publishing..." : "Publish Date"}
                            </button>
                        </>
                    )}

                    <div className={styles.draftMaintenanceRow}>
                        <button
                            type="button"
                            className={styles.purgeDraftsLink}
                            onClick={() => {
                                setPurgeDraftsResult(null);
                                setPurgeDraftsModalOpen(true);
                            }}
                            disabled={electionSaving}
                        >
                            Delete all draft elections (no ballots)
                        </button>
                        {purgeDraftsResult != null ? (
                            <p className={styles.draftMaintenanceFeedback} role="status">
                                Removed {purgeDraftsResult.deleted_count} draft election(s).
                            </p>
                        ) : null}
                    </div>

                    <h2 className={styles.sectionTitle}>Election Overview</h2>
                    <div className={styles.contentBox}>
                        {electionPublished ? (
                            <div className={styles.electionOverview}>
                                <p className={styles.electionOverviewLead}>
                                    <strong>{publishedElection.name}</strong>
                                    {" "}
                                    — Election ID <strong>#{publishedElection.id}</strong>
                                </p>
                                <p className={styles.electionOverviewLead}>
                                    <strong>Status:</strong>{" "}
                                    {adminElectionStatusLabel(publishedElectionLive)}
                                </p>
                                {electionEnded ? (
                                    <p className={styles.electionOverviewLead}>
                                        Voting concluded on{" "}
                                        <strong>
                                            {MONTHS[endMonth]} {endDay}, {endYear}{" "}
                                            at {formatTime(endTime)}
                                        </strong>
                                        . Archive this election when you are ready to start a
                                        new cycle.
                                    </p>
                                ) : (
                                    <p className={styles.electionOverviewLead}>
                                        Voting will run from{" "}
                                        <strong>
                                            {MONTHS[startMonth]} {startDay}, {startYear}{" "}
                                            at {formatTime(startTime)}
                                        </strong>{" "}
                                        to{" "}
                                        <strong>
                                            {MONTHS[endMonth]} {endDay}, {endYear}{" "}
                                            at {formatTime(endTime)}
                                        </strong>
                                        .
                                    </p>
                                )}
                                <p className={styles.electionOverviewMuted}>
                                    Dates and times above follow this browser&apos;s timezone
                                    {localTzHint ? ` (${localTzHint})` : ""}.
                                    {overviewStats?.report_timezone ? (
                                        <>
                                            {" "}
                                            Hourly report buckets use{" "}
                                            <strong>{overviewStats.report_timezone}</strong>.
                                        </>
                                    ) : null}
                                </p>
                                <hr className={styles.electionOverviewDivider} />
                                {overviewLoading ? (
                                    <p className={styles.electionOverviewMuted}>
                                        Loading participation snapshot...
                                    </p>
                                ) : overviewStats ? (
                                    <>
                                        <dl className={styles.electionOverviewGrid}>
                                            <dt>Eligible voters</dt>
                                            <dd>{overviewStats.eligible_voters}</dd>
                                            <dt>Ballots cast</dt>
                                            <dd>{overviewStats.ballots_cast}</dd>
                                            <dt>Turnout</dt>
                                            <dd>
                                                {overviewStats.turnout_pct != null
                                                    ? `${overviewStats.turnout_pct}%`
                                                    : overviewStats.eligible_voters === 0
                                                      ? "— (no roster)"
                                                      : "—"}
                                            </dd>
                                            <dt>Candidates filed</dt>
                                            <dd>{overviewStats.candidates_total}</dd>
                                        </dl>
                                        <p className={styles.electionOverviewSubhead}>
                                            By position
                                        </p>
                                        <ul className={styles.electionOverviewPositions}>
                                            {POSITIONS.map((p) => (
                                                <li key={p}>
                                                    {p}:{" "}
                                                    {overviewStats.candidates_by_position?.[p] ?? 0}
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                ) : (
                                    <p className={styles.electionOverviewMuted}>
                                        Could not load participation snapshot.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <>
                                <p className={styles.emptyText}>
                                    No election is currently published. Choose a start and end
                                    date above and click <strong>Publish Date</strong> to create
                                    one. Preview:{" "}
                                    <strong>
                                        {MONTHS[startMonth]} {startDay}, {startYear} at{" "}
                                        {formatTime(startTime)}
                                    </strong>{" "}
                                    &rarr;{" "}
                                    <strong>
                                        {MONTHS[endMonth]} {endDay}, {endYear} at{" "}
                                        {formatTime(endTime)}
                                    </strong>
                                    .
                                </p>
                                <p className={styles.electionOverviewMuted}>
                                    Preview times use this browser&apos;s timezone
                                    {localTzHint ? ` (${localTzHint})` : ""}.
                                </p>
                            </>
                        )}
                    </div>
                </>
            )}

            {activeSection === "roster" && (
                <>
                    <div className={styles.rosterToolbar}>
                        <label className={styles.rosterLabel}>
                            Election
                            <select
                                className={styles.rosterSelect}
                                value={rosterElectionId ?? ""}
                                onChange={handleRosterElectionChange}
                                disabled={rosterBusy}
                            >
                                {rosterElections.length === 0 ? (
                                    <option value="">No elections available</option>
                                ) : (
                                    rosterElections.map((e) => (
                                        <option key={e.id} value={e.id}>
                                            #{e.id} {e.name} ({e.status})
                                        </option>
                                    ))
                                )}
                            </select>
                        </label>
                        <div className={styles.rosterSearchRow}>
                            <input
                                type="search"
                                className={styles.formInput}
                                placeholder="Search name, email, or student number"
                                value={rosterSearchDraft}
                                onChange={(e) => setRosterSearchDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRosterApplySearch();
                                }}
                            />
                            <button
                                type="button"
                                className={styles.rosterSearchBtn}
                                onClick={handleRosterApplySearch}
                                disabled={rosterLoading || rosterBusy}
                            >
                                Search
                            </button>
                        </div>
                        <div className={styles.rosterFilterRow}>
                            <label className={styles.rosterLabel}>
                                Roster
                                <select
                                    className={styles.rosterSelect}
                                    value={rosterEnrollmentFilter}
                                    onChange={(e) => {
                                        setRosterEnrollmentFilter(e.target.value);
                                        setRosterOffset(0);
                                    }}
                                    disabled={rosterBusy}
                                    aria-label="Filter by roster enrollment"
                                >
                                    <option value="all">All voters</option>
                                    <option value="enrolled">On roster only</option>
                                    <option value="not_enrolled">Not on roster</option>
                                </select>
                            </label>
                            <label className={styles.rosterLabel}>
                                Voted
                                <select
                                    className={styles.rosterSelect}
                                    value={rosterBallotFilter}
                                    onChange={(e) => {
                                        setRosterBallotFilter(e.target.value);
                                        setRosterOffset(0);
                                    }}
                                    disabled={rosterBusy}
                                    aria-label="Filter by ballot submitted"
                                >
                                    <option value="all">All</option>
                                    <option value="voted">Voted</option>
                                    <option value="not_voted">Not voted</option>
                                </select>
                            </label>
                        </div>
                    </div>
                    <p className={styles.rosterHint}>
                        CSV import still creates voter accounts anytime. If an election is published at
                        upload time, new voters are auto-enrolled for that election; otherwise enroll them
                        here. Unenroll is blocked after a ballot is submitted. Use Clear roster to drop all
                        non-candidate enrollments at once (only before any ballots exist for this election).
                    </p>
                    {rosterError && (
                        <p className={styles.validationError} role="alert">
                            {rosterError}
                        </p>
                    )}
                    {rosterMessage ? (
                        <p className={styles.rosterFeedback} role="status">
                            {rosterMessage}
                        </p>
                    ) : null}
                    {rosterLoading ? (
                        <p className={styles.loadingText}>Loading roster...</p>
                    ) : rosterElectionId == null ? (
                        <div className={styles.gatedNotice}>
                            <p className={styles.gatedBody}>
                                Create an election first (draft or published). Archived elections cannot be
                                edited here.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className={styles.rosterMeta}>
                                <span>
                                    <strong>{rosterPayload?.enrolled_count ?? "—"}</strong> enrolled
                                    for this election
                                </span>
                                <span className={styles.rosterMetaSep}>·</span>
                                <span>
                                    Showing {rosterPayload?.results?.length ?? 0} of{" "}
                                    {rosterPayload?.total_matching ?? 0} matching voters
                                </span>
                            </div>
                            <div className={styles.rosterBulkBar}>
                                <button
                                    type="button"
                                    className={styles.rosterBulkBtn}
                                    onClick={rosterTogglePageSelection}
                                    disabled={
                                        rosterBusy || !(rosterPayload?.results?.length)
                                    }
                                >
                                    Select page
                                </button>
                                <button
                                    type="button"
                                    className={styles.rosterBulkBtn}
                                    onClick={handleRosterBulkEnroll}
                                    disabled={rosterBusy}
                                >
                                    Enroll selected
                                </button>
                                <button
                                    type="button"
                                    className={styles.rosterBulkBtn}
                                    onClick={handleRosterBulkUnenroll}
                                    disabled={rosterBusy}
                                >
                                    Unenroll selected
                                </button>
                                <button
                                    type="button"
                                    className={styles.rosterClearBtn}
                                    onClick={() => setRosterClearModalOpen(true)}
                                    disabled={
                                        rosterBusy ||
                                        (rosterPayload?.enrolled_count ?? 0) === 0
                                    }
                                    title={
                                        (rosterPayload?.enrolled_count ?? 0) === 0
                                            ? "No enrollments on this roster"
                                            : undefined
                                    }
                                >
                                    Clear roster
                                </button>
                            </div>
                            <div className={`${styles.contentBox} ${styles.rosterTableWrap}`}>
                                <table className={styles.rosterTable}>
                                    <thead>
                                        <tr>
                                            <th
                                                className={styles.rosterThCheck}
                                                aria-label="Select row"
                                            />
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Student #</th>
                                            <th>Roster</th>
                                            <th>Voted</th>
                                            <th className={styles.rosterThActions}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(rosterPayload?.results ?? []).map((row) => (
                                            <tr key={row.voter_id}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={rosterSelected.has(
                                                            row.voter_id
                                                        )}
                                                        onChange={() =>
                                                            toggleRosterRow(row)
                                                        }
                                                        aria-label={`Select ${row.first_name} ${row.last_name}`}
                                                    />
                                                </td>
                                                <td>
                                                    {row.first_name} {row.last_name}
                                                </td>
                                                <td>{row.email}</td>
                                                <td>{row.student_number}</td>
                                                <td>{row.enrolled ? "Yes" : "No"}</td>
                                                <td>{row.has_ballot ? "Yes" : "—"}</td>
                                                <td>
                                                    {!row.enrolled ? (
                                                        <button
                                                            type="button"
                                                            className={styles.rosterRowBtn}
                                                            onClick={() =>
                                                                handleRosterRowEnroll(
                                                                    row.voter_id
                                                                )
                                                            }
                                                            disabled={rosterBusy}
                                                        >
                                                            Enroll
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className={styles.rosterRowBtn}
                                                            onClick={() =>
                                                                handleRosterRowUnenroll(
                                                                    row.voter_id
                                                                )
                                                            }
                                                            disabled={
                                                                rosterBusy ||
                                                                row.has_ballot
                                                            }
                                                            title={
                                                                row.has_ballot
                                                                    ? "Cannot unenroll after voting"
                                                                    : undefined
                                                            }
                                                        >
                                                            Unenroll
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {(rosterPayload?.results ?? []).length === 0 ? (
                                    <p className={styles.rosterEmpty}>
                                        No voters match this search or filters.
                                    </p>
                                ) : null}
                            </div>
                            <div className={styles.rosterPager}>
                                <button
                                    type="button"
                                    className={styles.rosterBulkBtn}
                                    onClick={() =>
                                        setRosterOffset((o) =>
                                            Math.max(0, o - rosterLimit)
                                        )
                                    }
                                    disabled={rosterBusy || rosterOffset <= 0}
                                >
                                    Previous
                                </button>
                                <span className={styles.rosterPagerInfo}>
                                    {(() => {
                                        const total =
                                            rosterPayload?.total_matching ?? 0;
                                        const page =
                                            total === 0
                                                ? 0
                                                : Math.floor(rosterOffset / rosterLimit) +
                                                  1;
                                        const pages =
                                            total === 0
                                                ? 0
                                                : Math.ceil(total / rosterLimit);
                                        return pages === 0
                                            ? `No results · ${rosterLimit} per page`
                                            : `Page ${page} of ${pages} · ${rosterLimit} per page`;
                                    })()}
                                </span>
                                <button
                                    type="button"
                                    className={styles.rosterBulkBtn}
                                    onClick={() =>
                                        setRosterOffset((o) => o + rosterLimit)
                                    }
                                    disabled={
                                        rosterBusy ||
                                        !rosterPayload ||
                                        rosterOffset + rosterLimit >=
                                            rosterPayload.total_matching
                                    }
                                >
                                    Next
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}

            {activeSection === "candidates" && (
                <>
                    {!electionPublished ? (
                        <div className={styles.gatedNotice}>
                            <p className={styles.gatedTitle}>No election is currently published.</p>
                            <p className={styles.gatedBody}>
                                Candidates can only be added while a published election exists.
                                Head over to <strong>Manage Elections</strong> to publish one,
                                then come back here to register candidates.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className={styles.candidateForm}>
                                <p className={styles.candidateFormHint}>
                                    Enter the <strong>student number</strong> first —{" "}
                                    <strong>first</strong> and <strong>last name</strong> load from
                                    the voter roster when that person exists (for example from{" "}
                                    <strong>Upload voter&apos;s CSV</strong>). On submit, names must
                                    still exactly match the voter on file.
                                </p>
                                {votingOngoing ? (
                                    <p className={styles.candidateLookupHint} role="status">
                                        Adding candidates is disabled while voting is in progress.
                                    </p>
                                ) : null}
                                <div className={styles.formRow}>
                                    <input
                                        type="text"
                                        className={styles.formInput}
                                        placeholder="Student Number"
                                        value={candidateForm.studentNumber}
                                        onChange={updateCandidateField("studentNumber")}
                                        disabled={candidateSaving || votingOngoing}
                                        autoComplete="off"
                                    />
                                    <input
                                        type="text"
                                        className={styles.formInput}
                                        placeholder="First Name"
                                        value={candidateForm.firstName}
                                        onChange={updateCandidateField("firstName")}
                                        disabled={candidateSaving || votingOngoing}
                                    />
                                    <input
                                        type="text"
                                        className={styles.formInput}
                                        placeholder="Last Name"
                                        value={candidateForm.lastName}
                                        onChange={updateCandidateField("lastName")}
                                        disabled={candidateSaving || votingOngoing}
                                    />
                                </div>
                                {candidateSnLookupHint ? (
                                    <p className={styles.candidateLookupHint} role="status">
                                        {candidateSnLookupHint}
                                    </p>
                                ) : null}
                                <div className={styles.formRow}>
                                    <input
                                        type="text"
                                        className={styles.formInput}
                                        placeholder="Alias"
                                        value={candidateForm.alias}
                                        onChange={updateCandidateField("alias")}
                                        disabled={candidateSaving || votingOngoing}
                                    />
                                    <input
                                        type="text"
                                        className={styles.formInput}
                                        placeholder="Party"
                                        value={candidateForm.party}
                                        onChange={updateCandidateField("party")}
                                        disabled={candidateSaving || votingOngoing}
                                    />
                                    <input
                                        type="text"
                                        className={styles.formInput}
                                        placeholder="Description"
                                        value={candidateForm.description}
                                        onChange={updateCandidateField("description")}
                                        disabled={candidateSaving || votingOngoing}
                                    />
                                </div>
                                <select
                                    className={styles.positionSelect}
                                    value={candidateForm.position}
                                    onChange={updateCandidateField("position")}
                                    disabled={candidateSaving || votingOngoing}
                                >
                                    <option value="" disabled hidden>Position</option>
                                    {POSITIONS.map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>

                                {candidateError && (
                                    <p className={styles.validationError} role="alert">
                                        {candidateError}
                                    </p>
                                )}

                                <div className={styles.formActions}>
                                    <button
                                        className={styles.addButton}
                                        onClick={handleAddCandidate}
                                        disabled={candidateSaving || votingOngoing}
                                    >
                                        {candidateSaving ? "Adding..." : "Add Candidate"}
                                    </button>
                                </div>
                            </div>

                            <h2 className={styles.sectionTitle}>List of Candidates</h2>
                            <div
                                className={styles.candidatePositionTabs}
                                role="tablist"
                                aria-label="Filter candidates by position"
                            >
                                {POSITIONS.map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        role="tab"
                                        aria-selected={candidatePositionTab === p}
                                        className={
                                            candidatePositionTab === p
                                                ? `${styles.candidatePositionTab} ${styles.candidatePositionTabActive}`
                                                : styles.candidatePositionTab
                                        }
                                        onClick={() => setCandidatePositionTab(p)}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                            <div
                                className={`${styles.contentBox} ${styles.candidateListScrollBox}`}
                            >
                                {candidatesLoading ? (
                                    <p className={styles.emptyText}>Loading candidates...</p>
                                ) : candidates.length === 0 ? (
                                    <p className={styles.emptyText}>
                                        No candidates added yet. Fill out the form above to add one.
                                    </p>
                                ) : filteredCandidates.length === 0 ? (
                                    <p className={styles.emptyText}>
                                        No candidates filed for {candidatePositionTab} yet.
                                    </p>
                                ) : (
                                    <ul className={styles.candidateList}>
                                        {filteredCandidates.map((c) => (
                                            <li key={c.voter_id} className={styles.candidateCard}>
                                                <img
                                                    src={upSeal}
                                                    alt=""
                                                    className={styles.candidateSeal}
                                                    aria-hidden="true"
                                                />
                                                <div className={styles.candidateDetails}>
                                                    <p className={styles.candidateLine}>
                                                        <span className={styles.candidateLabel}>Name:</span>{" "}
                                                        {c.first_name} {c.last_name}
                                                    </p>
                                                    {c.alias && (
                                                        <p className={styles.candidateLine}>
                                                            <span className={styles.candidateLabel}>Alias:</span>{" "}
                                                            {c.alias}
                                                        </p>
                                                    )}
                                                    {c.party && (
                                                        <p className={styles.candidateLine}>
                                                            <span className={styles.candidateLabel}>Party:</span>{" "}
                                                            {c.party}
                                                        </p>
                                                    )}
                                                    {c.position && (
                                                        <p className={styles.candidateLine}>
                                                            <span className={styles.candidateLabel}>Running For:</span>{" "}
                                                            {c.position}
                                                        </p>
                                                    )}
                                                    {c.description && (
                                                        <p className={styles.candidateLine}>
                                                            <span className={styles.candidateLabel}>
                                                                Candidate&rsquo;s Description:
                                                            </span>{" "}
                                                            {c.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    className={styles.removeButton}
                                                    onClick={() => handleRemoveCandidateClick(c.voter_id)}
                                                    disabled={
                                                        candidateBusyId === c.voter_id ||
                                                        publishedElectionLive?.state === "ongoing"
                                                    }
                                                    title={
                                                        publishedElectionLive?.state === "ongoing"
                                                            ? "Cannot remove candidates while voting is in progress."
                                                            : undefined
                                                    }
                                                >
                                                    {candidateBusyId === c.voter_id
                                                        ? "Removing..."
                                                        : "Remove Candidate"}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}

            {activeSection === "reports" && showAuditorReportsChrome ? (
                <div className={`${auditorStyles.printRoot} printable`}>
                    <div className={auditorStyles.header}>
                        <h1>{publishedElection.name}</h1>
                        <h2>{currentReport.title}</h2>
                        <p
                            className={`${auditorStyles.headerRunningClock} ${auditorStyles.noPrint}`}
                            aria-live="polite"
                        >
                            <time dateTime={adminHeaderClock.toISOString()}>
                                {adminHeaderClock.toLocaleString(undefined, {
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
                                <span className={auditorStyles.headerRunningClockTz}>
                                    {" "}
                                    · {localTzHint}
                                </span>
                            ) : null}
                        </p>
                        <p className={auditorStyles.headerMeta}>
                            {formatAdminElectionRange(
                                publishedElection.start_datetime,
                                publishedElection.end_datetime
                            )}
                        </p>
                        <div className={auditorStyles.headerStatusRow}>
                            <span
                                className={`${auditorStyles.statusPill} ${auditorStyles[`status_${adminReportsStatusBadge.variant}`]}`}
                                role="status"
                            >
                                {adminReportsStatusBadge.label}
                            </span>
                        </div>
                        <p className={auditorStyles.headerAsOf}>
                            <span className={auditorStyles.asOfPill}>
                                <span className={auditorStyles.asOfLead}>As of</span>
                                <time dateTime={reportsTimestamp.iso}>
                                    {reportsTimestamp.display}
                                </time>
                            </span>
                        </p>
                    </div>

                    <div className={`${auditorStyles.buttons} ${auditorStyles.noPrint}`}>
                        {REPORTS.map((report) => (
                            <button
                                key={report.id}
                                type="button"
                                className={
                                    activeReport === report.id
                                        ? auditorStyles.activeView
                                        : ""
                                }
                                onClick={() => setActiveReport(report.id)}
                            >
                                {report.label}
                            </button>
                        ))}
                    </div>

                    <div className={auditorStyles.descriptionRow}>
                        <p className={auditorStyles.reportDescription}>
                            {currentReport.description}
                        </p>
                        <button
                            type="button"
                            className={`${auditorStyles.printButton} ${auditorStyles.noPrint}`}
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

                    <div
                        className={`${auditorStyles.contentBox} auditor-scrollbar`}
                    >
                        {activeReport === "hourly" ? (
                            <AdminHourlyActivityChart
                                electionId={publishedElection.id}
                                electionName={publishedElection.name}
                                electionRangeLabel={formatAdminElectionRange(
                                    publishedElection.start_datetime,
                                    publishedElection.end_datetime
                                )}
                                electionStatusLabel={adminElectionStatusLabel(
                                    publishedElectionLive
                                )}
                                electionStartDatetime={
                                    publishedElection.start_datetime
                                }
                                electionEndDatetime={
                                    publishedElection.end_datetime
                                }
                            />
                        ) : activeReport === "velocity" ? (
                            <AdminVoteVelocityReport
                                electionId={publishedElection.id}
                                electionStartDatetime={
                                    publishedElection.start_datetime
                                }
                                electionEndDatetime={
                                    publishedElection.end_datetime
                                }
                            />
                        ) : (
                            <p className={auditorStyles.viewPlaceholder}>
                                (Placeholder content — chart / data for the
                                &ldquo;{currentReport.label}&rdquo; tab will render
                                here.)
                            </p>
                        )}
                    </div>
                </div>
            ) : null}

            {activeSection === "reports" && !showAuditorReportsChrome ? (
                <>
                    <div className={styles.buttons}>
                        {REPORTS.map((report) => (
                            <button
                                key={report.id}
                                className={
                                    activeReport === report.id
                                        ? styles.activeReport
                                        : ""
                                }
                                onClick={() => setActiveReport(report.id)}
                            >
                                {report.label}
                            </button>
                        ))}
                    </div>

                    <div className={styles.descriptionRow}>
                        <p className={styles.reportDescription}>
                            {currentReport.description}
                        </p>
                        <button
                            type="button"
                            className={styles.printButton}
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

                    <div className={`${styles.contentBox} printable`}>
                        <p className={styles.viewPlaceholder}>
                            Publish an election to view reports.
                        </p>
                    </div>
                </>
            ) : null}
            {csvResult && (
                <div className={
                    csvResult.type === "error"
                        ? `${styles.csvResult} ${styles.csvResultError}`
                        : `${styles.csvResult} ${styles.csvResultSuccess}`
                }>
                    <button
                        type="button"
                        className={styles.csvResultClose}
                        onClick={() => setCsvResult(null)}
                        aria-label="Dismiss"
                    >
                        ✕
                    </button>

                    {csvResult.type === "error" ? (
                        <p className={styles.csvResultHeading}>{csvResult.message}</p>
                    ) : (
                        <>
                            <p className={styles.csvResultHeading}>CSV Upload Complete</p>
                            <ul className={styles.csvResultStats}>
                                <li>
                                    <span className={styles.csvStatNum}>{csvResult.created}</span> voter{csvResult.created !== 1 ? "s" : ""} created
                                </li>
                                <li>
                                    <span className={styles.csvStatNum}>{csvResult.skipped}</span> already existed (skipped)
                                </li>
                            </ul>
                            {csvResult.errors?.length > 0 && (
                                <>
                                    <p className={styles.csvErrorsLabel}>
                                        {csvResult.errors.length} row{csvResult.errors.length !== 1 ? "s" : ""} could not be imported:
                                    </p>
                                    <ul className={styles.csvErrorList}>
                                        {csvResult.errors.map((e) => (
                                            <li key={e.row}>
                                                Row {e.row}: {e.reason}
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
        </DashboardLayout>
    );
}

export default AdminDashboard
