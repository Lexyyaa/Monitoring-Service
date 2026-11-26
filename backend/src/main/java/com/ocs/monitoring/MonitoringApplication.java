package com.ocs.monitoring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/************************************************************
 * Spring Boot 시작점
 * 애플리케이션을 띄울 때 이 패키지 아래의 빈을 찾아 등록한다
 ************************************************************/
@SpringBootApplication
public class MonitoringApplication {

    public static void main(String[] args) {
        SpringApplication.run(MonitoringApplication.class, args);
    }
}
