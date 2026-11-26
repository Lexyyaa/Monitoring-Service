package com.ocs.monitoring.domain.resource;

import com.ocs.monitoring.domain.resource.exception.ResourceException;

/************************************************************
 * 리소스 종류 (CLUSTER, NODE, NAMESPACE, POD)
 * 상세 API의 경로 값을 받을 때 종류로 바꾸고, 없는 값이면 400으로 막는다
 * nodeId를 받을 수 있는 종류를 여기서 정함으로써 Namespace가 아닌 상세에 경로 값이 잘못 붙는 것을 막는다
 ************************************************************/
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
