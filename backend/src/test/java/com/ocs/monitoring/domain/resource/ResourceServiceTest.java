/************************************************************************
 * 도메인 서비스 단위 테스트 (Mockito로 Repository를 대신함, DB 없이 실행)
 * 없는 부모와 다른 Cluster 경로가 404이고, 그때 하위 조회를 하지 않는지 확인한다
 ************************************************************************/
package com.ocs.monitoring.domain.resource;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

import com.ocs.monitoring.domain.exception.ErrorCode;
import com.ocs.monitoring.domain.resource.exception.ResourceException;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ResourceServiceTest {

    @Mock
    private ResourceRepository resourceRepository;

    @Mock
    private ResourceTreeRepository treeRepository;

    @InjectMocks
    private ResourceService resourceService;

    /** 조회 전용 엔티티는 생성자가 없어 테스트에서만 필드를 채운다 */
    private static Node node(long id, long clusterId) {
        Node node = new Node();
        ReflectionTestUtils.setField(node, "id", id);
        ReflectionTestUtils.setField(node, "clusterId", clusterId);
        return node;
    }

    private static Namespace namespace(long id, long clusterId) {
        Namespace namespace = new Namespace();
        ReflectionTestUtils.setField(namespace, "id", id);
        ReflectionTestUtils.setField(namespace, "clusterId", clusterId);
        return namespace;
    }

    @Test
    @DisplayName("UNIT-01 없는 Cluster의 Node 목록을 요청하면 404 예외이고 하위 조회를 하지 않는다")
    void missingCluster() {
        given(resourceRepository.findCluster(999)).willReturn(Optional.empty());

        assertThatThrownBy(() -> resourceService.listNodes(999))
                .isInstanceOf(ResourceException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
        then(treeRepository).should(never()).findNodes(anyLong());
    }

    @Test
    @DisplayName("UNIT-02 Node와 다른 Cluster의 Namespace로 Pod 목록을 요청하면 404 예외다")
    void namespaceInOtherCluster() {
        given(resourceRepository.findNode(10)).willReturn(Optional.of(node(10, 1)));
        given(resourceRepository.findNamespace(200)).willReturn(Optional.of(namespace(200, 2)));

        assertThatThrownBy(() -> resourceService.listPods(10, 200))
                .isInstanceOf(ResourceException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
        then(treeRepository).should(never()).findPods(anyLong(), anyLong());
    }
}
