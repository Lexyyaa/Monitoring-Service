CREATE TABLE clusters (
    id BIGINT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    control_plane_status VARCHAR(48) NOT NULL,
    kubernetes_version VARCHAR(32),
    issue_level VARCHAR(10) NOT NULL CHECK (issue_level IN ('NONE', 'WARNING', 'ERROR', 'UNKNOWN')),
    issue_reason TEXT,
    last_updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE nodes (
    id BIGINT PRIMARY KEY,
    cluster_id BIGINT NOT NULL REFERENCES clusters(id),
    name VARCHAR(200) NOT NULL,
    ready_condition VARCHAR(16) NOT NULL CHECK (ready_condition IN ('True', 'False', 'Unknown')),
    cpu_usage_percent NUMERIC(5,2) CHECK (cpu_usage_percent BETWEEN 0 AND 100),
    memory_usage_percent NUMERIC(5,2) CHECK (memory_usage_percent BETWEEN 0 AND 100),
    disk_usage_percent NUMERIC(5,2) CHECK (disk_usage_percent BETWEEN 0 AND 100),
    issue_level VARCHAR(10) NOT NULL CHECK (issue_level IN ('NONE', 'WARNING', 'ERROR', 'UNKNOWN')),
    issue_reason TEXT,
    last_updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT nodes_cluster_id_id_unique UNIQUE (cluster_id, id)
);

CREATE TABLE namespaces (
    id BIGINT PRIMARY KEY,
    cluster_id BIGINT NOT NULL REFERENCES clusters(id),
    name VARCHAR(200) NOT NULL,
    phase VARCHAR(32) NOT NULL CHECK (phase IN ('Active', 'Terminating')),
    cpu_quota_used_millicores BIGINT CHECK (cpu_quota_used_millicores >= 0),
    cpu_quota_limit_millicores BIGINT CHECK (cpu_quota_limit_millicores >= 0),
    memory_quota_used_mib BIGINT CHECK (memory_quota_used_mib >= 0),
    memory_quota_limit_mib BIGINT CHECK (memory_quota_limit_mib >= 0),
    issue_level VARCHAR(10) NOT NULL CHECK (issue_level IN ('NONE', 'WARNING', 'ERROR', 'UNKNOWN')),
    issue_reason TEXT,
    last_updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT namespaces_cluster_id_id_unique UNIQUE (cluster_id, id)
);

CREATE TABLE pods (
    id BIGINT PRIMARY KEY,
    cluster_id BIGINT NOT NULL REFERENCES clusters(id),
    namespace_id BIGINT NOT NULL,
    node_id BIGINT NOT NULL,
    name VARCHAR(200) NOT NULL,
    phase VARCHAR(32) NOT NULL CHECK (phase IN ('Pending', 'Running', 'Succeeded', 'Failed', 'Unknown')),
    ready BOOLEAN,
    restart_count INTEGER NOT NULL CHECK (restart_count >= 0),
    cpu_usage_millicores BIGINT CHECK (cpu_usage_millicores >= 0),
    memory_usage_mib BIGINT CHECK (memory_usage_mib >= 0),
    issue_level VARCHAR(10) NOT NULL CHECK (issue_level IN ('NONE', 'WARNING', 'ERROR', 'UNKNOWN')),
    issue_reason TEXT,
    last_updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT pods_cluster_node_fk FOREIGN KEY (cluster_id, node_id)
        REFERENCES nodes(cluster_id, id),
    CONSTRAINT pods_cluster_namespace_fk FOREIGN KEY (cluster_id, namespace_id)
        REFERENCES namespaces(cluster_id, id)
);

CREATE INDEX nodes_cluster_name_id_idx ON nodes(cluster_id, name, id);
CREATE INDEX namespaces_cluster_name_id_idx ON namespaces(cluster_id, name, id);
CREATE INDEX pods_node_namespace_name_id_idx ON pods(node_id, namespace_id, name, id);
