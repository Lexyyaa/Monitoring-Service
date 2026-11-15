/************************************************************************
 * 전역 예외 처리 테스트 (WebMvcTest, DB 없이 실행)
 * ApplicationService를 목으로 바꿔 DB 장애는 503, 예상 못한 오류는 내부 정보 없이 500인지 확인한다
 ************************************************************************/
package com.ocs.monitoring.support.exception;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ocs.monitoring.application.resource.ResourceApplicationService;
import com.ocs.monitoring.presentation.controller.resource.ResourceController;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.CannotCreateTransactionException;

@WebMvcTest(ResourceController.class)
class GlobalExceptionHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ResourceApplicationService resourceApplicationService;

    @Test
    @DisplayName("UNIT-05 조회 중이나 트랜잭션 시작 때 DB 연결이 실패하면 503")
    void dbFailureIs503() throws Exception {
        given(resourceApplicationService.listClusters())
                .willThrow(new DataAccessResourceFailureException("db down"))
                .willThrow(new CannotCreateTransactionException("no connection"));

        for (int attempt = 0; attempt < 2; attempt++) {
            mockMvc.perform(get("/api/v1/clusters"))
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.code").value("SERVICE_UNAVAILABLE"));
        }
    }

    @Test
    @DisplayName("UNIT-06 예상하지 못한 오류는 내부 메시지 없이 500")
    void unexpectedErrorIs500() throws Exception {
        given(resourceApplicationService.listClusters()).willThrow(new IllegalStateException("secret bug"));

        mockMvc.perform(get("/api/v1/clusters"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(content().string(Matchers.not(Matchers.containsString("secret bug"))));
    }
}
