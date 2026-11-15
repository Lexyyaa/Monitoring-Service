/************************************************************************
 * DB 제약 통합 테스트 (실제 PostgreSQL)
 * 테스트가 직접 넣은 Cluster 2개로 복합 FK·NOT NULL·CHECK 제약을 확인한다. 시드가 없어도 실행된다
 * 테스트마다 트랜잭션을 롤백하므로 DB 값은 바뀌지 않는다
 ************************************************************************/
package com.ocs.monitoring.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class DatabaseConstraintIntegrationTest {

    /** 시드와 겹치지 않는 ID. Cluster A = 9001, Cluster B = 9002 */
    private static final long CLUSTER_A = 9001;

    private static final long CLUSTER_B = 9002;
    private static final long NODE_A = 90011;
    private static final long NODE_B = 90021;
    private static final long NAMESPACE_A = 90011;
    private static final long POD_ID = 9_000_001;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void insertTwoClusters() {
        jdbcTemplate.update("""
                INSERT INTO clusters (id, name, control_plane_status, issue_level, last_updated_at)
                VALUES (?, 'cluster-a', 'Ready', 'NONE', now()), (?, 'cluster-b', 'Ready', 'NONE', now())
                """, CLUSTER_A, CLUSTER_B);
        jdbcTemplate.update("""
                INSERT INTO nodes (id, cluster_id, name, ready_condition, issue_level, last_updated_at)
                VALUES (?, ?, 'node-a', 'True', 'NONE', now()), (?, ?, 'node-b', 'True', 'NONE', now())
                """, NODE_A, CLUSTER_A, NODE_B, CLUSTER_B);
        jdbcTemplate.update("""
                INSERT INTO namespaces (id, cluster_id, name, phase, issue_level, last_updated_at)
                VALUES (?, ?, 'ns-a', 'Active', 'NONE', now())
                """, NAMESPACE_A, CLUSTER_A);
    }

    private void insertPod(long clusterId, long namespaceId, Long nodeId, String issueLevel) {
        jdbcTemplate.update("""
                INSERT INTO pods (id, cluster_id, namespace_id, node_id, name, phase, ready,
                                  restart_count, issue_level, last_updated_at)
                VALUES (?, ?, ?, ?, 'pod-test', 'Running', true, 0, ?, now())
                """, POD_ID, clusterId, namespaceId, nodeId, issueLevel);
    }

    @Test
    @DisplayName("DB-03 Pod가 다른 Cluster의 Node를 참조하면 INSERT가 거절된다")
    void podWithOtherClusterNode() {
        assertThatThrownBy(() -> insertPod(CLUSTER_A, NAMESPACE_A, NODE_B, "NONE"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("pods_cluster_node_fk");
    }

    @Test
    @DisplayName("DB-04 Pod가 다른 Cluster의 Namespace를 참조하면 INSERT가 거절된다")
    void podWithOtherClusterNamespace() {
        assertThatThrownBy(() -> insertPod(CLUSTER_B, NAMESPACE_A, NODE_B, "NONE"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("pods_cluster_namespace_fk");
    }

    @Test
    @DisplayName("DB-05 Node가 없는 Pod는 INSERT가 거절된다")
    void podWithoutNode() {
        assertThatThrownBy(() -> insertPod(CLUSTER_A, NAMESPACE_A, null, "NONE"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("node_id");
    }

    @Test
    @DisplayName("DB-06 정의되지 않은 심각도는 INSERT가 거절된다")
    void undefinedIssueLevel() {
        assertThatThrownBy(() -> insertPod(CLUSTER_A, NAMESPACE_A, NODE_A, "CRITICAL"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("pods_issue_level_check");
    }

    @Test
    @DisplayName("DB-06 정의된 심각도는 저장된다")
    void definedIssueLevel() {
        insertPod(CLUSTER_A, NAMESPACE_A, NODE_A, "WARNING");

        String saved = jdbcTemplate.queryForObject("SELECT issue_level FROM pods WHERE id = ?", String.class, POD_ID);
        assertThat(saved).isEqualTo("WARNING");
    }
}
