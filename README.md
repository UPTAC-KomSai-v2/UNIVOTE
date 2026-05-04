# UniVote — University Student Council Election Management System

Web application for managing elections: admins configure cycles and candidates; voters cast ballots; auditors review turnout and results; optional fraud-pattern reports use ballot audit metadata.

---

## Prerequisites

| Layer | Requirement |
|--------|-------------|
| **Backend** | Python **3.11+** (project targets Django 6.x) |
| **Frontend** | **Node.js 18+** and **npm** |

---

## Backend dependencies

Installed via pip from `backend/requirements.txt`:

| Package | Role |
|---------|------|
| **Django** | Web framework, ORM, admin |
| **djangorestframework** | REST API |
| **django-cors-headers** | CORS for the Vite dev origin |
| **djangorestframework-simplejwt** | JWT access/refresh tokens |
| **Pillow** | `ImageField` for candidate profile photos |

Install:

```bash
cd backend
python -m venv venv
```

**Windows (activate venv):**

```bash
venv\Scripts\activate
```

**macOS / Linux:**

```bash
source venv/bin/activate
```

```bash
pip install -r requirements.txt
```

Apply migrations:

```bash
python manage.py migrate
```

Run the API server (default **http://127.0.0.1:8000/**):

```bash
python manage.py runserver
```

API routes are under **`/api/`** (see `SYSTEM_OVERVIEW.md` for detail).

---

## Frontend dependencies

Declared in `frontend/package.json`:

**Runtime**

| Package | Role |
|---------|------|
| **react**, **react-dom** | UI |
| **react-router-dom** | Routing & protected routes |
| **axios** | HTTP client (JWT interceptors in `src/api.jsx`) |
| **recharts** | Admin/auditor charts |

**Development**

| Package | Role |
|---------|------|
| **vite**, **@vitejs/plugin-react** | Dev server & build |
| **eslint** (+ plugins) | Linting |

Install and run the **Vite** dev server (**http://localhost:5173/** — matches `CORS_ALLOWED_ORIGINS` in Django):

```bash
cd frontend
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview   # optional: test the production bundle locally
```

The frontend expects the API at **`http://127.0.0.1:8000`** (`frontend/src/api.jsx` → `baseURL`). Change it if your backend host/port differs.

---

## Running the full stack

Use **two terminals**:

1. **Backend:** `cd backend` → activate venv → `python manage.py runserver`
2. **Frontend:** `cd frontend` → `npm run dev`

Open **http://localhost:5173** in the browser and log in.

---

## Voter CSV upload (admin workflow)

Registered **admins** can bulk-create voter accounts from the Admin Dashboard (**Upload voter's CSV**) or by calling the API directly.

### Endpoint

| Item | Value |
|------|--------|
| **URL** | `POST http://127.0.0.1:8000/api/voters/upload-csv/` |
| **Auth** | Bearer JWT for an **admin** account |
| **Body** | `multipart/form-data` with one field named **`file`** (the `.csv` file) |

Non-admin authenticated users receive **403** — uploads are restricted to admins.

### CSV format

- **Encoding:** UTF-8 (a UTF-8 BOM at the start of the file is fine).
- **First row:** Header with column names (**case-insensitive**). Extra columns are ignored.

**Required columns**

| Column | Meaning |
|--------|---------|
| `first_name` | Given name |
| `last_name` | Family name |
| `student_number` | Unique student ID (also used as the **initial password**) |
| `email` | Login email (must be unique in the system) |
| `year_level` | e.g. academic year; used in auditor turnout breakdowns |
| `degree_program` | Program name; used in auditor charts |

### Example CSV

```csv
first_name,last_name,student_number,email,year_level,degree_program
Ana,Santos,2021-14321,ana.santos@student.edu,3,BS Computer Science
Ben,Dela Cruz,2022-21008,ben.delacruz@student.edu,2,BA Psychology
```

### What the backend does per row

1. **Validates** that `first_name`, `last_name`, `student_number`, `email`, `year_level`, and `degree_program` are non-empty.
2. **Skips** the row (counts as **skipped**) if a **voter with that `student_number` already exists** — no duplicate voter row.
3. **Rejects** the row with an **error** if the **email is already used** by another user (student number must be new *and* email must be unused).
4. Otherwise **creates** a `User` and linked `Voter`:
   - Initial password = **`student_number`**
   - **`must_change_password = True`** — the voter **cannot cast a ballot** until they call **`POST /api/change-password/`** and set a new password (see `CannotVoteUntilPasswordChanged`).
5. **Election enrollment:** If a **published** election exists at upload time, the new voter is added to **`ElectionEnrollment`** for that election (`get_or_create`). **`cast_ballot`** always requires an **`ElectionEnrollment`** row for the active election — voters without one cannot vote (see **`GET /api/voters/ballot-session/`** field **`is_enrolled`**).

### Voter roster (Admin Dashboard + API)

Use **Voter roster** in the Admin Dashboard to attach voters to an election **explicitly**: choose any **non-archived** election (draft or published), search voters, then **Enroll** / **Unenroll** per row or in bulk (selected rows on the current page). **Unenroll** is skipped for voters who already **submitted a ballot** for that election.

This complements CSV import: uploads **always** create accounts the same way as before; **if no election is published at upload time**, you can enroll voters here afterward instead of re-uploading.

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/api/admin/election-voter-roster/<election_id>/` | — | Paginated voters (`q`, `limit`, `offset`) with `enrolled` / `has_ballot` flags |
| POST | `/api/admin/election-voter-roster/<election_id>/enroll/` | `{ "voter_ids": [1, 2, …] }` | Add roster rows (idempotent) |
| POST | `/api/admin/election-voter-roster/<election_id>/unenroll/` | `{ "voter_ids": [1, 2, …] }` | Remove roster rows unless the voter has already voted |
| POST | `/api/admin/election-voter-roster/<election_id>/clear/` | _(empty body)_ | Remove **all** roster enrollments except registered candidates; **`409`** if any ballot exists for that election |

All roster endpoints require an **admin** JWT. Responses include counts and any `unknown_voter_ids`; unenroll responses include `blocked_has_ballot` for voters who could not be removed.

### Recommended order of operations

To avoid voters being unable to vote once the roster is enforced:

1. **Publish** the election (so CSV auto-enrollment targets the right cycle), **or** keep a draft and enroll voters manually after import via **Voter roster**.
2. **Upload the CSV** so accounts exist; when a published election exists at upload time, new voters receive **`ElectionEnrollment`** automatically—otherwise use **Voter roster** to enroll them for the intended election.
3. **Add candidates** — each **student number** must already exist as a **voter** (import via CSV first). Saving a candidate enrolls them via signal.
4. Voters **log in** with email + student number, **change password**, then vote when the window is open.

If you upload CSV **before** any election is published, voters are created **without** enrollment. After you publish, **those voters cannot vote** until they are enrolled via **Voter roster** (CSV auto-enrollment, manual enroll, or becoming a candidate). **Re-uploading the same CSV does not fix skipped duplicate `student_number` rows** — use **Voter roster** to add them to the election.

### API response shape

```json
{
  "created": 12,
  "skipped": 2,
  "errors": [
    { "row": 7, "reason": "A user with email 'x@y.edu' already exists." }
  ]
}
```

Row numbers refer to the CSV file (**row 2** is the first data row under the header).

---

### Candidates

Admin **`POST /api/candidates/`** attaches a **Candidate** row to the election returned by **`_get_published_election()`** — the **latest** published election by `published_at` (then `created_at`). The **`student_number` must belong to an existing `Voter`**, and **`first_name` / `last_name` must exactly match** that voter's user record. **PATCH** cannot change student number. The same **voter** may appear on **another election's slate** in a later cycle (separate `Candidate` row per election; uniqueness is `(election, voter)`).

REST detail URLs use **`voter_id`** in the path (e.g. `DELETE /api/candidates/<voter_id>/`) while each `Candidate` row has its own numeric **`id`** for ballot lines.

While voting is **open** on that published election, the API blocks **adding** or **removing** candidates.

---

### Publish vs multiple published rows

Calling **`POST /api/elections/{id}/publish/`** sets that election to **published**, sets **`published_at`**, and **archives every other election that was still published**. After a publish action, exactly **one** published election remains (until you archive it or publish another).

Demo **`seed_demo`** bypasses this action and may insert multiple **`published`** rows (e.g. one **ended** plus one **ongoing**) so you can test banners and auditors without stepping through every click — see **`api/seed.py`** comments.

---

## Optional demo data

Load curated demo users, elections aligned with the **publish / archive** story, ballots with audit-friendly timestamps, and roster enrollments:

```bash
cd backend
python manage.py seed_demo --reset
```

`--reset` deletes existing **`@test.com`** demo rows (admin/auditor/voters/elections/ballots), then rebuilds the dataset. Omit `--reset` only when the database has **no** users yet.

Alternatively from Django shell:

```python
from api.seed import run
run()           # empty DB only
run(reset=True) # wipe @test.com demo data, then seed
```

Demo accounts (passwords are for **local development only**):

| Role | Email | Password |
|------|--------|----------|
| Admin | `admin@test.com` | `admin123` |
| Auditor | `auditor@test.com` | `auditor123` |
| Sample voter | `voter@test.com` | `1234` |
| Sample candidate | `candidate@test.com` | `1234` |

Additional voters/candidates use patterns such as `demovoter001@test.com`, `councilor01@test.com`, `past.chair1@test.com`, `end26close.chair1@test.com`, etc., with password **`1234`** — see **`api/seed.py`** and the console summary after seeding.

**SQLite:** If `seed_demo --reset` hangs, stop `python manage.py runserver` first so the database is not locked.

The seeded dataset is documented in **`api/seed.py`**: typically **archived** history, **one ended-but-published** row (archive-banner UX), **one ongoing published** cycle (latest `published_at`, canonical target for **`GET /api/elections/active/`** and voter **`current_cycle`**), and a **draft** next cycle. Ballots use staggered **`submitted_at`** with occasional **sub‑5s gaps** (vote velocity) and **multi‑hour/day jumps** (hourly activity + auditor timeline).

**Voter roster:** **`POST .../clear/`** clears all non-candidate enrollments for an election **only if no ballots exist** for that election (`409` otherwise).

---

## Further documentation

- **`SYSTEM_OVERVIEW.md`** — Database tables, ballot storage, auditing, enrollment, `ballot-session` / `current_cycle`, and API/report behavior.

---

## Project layout (short)

```
univote/
├── backend/           # Django project (`manage.py`, `api/` app, `db.sqlite3`)
├── frontend/          # React + Vite SPA
├── README.md          # This file
└── SYSTEM_OVERVIEW.md # Architecture & data reference
```
