CREATE TABLE mandate_periods (
  id              SERIAL PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,      -- '2018-2022', '2022-2026'
  name            TEXT NOT NULL,            -- 'Mandatperiod 2022–2026'
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL
);

CREATE TABLE parties (
  id              SERIAL PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,      -- 'S', 'M', 'SD', etc.
  name            TEXT NOT NULL,
  color_hex       TEXT                      -- '#e41f26', '#1b49dd', etc. (nice for UI later)
);

CREATE TABLE constituencies (
  id              SERIAL PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,      -- 'JÖN', etc. (if such codes exist)
  name            TEXT NOT NULL
);

CREATE TABLE politicians (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  riksdag_id      TEXT NOT NULL UNIQUE,      -- stable ID from riksdagen
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  party_id        INTEGER REFERENCES parties(id),
  constituency_id INTEGER REFERENCES constituencies(id),
  active_from     DATE,
  active_to       DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  riksdag_id       TEXT UNIQUE,              -- e.g. dokid, protokoll-id
  date             DATE NOT NULL,
  title            TEXT NOT NULL,
  type             TEXT NOT NULL,            -- 'plenum', 'votering', etc.
  mandate_period_id INTEGER REFERENCES mandate_periods(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- attendance_status: present / absent / leave / unknown
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'leave', 'unknown');

CREATE TABLE attendance (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  politician_id    UUID NOT NULL REFERENCES politicians(id),
  session_id       UUID NOT NULL REFERENCES sessions(id),
  status           attendance_status NOT NULL,
  source_url       TEXT NOT NULL,
  reported_at      TIMESTAMPTZ,              -- datetime according to riksdagen
  scraped_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (politician_id, session_id)         -- upsert friendly
);

CREATE INDEX idx_attendance_politician ON attendance (politician_id);
CREATE INDEX idx_attendance_session ON attendance (session_id);
CREATE INDEX idx_sessions_date ON sessions (date);
