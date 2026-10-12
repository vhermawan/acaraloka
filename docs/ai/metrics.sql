-- Query manual untuk memantau beta AI. Jalankan di SQL editor Supabase (read-only).
-- Bulan dan hari dihitung dalam WIB (Asia/Jakarta).

-- 1. Tingkat dipakai: berapa hasil berhasil yang akhirnya dipakai, per bulan.
SELECT
  to_char(date_trunc('month', created_at AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM') AS bulan,
  kind,
  count(*) FILTER (WHERE status = 'SUCCEEDED') AS berhasil,
  count(*) FILTER (WHERE status = 'SUCCEEDED' AND first_used_at IS NOT NULL) AS dipakai,
  round(
    100.0 * count(*) FILTER (WHERE status = 'SUCCEEDED' AND first_used_at IS NOT NULL)
    / NULLIF(count(*) FILTER (WHERE status = 'SUCCEEDED'), 0),
    1
  ) AS persen_dipakai
FROM ai_generations
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- 2. Error per kode (14 hari terakhir).
SELECT
  coalesce(failure_code, '(tanpa kode)') AS kode,
  status,
  count(*) AS jumlah
FROM ai_generations
WHERE status IN ('FAILED', 'REJECTED')
  AND created_at >= now() - interval '14 days'
GROUP BY 1, 2
ORDER BY jumlah DESC;

-- 3. Biaya per hari (USD, 30 hari terakhir).
SELECT
  to_char(date_trunc('day', created_at AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM-DD') AS hari,
  count(*) AS generate,
  round(sum(cost_micros) / 1000000.0, 4) AS biaya_usd
FROM ai_generations
WHERE created_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;

-- 4. Biaya per jenis (bulan WIB berjalan).
SELECT
  kind,
  count(*) AS generate,
  round(sum(cost_micros) / 1000000.0, 4) AS biaya_usd
FROM ai_generations
WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta'
GROUP BY 1
ORDER BY 1;

-- 5. Hasil yang dilaporkan mengandung tulisan (bulan WIB berjalan).
SELECT
  count(*) FILTER (WHERE reported_at IS NOT NULL) AS dilaporkan,
  count(*) FILTER (WHERE status = 'SUCCEEDED') AS berhasil,
  round(
    100.0 * count(*) FILTER (WHERE reported_at IS NOT NULL)
    / NULLIF(count(*) FILTER (WHERE status = 'SUCCEEDED'), 0),
    1
  ) AS persen_dilaporkan
FROM ai_generations
WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta';
