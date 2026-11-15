package com.ocs.monitoring.domain.resource;

import java.util.Optional;

/** ID로 리소스 한 건을 읽는다. 판단은 하지 않는다 */
public interface ResourceRepository {

    Optional<Cluster> findCluster(long id);

    Optional<Node> findNode(long id);

    Optional<Namespace> findNamespace(long id);
}
