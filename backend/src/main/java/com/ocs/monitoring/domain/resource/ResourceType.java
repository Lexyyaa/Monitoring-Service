package com.ocs.monitoring.domain.resource;

import com.ocs.monitoring.domain.resource.exception.ResourceException;

public enum ResourceType {
    CLUSTER,
    NODE,
    NAMESPACE,
    POD;

    public static ResourceType from(String value) {
        try {
            return valueOf(value.trim());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw ResourceException.invalidParameter();
        }
    }

    /************************************************************
     * nodeId(트리에서 클릭한 Node 경로)는 Namespace 상세에서만 의미가 있다
     * 공유 Namespace는 여러 Node 아래에 나타나므로 어느 경로로 열었는지가 필요하다
     ************************************************************/
    public void requireNodeContextAllowed(Long nodeId) {
        if (nodeId != null && this != NAMESPACE) {
            throw ResourceException.invalidParameter();
        }
    }
}
