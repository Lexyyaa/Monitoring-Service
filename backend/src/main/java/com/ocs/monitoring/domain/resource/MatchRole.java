package com.ocs.monitoring.domain.resource;

/************************************************************
 * 필터 일치 역할
 * 필터를 건 트리 행을 만들 때 자기 심각도가 필터와 같으면 MATCH, 하위에 일치가 있어 경로로만 남으면 PATH를 붙인다
 * 필터가 없으면 null로 둠으로써 응답에서 matchRole 필드가 빠지게 한다
 ************************************************************/
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
