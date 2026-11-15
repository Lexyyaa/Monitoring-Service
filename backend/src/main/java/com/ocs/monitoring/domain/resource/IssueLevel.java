package com.ocs.monitoring.domain.resource;

import com.ocs.monitoring.domain.resource.exception.ResourceException;

public enum IssueLevel {
    NONE,
    WARNING,
    ERROR,
    UNKNOWN;

    public static IssueLevel from(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return valueOf(value.trim());
        } catch (IllegalArgumentException e) {
            throw ResourceException.invalidParameter();
        }
    }
}
