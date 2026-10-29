import pg from 'pg';

export function createDb({ host, port, database, user, password }) {
  const pool = new pg.Pool({ host, port, database, user, password, max: 10 });
  return {
    async insertDocument({ id, userId, s3Key, jobId, status }) {
      await pool.query(
        'INSERT INTO documents (id, user_id, s3_key, job_id, status) VALUES ($1, $2, $3, $4, $5)',
        [id, userId, s3Key, jobId, status]
      );
    },
    async updateStatus(id, status) {
      await pool.query('UPDATE documents SET status = $1 WHERE id = $2', [status, id]);
    },
    async close() {
      await pool.end();
    },
  };
}