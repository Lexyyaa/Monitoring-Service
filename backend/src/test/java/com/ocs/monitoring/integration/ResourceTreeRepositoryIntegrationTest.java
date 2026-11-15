/************************************************************************
 * 트리 조회 저장소 통합 테스트 (실제 PostgreSQL, 시드 적재 필요)
 * 시드 : Cluster 1 = Node 1~10·Namespace 1~100, Namespace 10개씩 같은 Node에 Pod 50개
 * 공유 Namespace 경우는 트랜잭션 안에서 Pod 1을 Node 2로 옮겨 만들고 롤백한다
 * 필터 기준 : Cluster 1·Node 1·Namespace 1은 NONE, Pod 1만 ERROR (이 경로의 유일한 ERROR)
 ************************************************************************/
package com.ocs.monitoring.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.ocs.monitoring.domain.resource.IssueLevel;
import com.ocs.monitoring.domain.resource.MatchRole;
import com.ocs.monitoring.domain.resource.ResourceTreeRepository;
import com.ocs.monitoring.domain.resource.TreeResource;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class ResourceTreeRepositoryIntegrationTest {

    @Autowired
    private ResourceTreeRepository treeRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private static List<Long> ids(List<TreeResource> items) {
        return items.stream().map(TreeResource::id).toList();
    }

    @Test
    @DisplayName("Cluster의 Node는 그 Cluster 소속만 이름순으로 읽는다")
    void nodesOfCluster() {
        List<TreeResource> nodes = treeRepository.findNodes(1, null);

        assertThat(nodes).hasSize(10);
        assertThat(ids(nodes)).allMatch(id -> id >= 1 && id <= 10);
        assertThat(nodes).extracting(TreeResource::name).isSorted();
    }

    @Test
    @DisplayName("Node 아래 Namespace는 그 Node의 Pod로 찾고 중복이 없다")
    void namespacesOfNodeFromPods() {
        List<TreeResource> namespaces = treeRepository.findNamespaces(1, null);

        assertThat(ids(namespaces)).containsExactlyInAnyOrder(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L);
    }

    @Test
    @DisplayName("Pod는 Node와 Namespace를 함께 만족하는 것만 읽는다")
    void podsOfNodeAndNamespace() {
        assertThat(treeRepository.findPods(1, 1, null)).hasSize(50);
        assertThat(treeRepository.findPods(2, 1, null)).isEmpty();
    }

    @Test
    @DisplayName("공유 Namespace는 두 Node 아래에 각각 나오고 Pod는 Node별로 나뉜다")
    void sharedNamespaceAppearsUnderBothNodes() {
        jdbcTemplate.update("UPDATE pods SET node_id = 2 WHERE id = 1");

        assertThat(ids(treeRepository.findNamespaces(1, null))).contains(1L);
        assertThat(ids(treeRepository.findNamespaces(2, null))).contains(1L).doesNotHaveDuplicates();
        assertThat(ids(treeRepository.findPods(2, 1, null))).containsExactly(1L);
        assertThat(treeRepository.findPods(1, 1, null)).hasSize(49);
    }

    private static TreeResource byId(List<TreeResource> items, long id) {
        return items.stream().filter(item -> item.id() == id).findFirst().orElse(null);
    }

    @Test
    @DisplayName("필터가 없으면 matchRole이 없다")
    void noFilterNoMatchRole() {
        assertThat(treeRepository.findClusters(null)).allMatch(item -> item.matchRole() == null);
    }

    @Test
    @DisplayName("ERROR 필터에서 정상 부모는 자기 심각도를 유지한 채 PATH, 오류 Pod는 MATCH다")
    void matchAndPath() {
        TreeResource cluster = byId(treeRepository.findClusters(IssueLevel.ERROR), 1);
        TreeResource node = byId(treeRepository.findNodes(1, IssueLevel.ERROR), 1);
        TreeResource namespace = byId(treeRepository.findNamespaces(1, IssueLevel.ERROR), 1);
        List<TreeResource> pods = treeRepository.findPods(1, 1, IssueLevel.ERROR);

        for (TreeResource parent : List.of(cluster, node, namespace)) {
            assertThat(parent.issueLevel()).isEqualTo(IssueLevel.NONE);
            assertThat(parent.matchRole()).isEqualTo(MatchRole.PATH);
        }
        assertThat(pods).singleElement().satisfies(pod -> {
            assertThat(pod.id()).isEqualTo(1);
            assertThat(pod.matchRole()).isEqualTo(MatchRole.MATCH);
        });
    }

    @Test
    @DisplayName("Pod가 없는 일치 Namespace는 Cluster를 PATH로 만들지 않는다")
    void namespaceWithoutPodIsNotPath() {
        jdbcTemplate.update("""
                INSERT INTO clusters (id, name, control_plane_status, issue_level, last_updated_at)
                VALUES (9001, 'cluster-quiet', 'Ready', 'NONE', now())
                """);
        jdbcTemplate.update("""
                INSERT INTO namespaces (id, cluster_id, name, phase, issue_level, last_updated_at)
                VALUES (90011, 9001, 'ns-empty-error', 'Active', 'ERROR', now())
                """);

        assertThat(ids(treeRepository.findClusters(IssueLevel.ERROR))).doesNotContain(9001L);
    }

    @Test
    @DisplayName("다른 Node의 오류 Pod 때문에 공유 Namespace가 이 Node 아래 경로로 나오지 않는다")
    void sharedNamespaceFilterPerNode() {
        jdbcTemplate.update("UPDATE pods SET node_id = 2 WHERE id = 1");

        assertThat(byId(treeRepository.findNamespaces(2, IssueLevel.ERROR), 1))
                .extracting(TreeResource::matchRole)
                .isEqualTo(MatchRole.PATH);
        assertThat(ids(treeRepository.findNamespaces(1, IssueLevel.ERROR))).doesNotContain(1L);
    }
}
