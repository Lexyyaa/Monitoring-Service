package com.ocs.monitoring.support.config;

import com.querydsl.jpa.JPQLTemplates;
import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/************************************************************
 * QueryDSL 설정
 * 트리, 상세 조회 구현이 쿼리를 만들 때 쓰는 JPAQueryFactory를 빈으로 등록한다
 ************************************************************/
@Configuration
public class QuerydslConfig {

    @Bean
    public JPAQueryFactory jpaQueryFactory(EntityManager entityManager) {
        return new JPAQueryFactory(JPQLTemplates.DEFAULT, entityManager);
    }
}
