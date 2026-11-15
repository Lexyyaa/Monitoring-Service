package com.ocs.monitoring.support;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class TestDatabaseIsolationTest {

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("통합 테스트는 개발 DB가 아닌 테스트 전용 DB에 접속한다")
    void connectsToTestDatabase() {
        String database = jdbcTemplate.queryForObject("SELECT current_database()", String.class);

        assertThat(database).isEqualTo("monitoring_test");
    }
}
