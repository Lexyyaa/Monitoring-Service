/************************************************************************
 * API 통합 테스트 (실제 PostgreSQL + MockMvc, 시드 적재 필요)
 * Controller부터 SQL까지 함께 실행해 응답과 공통 오류 본문을 확인한다
 * 시드 기준 : Cluster 1 = Node 1~10·Namespace 1~100, Cluster 2 = Node 11~20·Namespace 101~200
 ************************************************************************/
package com.ocs.monitoring.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ResourceApiIntegrationTest {

    private static final String API = "/api/v1";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /** 공통 오류 본문은 code와 message 두 필드만 있다 */
    private static void expectError(ResultActions result, String code) throws Exception {
        result.andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    @DisplayName("트리 목록은 직접 하위와 조회 시각을 돌려준다")
    void treeListShape() throws Exception {
        mockMvc.perform(get(API + "/nodes/1/namespaces/1/pods"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(50))
                .andExpect(jsonPath("$.items[0].resourceType").value("POD"))
                .andExpect(jsonPath("$.items[0].matchRole").doesNotExist())
                .andExpect(jsonPath("$.fetchedAt").isNotEmpty());
    }

    @Test
    @DisplayName("TREE-T07 Node와 다른 Cluster의 Namespace로 Pod 목록을 요청하면 404")
    void podsWithNamespaceOfOtherCluster() throws Exception {
        expectError(
                mockMvc.perform(get(API + "/nodes/1/namespaces/101/pods")).andExpect(status().isNotFound()),
                "RESOURCE_NOT_FOUND");
    }

    @Test
    @DisplayName("UX-T04 400 공통 오류 본문 (0 이하·숫자가 아닌 경로 ID)")
    void badRequestBody() throws Exception {
        expectError(
                mockMvc.perform(get(API + "/clusters/0/nodes")).andExpect(status().isBadRequest()),
                "INVALID_PARAMETER");
        expectError(
                mockMvc.perform(get(API + "/clusters/abc/nodes")).andExpect(status().isBadRequest()),
                "INVALID_PARAMETER");
    }

    @Test
    @DisplayName("UX-T04 404 공통 오류 본문 (없는 부모·없는 주소)")
    void notFoundBody() throws Exception {
        expectError(
                mockMvc.perform(get(API + "/clusters/999/nodes")).andExpect(status().isNotFound()),
                "RESOURCE_NOT_FOUND");
        expectError(mockMvc.perform(get(API + "/nope")).andExpect(status().isNotFound()), "RESOURCE_NOT_FOUND");
    }

    @Test
    @DisplayName("UX-T04 405 공통 오류 본문 (GET 외 메서드)")
    void methodNotAllowedBody() throws Exception {
        expectError(
                mockMvc.perform(post(API + "/clusters")).andExpect(status().isMethodNotAllowed()),
                "METHOD_NOT_ALLOWED");
    }

    /************************************************************
     * 상세 : 시드 기준 Pod 1 = cluster-01 → node-01-01 → ns-01-001 → pod-payment-api-error
     ************************************************************/
    @Test
    @DisplayName("네 종류 상세는 공통 필드, 종류별 속성, 탐색 경로를 돌려준다")
    void detailOfFourTypes() throws Exception {
        mockMvc.perform(get(API + "/resources/CLUSTER/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resource.path.length()").value(1))
                .andExpect(jsonPath("$.resource.attributes.kubernetesVersion").value("1.31"))
                .andExpect(jsonPath("$.fetchedAt").isNotEmpty());
        mockMvc.perform(get(API + "/resources/NODE/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resource.path[0].id").value(1))
                .andExpect(jsonPath("$.resource.attributes.readyCondition").value("True"));
        mockMvc.perform(get(API + "/resources/NAMESPACE/1?nodeId=1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resource.path[1].resourceType").value("NODE"))
                .andExpect(jsonPath("$.resource.attributes.phase").value("Active"));
        mockMvc.perform(get(API + "/resources/POD/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resource.statusCode").value("Failed"))
                .andExpect(jsonPath("$.resource.issueLevel").value("ERROR"))
                .andExpect(jsonPath("$.resource.issueReason").isNotEmpty())
                .andExpect(jsonPath("$.resource.path.length()").value(4))
                .andExpect(jsonPath("$.resource.attributes.restartCount").value(5));
    }

    @Test
    @DisplayName("DETAIL-T05 없는 리소스나 이 Namespace의 Pod가 없는 Node로 상세를 요청하면 404")
    void detailNotFound() throws Exception {
        expectError(
                mockMvc.perform(get(API + "/resources/POD/999999")).andExpect(status().isNotFound()),
                "RESOURCE_NOT_FOUND");
        expectError(
                mockMvc.perform(get(API + "/resources/NAMESPACE/1?nodeId=11")).andExpect(status().isNotFound()),
                "RESOURCE_NOT_FOUND");
    }

    @Test
    @DisplayName("DETAIL-T06 Namespace 외 상세에 nodeId를 주거나 없는 종류면 400")
    void detailBadRequest() throws Exception {
        expectError(
                mockMvc.perform(get(API + "/resources/POD/1?nodeId=1")).andExpect(status().isBadRequest()),
                "INVALID_PARAMETER");
        expectError(
                mockMvc.perform(get(API + "/resources/DEPLOYMENT/1")).andExpect(status().isBadRequest()),
                "INVALID_PARAMETER");
    }

    @Test
    @DisplayName("공유 Namespace 상세는 클릭한 Node 경로를 지키고, 경로가 없으면 Pod가 있는 최소 ID Node를 쓴다")
    void sharedNamespaceDetailPath() throws Exception {
        jdbcTemplate.update("UPDATE pods SET node_id = 2 WHERE id = 1");

        mockMvc.perform(get(API + "/resources/NAMESPACE/1?nodeId=2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resource.path[1].id").value(2));
        mockMvc.perform(get(API + "/resources/NAMESPACE/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resource.path[1].id").value(1));
    }

    /************************************************************
     * 검색 : 시드의 case20only는 20건, case21only는 21건이다
     ************************************************************/
    private ResultActions search(String q, String page) throws Exception {
        var request = get(API + "/resources/search").param("q", q);
        if (page != null) {
            request.param("page", page);
        }
        return mockMvc.perform(request);
    }

    @Test
    @DisplayName("SEARCH-T03 검색 결과 0·20·21건에서 페이지와 hasNext가 맞다")
    void searchPageBoundaries() throws Exception {
        search("no-such-resource", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0))
                .andExpect(jsonPath("$.hasNext").value(false));
        search("case20only", null)
                .andExpect(jsonPath("$.items.length()").value(20))
                .andExpect(jsonPath("$.hasNext").value(false));
        search("case21only", null)
                .andExpect(jsonPath("$.items.length()").value(20))
                .andExpect(jsonPath("$.pageSize").value(20))
                .andExpect(jsonPath("$.hasNext").value(true));
        search("case21only", "1")
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test
    @DisplayName("SEARCH-T09 공백 검색어·음수 페이지·200자 초과 검색어는 400, 200자는 200")
    void searchInputValidation() throws Exception {
        expectError(search("   ", null).andExpect(status().isBadRequest()), "INVALID_PARAMETER");
        expectError(search("api", "-1").andExpect(status().isBadRequest()), "INVALID_PARAMETER");
        expectError(search("a".repeat(201), null).andExpect(status().isBadRequest()), "INVALID_PARAMETER");
        expectError(
                mockMvc.perform(get(API + "/resources/search")).andExpect(status().isBadRequest()),
                "INVALID_PARAMETER");
        search("a".repeat(200), null).andExpect(status().isOk());
        search("  " + "a".repeat(200) + "  ", null).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"%", "_", "!"})
    @DisplayName("SEARCH-T11 검색어의 %, _, !는 와일드카드가 아니라 글자로 찾는다")
    void searchLiteralWildcards(String q) throws Exception {
        search(q, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    /************************************************************
     * 필터 : 시드에서 Cluster 1·Node 1·Namespace 1은 NONE, Pod 1만 ERROR
     *        Namespace 177은 자기만 UNKNOWN(Node 18, UNKNOWN Pod 없음)
     ************************************************************/
    @Test
    @DisplayName("FILTER-T02 ERROR 필터에서 정상 부모는 PATH, 오류 Pod는 MATCH다")
    void filterMatchAndPath() throws Exception {
        mockMvc.perform(get(API + "/clusters?issueLevel=ERROR"))
                .andExpect(jsonPath("$.items[?(@.id == 1)].issueLevel").value("NONE"))
                .andExpect(jsonPath("$.items[?(@.id == 1)].matchRole").value("PATH"));
        mockMvc.perform(get(API + "/clusters/1/nodes?issueLevel=ERROR"))
                .andExpect(jsonPath("$.items[?(@.id == 1)].matchRole").value("PATH"));
        mockMvc.perform(get(API + "/nodes/1/namespaces?issueLevel=ERROR"))
                .andExpect(jsonPath("$.items[?(@.id == 1)].matchRole").value("PATH"));
        mockMvc.perform(get(API + "/nodes/1/namespaces/1/pods?issueLevel=ERROR"))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(1))
                .andExpect(jsonPath("$.items[0].matchRole").value("MATCH"));
    }

    @Test
    @DisplayName("FILTER-T05 검색어와 필터를 함께 쓰면 둘 다 만족하는 리소스만 나온다")
    void searchAndFilter() throws Exception {
        mockMvc.perform(get(API + "/resources/search").param("q", "api").param("issueLevel", "ERROR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].name").value("pod-payment-api-error"));
        mockMvc.perform(get(API + "/resources/search").param("q", "api").param("issueLevel", "WARNING"))
                .andExpect(jsonPath("$.items[0].name").value("pod-worker-API-warn"));
    }

    @Test
    @DisplayName("FILTER-T06 다른 Node의 오류 Pod 때문에 공유 Namespace가 잘못 노출되지 않는다")
    void sharedNamespaceFilterPerNode() throws Exception {
        jdbcTemplate.update("UPDATE pods SET node_id = 2 WHERE id = 1");

        mockMvc.perform(get(API + "/nodes/2/namespaces?issueLevel=ERROR"))
                .andExpect(jsonPath("$.items[?(@.id == 1)].matchRole").value("PATH"));
        mockMvc.perform(get(API + "/nodes/1/namespaces?issueLevel=ERROR"))
                .andExpect(jsonPath("$.items[?(@.id == 1)]").isEmpty());
    }

    @Test
    @DisplayName("FILTER-T09 자기만 일치하는 Namespace는 MATCH이고 그 아래 Pod 목록은 비어 있다")
    void selfMatchWithoutMatchingChildren() throws Exception {
        mockMvc.perform(get(API + "/nodes/18/namespaces?issueLevel=UNKNOWN"))
                .andExpect(jsonPath("$.items[?(@.id == 177)].matchRole").value("MATCH"));
        mockMvc.perform(get(API + "/nodes/18/namespaces/177/pods?issueLevel=UNKNOWN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    @DisplayName("정의되지 않은 심각도 필터는 400")
    void undefinedIssueLevel() throws Exception {
        expectError(
                mockMvc.perform(get(API + "/clusters?issueLevel=CRITICAL")).andExpect(status().isBadRequest()),
                "INVALID_PARAMETER");
    }
}
