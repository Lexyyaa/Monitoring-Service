CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX namespaces_name_trgm_idx
    ON namespaces USING gin (lower(name) gin_trgm_ops);

CREATE INDEX pods_name_trgm_idx
    ON pods USING gin (lower(name) gin_trgm_ops);
