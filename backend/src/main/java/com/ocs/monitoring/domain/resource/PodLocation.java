package com.ocs.monitoring.domain.resource;

/************************************************************
 * Pod와 부모 세 개의 묶음
 * Pod 상세를 만들 때 조인 한 번으로 읽은 Pod, Cluster, Node, Namespace를 담는다
 * 함께 묶음으로써 상세 경로를 Pod가 실제로 배치된 위치로 만든다
 ************************************************************/
public record PodLocation(Pod pod, Cluster cluster, Node node, Namespace namespace) {

    public ResourceDetail toDetail() {
        return pod.toDetail(cluster, node, namespace);
    }
}
