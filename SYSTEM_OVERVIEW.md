# UniVote — System overview

This document describes how the election management system is structured: data model, ballot lifecycle, auditing, and major API behaviors. Use it alongside the root **`README.md`** for setup and dependencies.

---

## 1. High-level architecture

- **Frontend:** Single-page app (React + Vite). Talks to the backend over HTTP with **JWT** bearer tokens.
- **Backend:** Django + Django REST Framework. Default database is **SQLite** (`backend/db.sqlite3`).
- **Authentication:** Custom user model (`api.User`) with email login; role is inferred from linked profiles (**Voter**, **Candidate**, **Admin**, **Auditor**, **Faculty**).
- **Media:** Candidate profile images are stored under `MEDIA_ROOT` (`backend/media/`) and served in **DEBUG** via Django static URL routing.

---

## 2. Roles and responsibilities

**`/api/me/`** and login **`role`** use **`get_user_role`**: if the user has a **`Candidate`** row on **`_get_published_election()`**, they surface as **`candidate`** (otherwise **`voter`** when a **`Voter`** profile exists). Admin and auditor profiles win first.

| Role | Typical use |
|------|-------------|
| **Admin** | Create/publish/archive elections, upload voter CSV, manage candidates, view admin reports (hourly activity, election overview, vote velocity / device & IP clusters). |
| **Voter** | Log in, open ballot when voting is open, cast one ballot per published election, view receipt. |
| **Candidate** | Returned only while on the **published** slate; often also a voter; ballot UI when eligible; ballot-facing profile (`/api/me/candidate-profile/`). |
| **Auditor** | Read-only analytics: election results, program/year breakdowns, ballot timeline, apathy-style metrics (no vote mutation). |
| **Faculty** | Modeled in the schema; not central to the voting flows documented here. |

---

## 3. Authentication and tokens

- **Login:** `POST /api/login/` returns JWT **access** and **refresh** tokens (see project views).
- **Refresh:** `POST /api/token/refresh/` (SimpleJWT).
- **Authorization:** `Authorization: Bearer <access_token>` on API requests.
- **Password policy:** First-time / CSV-imported voters may have `must_change_password`; enforced before voting via API permissions.

---

## 4. Database model (conceptual tables)

Django creates extra tables for migrations, sessions, and auth internals. Below are the **domain** tables defined under `api/models.py`.

### 4.1 `api_user` (custom `User`)

Email-based `AbstractUser` subclass (`USERNAME_FIELD = email`, no `username`).

| Column (conceptual) | Notes |
|---------------------|--------|
| `id` | PK |
| `email` | Unique |
| `first_name`, `last_name` | |
| `password` | Hashed |
| `must_change_password` | Forces password change flow |
| Plus Django defaults | `is_active`, `is_staff`, `is_superuser`, timestamps, etc. |

### 4.2 `api_voter`

| Column | Notes |
|--------|--------|
| `user_id` | PK, FK → `api_user`, one-to-one |
| `student_number` | Unique |
| `voter_public_id` | UUID; anonymous-facing id for ballot UI |
| `year_level`, `degree_program` | Demographics for auditor charts |

### 4.3 `api_candidate`

Each slate row has its **own** surrogate PK; it references both **`voter`** and **`election`**. Uniqueness is **one candidate row per (election, voter)** — the same person may run again in a later cycle as a **new** row.

| Column | Notes |
|--------|--------|
| `id` | PK |
| `voter_id` | FK → `api_voter` (`related_name="candidate_entries"` on `Voter`) — the person must exist (usually via CSV import) before admin registers them on the slate |
| `election_id` | FK → election (`null` until assigned on create) |
| `alias`, `party`, `description` | |
| `position` | Chairperson / Vice Chairperson / Councilor |
| `profile_photo` | Optional image |
| `created_at`, `updated_at` | |

**REST detail routes** use **`voter_id`** in the URL segment (e.g. `GET /api/candidates/<voter_id>/`, `DELETE …`) for the **published** election the viewset resolves; **`BallotLine.candidate_id`** references the **`Candidate.id`** PK.

### 4.4 `api_election`

| Column | Notes |
|--------|--------|
| `name`, `description` | |
| `start_datetime`, `end_datetime` | Checked constraint: end after start |
| `status` | `draft` \| `published` \| `archived` |
| `published_at` | Set when published |
| `created_by_id` | FK → user |
| `created_at`, `updated_at` | |

**Derived `state` (not a column):** `scheduled`, `ongoing`, `ended`, `archived`, or draft semantics — computed from `status` and wall-clock time (`USE_TZ = True`, default `TIME_ZONE = UTC`).

### 4.5 `api_electionenrollment`

Roster of voters eligible for a given election when enrollment rows exist.

| Column | Notes |
|--------|--------|
| `id` | PK |
| `election_id`, `voter_id` | Unique together |
| `public_voter_id` | UUID, unique globally; per **(election, voter)** ballot/receipt-facing pseudonym (independent of legacy `Voter.voter_public_id`) |
| `created_at` | |

**Signal:** On `Candidate` save, if `election_id` is set, `ElectionEnrollment.get_or_create` runs so candidates are always enrolled in their election (`api/signals.py`).

### 4.6 `api_ballot`

One row per **(voter, election)** submission.

| Column | Notes |
|--------|--------|
| `id` | PK |
| `voter_id`, `election_id` | Unique together — at most one ballot per voter per election |
| `submitted_at` | Server time when row created |
| `client_submit_latency_ms` | Optional: browser-reported ms from ballot UI ready to submit |
| `device_fingerprint_hash` | SHA-256 hex of client-built fingerprint string |
| `submission_ip` | Server-observed client IP (best-effort; proxy-aware ops matter) |
| `submission_user_agent` | Server `User-Agent` from submit request (truncated) |
| `client_install_id` | Optional UUID persisted in browser `localStorage` for this site |

Together, fingerprint + install ID + IP + timestamps support **admin fraud-pattern reports** (clusters of distinct voters sharing signals).

### 4.7 `api_ballotline`

Normalized choices on a ballot.

| Column | Notes |
|--------|--------|
| `id` | PK |
| `ballot_id` | FK → ballot |
| `position` | Same labels as candidate positions |
| `candidate_id` | FK if voting for a candidate |
| `abstain` | True if abstaining that line |

Rules enforced in **`cast_ballot`**: chair and vice are single-seat; councilors allow multiple lines up to app limit; candidate IDs must belong to the active election.

### 4.8 `api_admin`, `api_auditor`, `api_faculty`

One-to-one extension tables from `api_user` — presence determines admin/auditor/faculty role routing on the frontend.

---

## 5. How ballots are stored

1. Client loads **`GET /api/voters/ballot-session/`**. Response fields:
   - **`election`** / **`candidates`** — populated only when there is a **votable** election (`published` **and** wall-clock inside `[start_datetime, end_datetime]`). When voting is open but the voter is **not** enrolled, **`election`** may still be present for context while **`candidates`** is empty so the UI cannot render a ballot.
   - **`voter_public_id`** — string form of **`ElectionEnrollment.public_voter_id`** for that votable enrollment when enrolled; otherwise empty.
   - **`current_cycle`** — always describes **`_get_published_election()`** (latest **`published_at`**, then **`created_at`** among **`status=published`**): nested **`election`** JSON (or `null`), **`voting_open`**, **`is_enrolled`**, **`has_cast_ballot`** for **that** published row — including **scheduled** or **ended-but-still-published** phases where **`election`** at top level is `null`. Dashboard UIs use this for banners and the adaptive vote / receipt call-to-action without guessing election ids client-side.
2. Client submits **`POST /api/voters/cast-ballot/`** with `election_id`, structured choices, plus optional audit payload (`client_latency_ms`, `device_fingerprint`, `client_install_id`).
3. Server validates: voter role, password-not-forced-change, active election window, optional **enrollment** membership if any enrollment rows exist for that election, no duplicate ballot (`IntegrityError` → 409).
4. In a **transaction**, creates **`Ballot`** then **`BallotLine`** rows in bulk.
5. Audit fields on `Ballot` are populated from request metadata (IP, UA) and validated optional client fields.

Ballots are **immutable** after creation (no update API in normal flow); corrections are operational/procedural outside this schema.

---

## 6. Election lifecycle (admin)

Typical sequence:

1. **Draft:** `POST /api/elections/` then `PATCH` for dates/name.
2. **Publish:** `POST /api/elections/{id}/publish/` sets this row **`published`**, stamps **`published_at`**, and **archives every other election that was still `published`** — after the request completes there is **at most one** non-archived **`published`** row. (Demo **`seed_demo`** may insert multiple `published` rows by **bypassing** this endpoint; production-style flows go through **`publish`**.)
3. **Unpublish:** `POST …/unpublish/` moves **`published` → `draft`** and clears **`published_at`** when allowed — **blocked** while **`state`** is **`ongoing`** or **`ended`** (must archive or publish another cycle instead).
4. **Archive:** Sets **`archived`**; retained for auditor history.

Voters only receive a **votable** election when status is **`published`** **and** current time is within `[start_datetime, end_datetime]` (`_get_votable_election`). **`_get_published_election()`** (used for admin candidate CRUD, **`GET /api/me/`** candidate role, and **`current_cycle`**) still returns the latest **`published`** row **outside** that window (scheduled or ended-but-not-archived).

---

## 7. Eligibility and turnout denominators

- **Admin overview and auditor reports:** ``eligible_voters`` is the number of voters with an **`ElectionEnrollment`** row for that election (same as **Voter roster**). With **no** enrollments yet, the eligible count is **0** and turnout uses that denominator.
- **`cast_ballot`:** The voter must have an **`ElectionEnrollment`** row for the active votable election — non-rostered voters receive **400** (“You are not enrolled for this election.”). **`GET /api/voters/ballot-session/`** returns **`is_enrolled`: false** and an empty **`candidates`** array when voting is open but the caller is not enrolled (**`election`** may still be present for context — see §5).

---

## 8. Admin features (reports & CSV)

### 8.1 Voter CSV import

- **Endpoint:** `POST /api/voters/upload-csv/` — **`IsAuthenticated` + `IsAdmin`**; multipart field **`file`** (`.csv`).
- **Columns:** Required header fields `first_name`, `last_name`, `student_number`, `email`, `year_level`, `degree_program` (case-insensitive names). See root **`README.md`** for examples.
- **Creates:** `User` (password = `student_number`, `must_change_password=True`) + `Voter`.
- **Enrollment:** If **`_get_published_election()`** is non-null at import time, **`ElectionEnrollment.objects.get_or_create(election=pub, voter=voter)`** runs — tying CSV voters to the roster used by **`cast_ballot`** when enrollments exist for that election.
- **Skips:** Existing `student_number`. **Errors:** Duplicate `email` for a new student number.
- **Integrates with voting:** `CannotVoteUntilPasswordChanged` blocks ballot API until **`POST /api/change-password/`**. After password change, voting follows normal enrollment + window checks (§7).

### 8.2 Voter roster (API)

- **List:** `GET /api/admin/election-voter-roster/{election_id}/?q=&limit=&offset=` — paginated voters with `enrolled` and `has_ballot`; archived elections return **404**.
- **Enroll:** `POST .../enroll/` JSON `{ "voter_ids": [...] }` — `get_or_create` per voter; response includes `created`, `already_enrolled`, `unknown_voter_ids`.
- **Unenroll:** `POST .../unenroll/` — deletes enrollment rows; voters with an existing **Ballot** for that election are listed in `blocked_has_ballot` and are not removed.
- **Clear roster:** `POST .../clear/` — removes **all** enrollments for that election **except** voters who are registered **candidates** on that election. Returns **409** if **any** ballot exists for that election (keeps audit integrity).

Admin UI: **Voter roster** section on the Admin Dashboard drives these endpoints.

### 8.3 Other admin APIs

- **Election overview:** `GET /api/admin/election-overview/{election_id}/` — eligible counts, ballots cast, turnout %, candidate counts by position.
- **Voting activity by hour:** `GET /api/admin/election-ballots-by-hour/{election_id}/?date=YYYY-MM-DD` — 24 buckets in Django’s active timezone.
- **Vote velocity:** `GET /api/admin/election-vote-velocity/{election_id}/?date=&period=&flagged_only=` — sequential ballot gaps vs latency; **corroborated** flagging (see **§8.4**).
- **Device fingerprint clusters:** `GET /api/admin/election-device-fingerprints/{election_id}/` — multi-voter clusters by fingerprint hash, install ID, and submit IP (see **§8.5**).

---

### 8.4 Vote Velocity — how “flagging” works (review reference)

**Purpose.** Help admins spot **patterns worth reviewing**, not automatic fraud verdicts. The Admin Dashboard includes an **on-page playbook** (what red dots mean, busy turnout vs corroborated signals, escalation).

**Important.** The API does **not** label a ballot “fraudulent.” It emits **chart points**: one point per ballot **after the first** in the filtered time slice.

**Inputs**

| Query param | Meaning |
|-------------|---------|
| `date` | Calendar day (`YYYY-MM-DD`) in the server’s active timezone window `[start of day, next day)`. |
| `period` | `all` \| `morning` (midnight–noon) \| `afternoon` (noon–6pm) \| `evening` (6pm–midnight), local hour buckets on `submitted_at`. |
| `flagged_only` | `1` / `true` / `yes` → response **`points`** only include rows where **`flagged`** is true. |

**Algorithm (backend)**

1. Load all **`Ballot`** rows for the election whose **`submitted_at`** falls on **`date`** (and **`period`** if not `all`).
2. Sort by **`submitted_at`**, then **`pk`** (global chronological order for that slice — **any voter**).
3. For each ballot **B** after the first, let **P** be the ballot immediately before **B**.
4. **`gap_seconds`** = **`B.submitted_at − P.submitted_at`** (seconds).
5. **`rapid_gap`** = **`gap_seconds < VELOCITY_GAP_SUSPICIOUS_SECONDS`** (currently **5** seconds).
6. **`corroboration_signals`** = list of strings describing **non-empty matching audit fields** between **P** and **B**:
   - **`fingerprint`** — same **`device_fingerprint_hash`**
   - **`install_id`** — same **`client_install_id`**
   - **`ip`** — same **`submission_ip`**  
   Each comparison requires **both** sides to have that field set (non-blank); otherwise that dimension cannot corroborate.
7. **`flagged`** = **`rapid_gap`** **and** **`corroboration_signals` is non-empty**.  
   So **busy polling** (many voters, tight spacing, **different** devices/IPs) produces **`rapid_gap`** but **not** **`flagged`**.
8. If **`rapid_gap`** but **not** **`flagged`**, the backend increments **`uncorroborated_rapid_count`** for that slice (fast transitions **without** shared fingerprint/install/IP vs **P**).

**Response fields (trust / transparency)**

| Field | Meaning |
|-------|---------|
| `gap_threshold_seconds` | Currently **5**; gaps below this are “rapid.” |
| `flagging_rule` | **`corroborated_gap`** — rapid timing alone is insufficient for **`flagged`**. |
| `flagged_count` | Number of **`points`** with **`flagged: true`** (corroborated rapid submissions). |
| `uncorroborated_rapid_count` | Rapid gaps where **P** and **B** did **not** share any corroborating signal — **expected** during high turnout; **not** counted as **`flagged`**. |
| `points[]` | Each item: **`gap_seconds`**, **`latency_ms`** (stored client latency when present, else deterministic display fallback), **`rapid_gap`**, **`flagged`**, **`corroboration_signals`**, **`ballot_id`**, **`submitted_at`**. |

**Admin UI**

- **Red banner:** Shown when **`flagged_count > 0`** (and “Flagged only” is off): explains **corroborated rapid** submissions (gap under threshold **and** matching fingerprint / install ID / IP vs **prior** ballot).
- **Muted note:** When **`uncorroborated_rapid_count > 0`**, explains many rapid transitions are **intentionally not** red.
- **Chart:** Non-flagged points may still show **short** gaps on the X-axis (busy traffic); **red** = **`flagged`** only.
- **Tooltips:** “Needs review (corroborated)” lists **which** signals matched; rapid-but-not-flagged explains **different** device/network vs prior ballot.

**Use cases & examples (Vote Velocity)**

| # | Scenario | What you might see | Sensible next step |
|---|----------|-------------------|-------------------|
| **1** | **High turnout, many devices** — voters submit every few seconds from phones/laptops on different networks. | Chart shows **many short gaps** on the X-axis, but dots are **not red** (or mostly not). **`uncorroborated_rapid_count`** can be **large**. **`flagged_count`** stays **low or zero**. | Treat short gaps as **normal congestion**. Skim **`flagged_count`** only; no action solely because the hall was busy. |
| **2** | **Official kiosk / shared PC** — two different rostered voters use the **same browser profile** minutes apart; telemetry matches. | Ballot **B** arrives **&lt; 5 s** after **P**, with **same fingerprint and/or install ID and/or IP**. Point for **B** is **red**; tooltip lists **`corroboration_signals`**. | Cross-check **Voter roster**, polling-station logs, or witness forms. Often **legitimate**; document if challenged. |
| **3** | **Suspected scripted submits** — same environment firing ballots unnaturally fast in sequence. | Several **red** points in a row with overlapping **`corroboration_signals`** on peak hours **and** overlap with **Device Fingerprint** clusters (§8.5). | Narrow date/period; enable **Flagged only**; export/note **`ballot_id`** / times; escalate per institution policy **with** fingerprint report — not velocity alone. |
| **4** | **Deadline hour spike** — mixed traffic: some shared labs, some personal phones. | **Both** nonzero **`flagged_count`** **and** nonzero **`uncorroborated_rapid_count`**. | Read **muted note** + banner separately: reds = timing **plus** shared signal vs prior ballot; muted = fast but **different** signals. |
| **5** | **Older ballots without client telemetry** — fingerprint/install blank; IP maybe blank behind misconfigured proxy. | **Tight gaps** exist but **`corroboration_signals`** is empty → **never flagged red**, even if suspicion exists elsewhere. | Improve **`cast-ballot`** payload collection and **proxy IP** config (§11); rely on other reviews if telemetry is missing. |

**Mini timeline example (corroborated vs not)**

Assume threshold **5 s**. Order by time:

1. **10:00:00** — Voter **A** submits from **Phone-1** (fingerprint **Fa**, IP **203.0.113.10**).  
2. **10:00:03** — Voter **B** submits from **Phone-2** (**Fb**, **203.0.113.99**). Gap **3 s**, **no** shared hash/install/IP vs **A** → **`rapid_gap` true**, **`flagged` false**. Counts toward **`uncorroborated_rapid_count`**.  
3. **10:00:06** — Voter **C** submits from **same lab browser as B** (**Fb**, same **install ID**, same IP **203.0.113.99**). Gap **3 s** vs **B**, signals match → **`rapid_gap` true**, **`flagged` true** for **C**.

---

### 8.5 Device Fingerprint report — clusters and notifications

**Purpose.** Surface **multi-voter reuse** of the same technical signals across **the whole election** (not tied to a single calendar day like Vote Velocity).

**What is *not* done.** Individual ballots are **not** marked “suspicious” in this endpoint. There is **no** per-ballot flag array — only **aggregate clusters**.

**Three independent cluster lists**

Each list includes **only** groups where **more than one distinct voter** shares the same value:

| Dimension | Ballot field | Rule |
|-----------|--------------|------|
| Device environment digest | `device_fingerprint_hash` | Same hash (non-empty), **`unique_voters > 1`**. |
| First-party browser id | `client_install_id` | Same UUID string (non-empty), **`unique_voters > 1`**. |
| Server-observed network path | `submission_ip` | Same IP string (non-empty), **`unique_voters > 1`**. |

Each **row** in the JSON (`devices`, `install_collisions`, `ip_collisions`) is **one cluster** (one hash / one install id / one IP). Rows include **`unique_voters`** and **`total_votes`** for that cluster.

**`corroborating_signal_rows` (banner total)**

```text
corroborating_signal_rows = len(devices) + len(install_collisions) + len(ip_collisions)
```

So a banner like **“18 corroborating fraud-pattern signal(s): 6 fingerprint …, 6 install …, 6 IP …”** means **18 cluster rows total** across three tables — **not** “18 ballots” and **not** adding unique voters across dimensions.

**Interpretation caveats**

- The **same underlying ballots** may appear in **all three** lists if they share fingerprint **and** install **and** IP — counts are **not** deduplicated across dimensions.
- **Shared campus NAT / proxy / kiosk** can produce legitimate clusters; **`submission_ip`** accuracy depends on reverse-proxy configuration (see **§11**).

**Admin UI**

- **Red banner:** Appears when **`corroborating_signal_rows > 0`**, summarizing counts per dimension.
- **Tables:** Detailed clusters; empty state explains missing telemetry or no multi-voter reuse.

**Use cases & examples (Device Fingerprint)**

| # | Scenario | What you might see | Sensible next step |
|---|----------|-------------------|-------------------|
| **1** | **No multi-voter reuse** — everyone voted on their own device; or audit fields mostly empty. | **No red banner.** Tables empty / “no clusters” message. **`corroborating_signal_rows` = 0**. | Nothing to triage here. If policy still requires audit, confirm clients send fingerprint/install ID and servers record **IP** (§11). |
| **2** | **Computer lab row** — several distinct voters, same machine profile in one session. | **Fingerprint** table: **one row**, `unique_voters` = 4, `total_votes` ≥ 4. **Install ID** row may mirror the same cluster. **IP** row may match if same egress. | Map to **authorized lab hours** and roster. Usually **benign** if staff-supervised; document cluster id for the file. |
| **3** | **Residential hall / carrier-grade NAT** — many phones, **one** public IP for the building. | **IP** table shows **one IP** with **high** `unique_voters`; **fingerprint** rows may **differ** (each phone unique). | **Do not** treat IP-only clusters as smoking gun. Confirm with **networking** whether that IP is shared NAT; prioritize **fingerprint/install** mismatches when explaining to a board. |
| **4** | **Aligned fraud review** — same cohort shows in all three lists. | Banner: e.g. **3 + 3 + 3 = 9** “signals” if three cluster **rows** per dimension (example only). Tables list the same tight group of identities if you drill via admin tools. | Highest **review priority**: triangulate roster identities, timestamps, and Vote Velocity reds for same window — still **institutional decision**, not automatic disqualification. |
| **5** | **Misconfigured reverse proxy** — every ballot sees proxy IP **only**. | **One IP cluster** with **`unique_voters`** nearly equal to turnout; fingerprints may still separate voters. | Fix **`submission_ip`** (§11); after fix, historical IP clusters may **not** repeat; treat legacy IP-only clusters cautiously. |

**Banner math example**

Suppose the API returns:

- **`devices`**: **2 rows** (two distinct fingerprint hashes, each shared by ≥ 2 voters),  
- **`install_collisions`**: **2 rows**,  
- **`ip_collisions`**: **2 rows**.

Then **`corroborating_signal_rows` = 2 + 2 + 2 = 6**. The UI banner might read like **“6 corroborating … signal(s): 2 fingerprint …, 2 install …, 2 IP …”** — meaning **six cluster rows**, **not** six people and **not** six ballots total across the election.

---

## 9. Auditor features

- **`GET /api/auditor/election-results/{election_id}/`** — aggregates: ballots cast, eligible voters, tallies by position/program/year, apathy-related breakdowns.
- **`GET /api/auditor/election-ballot-timeline/{election_id}/`** — daily counts by cohort for line charts.

Auditors **cannot** mutate elections or ballots via these endpoints.

---

## 10. REST surface (quick reference)

Router-backed:

- **`/api/elections/`** — CRUD + `active`, `publish`, `unpublish`, `archive`; **`POST …/purge_drafts/`** deletes every **draft** election that has **no ballots** (admin housekeeping); **`DELETE …/{id}/`** only allowed for drafts with no ballots.
- **`/api/candidates/`** — CRUD tied to published election rules

Selected function routes (`api/urls.py`):

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/login/` | Login |
| GET | `/api/me/` | Current user / role |
| GET/PATCH | `/api/me/candidate-profile/` | Candidate ballot photo/profile |
| POST | `/api/change-password/` | Password change |
| GET | `/api/voters/ballot-session/` | Ballot state for the votable window; includes **`current_cycle`** for the published election |
| POST | `/api/voters/cast-ballot/` | Submit ballot |
| GET | `/api/voters/voting-receipt/` | Receipt |
| POST | `/api/voters/upload-csv/` | Voter import |
| GET | `/api/admin/election-voter-roster/<election_id>/` | Roster table (search + pagination) |
| POST | `/api/admin/election-voter-roster/<election_id>/enroll/` | Bulk enroll voters |
| POST | `/api/admin/election-voter-roster/<election_id>/unenroll/` | Bulk unenroll (blocked if voted) |
| POST | `/api/admin/election-voter-roster/<election_id>/clear/` | Clear all non-candidate roster rows; **409** if ballots exist |
| GET | `/api/admin/election-overview/<election_id>/` | Turnout / overview stats |
| GET | `/api/admin/election-ballots-by-hour/<election_id>/` | Hourly ballot counts for a date |
| GET | `/api/admin/election-vote-velocity/<election_id>/` | Sequential gaps / latency; corroborated flagging (§8.4) |
| GET | `/api/admin/election-device-fingerprints/<election_id>/` | Multi-voter clusters by fingerprint, install ID, IP (§8.5) |

JWT: `/api/token/`, `/api/token/refresh/`.

---

## 11. Operational nuances

- **Time zones:** Stored datetimes are timezone-aware; hourly buckets use `timezone.get_current_timezone()`. Configure `TIME_ZONE` / `USE_TZ` for production expectations.
- **Client IP:** Behind reverse proxies, configure Django/trusted headers so `submission_ip` reflects the real client; otherwise clusters may reflect proxy IPs only.
- **CORS:** Allowed origins are listed in `backend/backend/settings.py` (default Vite dev URLs).
- **Security:** `DEBUG = True` and insecure `SECRET_KEY` in repo settings are for **development only** — replace for any real deployment.
- **Migrations / `Candidate` PK change:** Migration **`0014_candidate_per_election`** rebuilds SQLite tables when changing **`BallotLine`** to reference **`Candidate.id`**. Deploying on **PostgreSQL or MySQL** may require an explicit migration path if you adopt that change on a non-SQLite database (see migration file and deployment notes).

---

## 12. Frontend routes (summary)

Defined in `frontend/src/App.jsx` — login, voter dashboard/vote/receipt, candidate dashboard/profile, admin dashboard, auditor dashboard, protected by role. Voter and candidate dashboards derive a **single primary action** (vote, change password, view receipt, etc.) from **`ballot-session`** via `useVoterDashboardBallotState` / `deriveDashboardBallotPrimary` (`frontend/src/hooks/useVoterDashboardBallotState.js`).

---

This overview reflects the codebase’s intent: **transparent ballot storage**, **role separation**, and **auditable metadata** for investigations alongside standard election administration.
