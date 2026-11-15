package com.ocs.monitoring.domain.resource;

/** 필터 일치 역할. MATCH는 자기 심각도가 필터와 같음, PATH는 아래에 일치하는 리소스가 있어 경로로 표시 */
public enum MatchRole {
    MATCH,
    PATH;

    public static MatchRole of(IssueLevel own, IssueLevel filter) {
        if (filter == null) {
            return null;
        }
        return own == filter ? MATCH : PATH;
    }
}
