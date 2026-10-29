CREATE TABLE IF NOT EXISTS documents (
  id          uuid PRIMARY KEY,
  user_id     text NOT NULL,
  s3_key      text NOT NULL,
  job_id      uuid NOT NULL UNIQUE,
  status      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_user_idx ON documents (user_id);