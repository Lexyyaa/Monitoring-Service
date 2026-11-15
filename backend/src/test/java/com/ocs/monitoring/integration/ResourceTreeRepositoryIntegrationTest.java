/************************************************************************
 * 트리 조회 저장소 통합 테스트 (실제 PostgreSQL, 시드 적재 필요)
 * 시드 : Cluster 1 = Node 1~10·Namespace 1~100, Namespace 10개씩 같은 Node에 Pod 50개
 * 공유 Namespace 경우는 트랜잭션 안에서 Pod 1을 Node 2로 옮겨 만들고 롤백한다
 ************************************************************************/
package com.ocs.monitoring.integration;

import static org.assertj.core.api.Assertions.assertThat;

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
        List<TreeResource> nodes = treeRepository.findNodes(1);

        assertThat(nodes).hasSize(10);
        assertThat(ids(nodes)).allMatch(id -> id >= 1 && id <= 10);
        assertThat(nodes).extracting(TreeResource::name).isSorted();
    }

    @Test
    @DisplayName("Node 아래 Namespace는 그 Node의 Pod로 찾고 중복이 없다")
    void namespacesOfNodeFromPods() {
        List<TreeResource> namespaces = treeRepository.findNamespaces(1);

        assertThat(ids(namespaces)).containsExactlyInAnyOrder(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L);
    }

    @Test
    @DisplayName("Pod는 Node와 Namespace를 함께 만족하는 것만 읽는다")
    void podsOfNodeAndNamespace() {
        assertThat(treeRepository.findPods(1, 1)).hasSize(50);
        assertThat(treeRepository.findPods(2, 1)).isEmpty();
    }

    @Test
    @DisplayName("공유 Namespace는 두 Node 아래에 각각 나오고 Pod는 Node별로 나뉜다")
    void sharedNamespaceAppearsUnderBothNodes() {
        jdbcTemplate.update("UPDATE pods SET node_id = 2 WHERE id = 1");

        assertThat(ids(treeRepository.findNamespaces(1))).contains(1L);
        assertThat(ids(treeRepository.findNamespaces(2))).contains(1L).doesNotHaveDuplicates();
        assertThat(ids(treeRepository.findPods(2, 1))).containsExactly(1L);
        assertThat(treeRepository.findPods(1, 1)).hasSize(49);
    }
}
