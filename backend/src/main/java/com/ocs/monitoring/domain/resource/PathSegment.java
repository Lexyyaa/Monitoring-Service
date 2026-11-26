package com.ocs.monitoring.domain.resource;

/************************************************************
 * 탐색 경로 한 단계 (종류, ID, 이름)
 * 상세와 검색 결과가 Cluster부터의 경로를 담을 때 쓴다
 ************************************************************/
public record PathSegment(ResourceType resourceType, long id, String name) {}
