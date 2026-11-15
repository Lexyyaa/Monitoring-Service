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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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
}
