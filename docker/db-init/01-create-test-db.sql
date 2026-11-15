-- 백엔드 통합 테스트 전용 DB. 개발 DB(monitoring)와 분리해 테스트가 개발 데이터를 건드리지 않게 한다
-- PostgreSQL 컨테이너가 빈 볼륨으로 처음 뜰 때만 실행된다
CREATE DATABASE monitoring_test OWNER monitoring;
