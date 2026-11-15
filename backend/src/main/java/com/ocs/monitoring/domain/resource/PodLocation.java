package com.ocs.monitoring.domain.resource;

public record PodLocation(Pod pod, Cluster cluster, Node node, Namespace namespace) {

    public ResourceDetail toDetail() {
        return pod.toDetail(cluster, node, namespace);
    }
}
