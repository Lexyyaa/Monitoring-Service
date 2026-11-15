package com.ocs.monitoring.domain.resource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ocs.monitoring.domain.exception.ErrorCode;
import com.ocs.monitoring.domain.resource.exception.ResourceException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;

class ResourceRuleTest {

    private static Node node(long id, long clusterId) {
        Node node = instantiate(Node.class);
        ReflectionTestUtils.setField(node, "id", id);
        ReflectionTestUtils.setField(node, "clusterId", clusterId);
        return node;
    }

    private static Namespace namespace(long id, long clusterId) {
        Namespace namespace = instantiate(Namespace.class);
        ReflectionTestUtils.setField(namespace, "id", id);
        ReflectionTestUtils.setField(namespace, "clusterId", clusterId);
        return namespace;
    }

    private static <T> T instantiate(Class<T> type) {
        try {
            var constructor = type.getDeclaredConstructor();
            constructor.setAccessible(true);
            return constructor.newInstance();
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    @Nested
    @DisplayName("이상 심각도")
    class IssueLevelRule {

        @ParameterizedTest
        @NullAndEmptySource
        @ValueSource(strings = {"  "})
        @DisplayName("값이 없으면 필터 없음(null)이다")
        void emptyMeansNoFilter(String value) {
            assertThat(IssueLevel.from(value)).isNull();
        }

        @Test
        @DisplayName("정의된 값은 앞뒤 공백을 지우고 읽는다")
        void readsDefinedValue() {
            assertThat(IssueLevel.from(" ERROR ")).isEqualTo(IssueLevel.ERROR);
        }

        @ParameterizedTest
        @ValueSource(strings = {"CRITICAL", "error", "ALL"})
        @DisplayName("정의되지 않은 값은 400 예외다")
        void rejectsUndefinedValue(String value) {
            assertThatThrownBy(() -> IssueLevel.from(value))
                    .isInstanceOf(ResourceException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.INVALID_PARAMETER);
        }
    }

    @Nested
    @DisplayName("리소스 종류")
    class ResourceTypeRule {

        @Test
        @DisplayName("네 종류를 읽는다")
        void readsFourTypes() {
            assertThat(ResourceType.from("CLUSTER")).isEqualTo(ResourceType.CLUSTER);
            assertThat(ResourceType.from("POD")).isEqualTo(ResourceType.POD);
        }

        @ParameterizedTest
        @NullAndEmptySource
        @ValueSource(strings = {"DEPLOYMENT", "pod"})
        @DisplayName("없는 종류는 400 예외다")
        void rejectsUnknownType(String value) {
            assertThatThrownBy(() -> ResourceType.from(value))
                    .isInstanceOf(ResourceException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.INVALID_PARAMETER);
        }
    }

    @Nested
    @DisplayName("Node와 Namespace의 소속")
    class SameClusterRule {

        @Test
        @DisplayName("같은 Cluster면 경로가 성립한다")
        void sameClusterPasses() {
            assertThatCode(() -> node(1, 1).requireSameCluster(namespace(1, 1))).doesNotThrowAnyException();
        }

        @Test
        @DisplayName("다른 Cluster면 없는 경로로 보고 404 예외다")
        void otherClusterIsNotFound() {
            assertThatThrownBy(() -> node(1, 1).requireSameCluster(namespace(101, 2)))
                    .isInstanceOf(ResourceException.class)
                    .extracting("errorCode")
                    .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
        }
    }
}
