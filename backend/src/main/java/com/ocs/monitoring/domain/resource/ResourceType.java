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
}
