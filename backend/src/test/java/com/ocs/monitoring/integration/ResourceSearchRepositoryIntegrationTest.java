/************************************************************************
 * 검색 저장소 통합 테스트 (실제 PostgreSQL, 시드 적재 필요)
 * 열지 않은 분기도 DB에서 찾고, 이름 순서와 대표 경로를 돌려주는지 확인한다
 ************************************************************************/
package com.ocs.monitoring.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.ocs.monitoring.domain.resource.PathSegment;
import com.ocs.monitoring.domain.resource.ResourceSearchItem;
import com.ocs.monitoring.domain.resource.ResourceSearchRepository;
import com.ocs.monitoring.domain.resource.ResourceType;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class ResourceSearchRepositoryIntegrationTest {

    @Autowired
    private ResourceSearchRepository searchRepository;

    @Test
    @DisplayName("대소문자를 무시하고 Cluster·Node·Namespace·Pod 이름을 부분 일치로 찾는다")
    void searchesAllTypesIgnoringCase() {
        List<ResourceSearchItem> items = searchRepository.search("api", 0, 50);

        assertThat(items)
                .extracting(ResourceSearchItem::resourceType)
                .contains(ResourceType.CLUSTER, ResourceType.NODE, ResourceType.NAMESPACE, ResourceType.POD);
        assertThat(items).extracting(ResourceSearchItem::name).contains("cluster-API-02", "pod-worker-API-warn");
    }

    @Test
    @DisplayName("결과는 소문자 이름 순서이고, Pod 결과는 Cluster부터 자신까지의 경로를 가진다")
    void orderedWithPath() {
        List<ResourceSearchItem> items = searchRepository.search("pod-payment-api-error", 0, 21);

        assertThat(items)
                .singleElement()
                .satisfies(item -> assertThat(item.path())
                        .extracting(PathSegment::resourceType)
                        .containsExactly(
                                ResourceType.CLUSTER, ResourceType.NODE, ResourceType.NAMESPACE, ResourceType.POD));
        List<String> names = searchRepository.search("ns-01-0", 0, 21).stream()
                .map(item -> item.name().toLowerCase())
                .toList();
        assertThat(names).isSorted().hasSize(21);
    }

    @Test
    @DisplayName("Namespace 결과는 Pod가 있는 최소 ID Node를 대표 경로로 쓴다")
    void namespaceRepresentativePath() {
        List<ResourceSearchItem> items = searchRepository.search("ns-01-011", 0, 21);

        assertThat(items)
                .singleElement()
                .satisfies(item -> assertThat(item.path().get(1).id()).isEqualTo(2L));
    }
}
