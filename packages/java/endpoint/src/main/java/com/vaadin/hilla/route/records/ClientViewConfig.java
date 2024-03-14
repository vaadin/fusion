package com.vaadin.hilla.route.records;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Implementation of TypeScript's Hilla ConfigView. Represents a view
 * configuration from Hilla file-system-routing module.
 *
 * @see <a href=
 *      "https://github.com/vaadin/hilla/tree/main/packages/ts/hilla-file-router/src/utils.ts#L3">ConfigView</a>
 */
public final class ClientViewConfig {
    private String title;
    private String[] rolesAllowed;
    private Boolean requiresLogin;
    private String route;
    private Boolean lazy;
    private Boolean register;
    private ClientViewMenuConfig menu;
    private List<ClientViewConfig> children;
    @JsonProperty("params")
    private Map<String, RouteParamType> routeParameters;
    private final Map<String, Object> other;
    private ClientViewConfig parent;

    public ClientViewConfig() {
        other = new HashMap<>();
    }

    /**
     * Add a key-value pair for all unknown fields.
     *
     * @param key
     *            - the key
     * @param value
     *            - the value
     */
    @JsonAnySetter
    public void add(String key, Object value) {
        other.put(key, value);
    }

    /**
     * Get all unknown values.
     *
     * @return a map of unknown values
     */
    @JsonAnyGetter
    public Map<String, Object> getOther() {
        return other;
    }

    public String getTitle() {
        return title;
    }

    public String[] getRolesAllowed() {
        return rolesAllowed;
    }

    public Boolean isRequiresLogin() {
        return requiresLogin;
    }

    public String getRoute() {
        return route;
    }

    public Boolean isLazy() {
        return lazy;
    }

    public Boolean isRegister() {
        return register;
    }

    public ClientViewMenuConfig menu() {
        return menu;
    }

    public List<ClientViewConfig> getChildren() {
        return children;
    }

    @JsonProperty("params")
    public Map<String, RouteParamType> getRouteParameters() {
        return routeParameters;
    }

    public ClientViewConfig getParent() {
        return parent;
    }

    public void setParent(ClientViewConfig parent) {
        this.parent = parent;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setRolesAllowed(String[] rolesAllowed) {
        this.rolesAllowed = rolesAllowed;
    }

    public void setRequiresLogin(Boolean requiresLogin) {
        this.requiresLogin = requiresLogin;
    }

    public void setRoute(String route) {
        this.route = route;
    }

    public void setLazy(Boolean lazy) {
        this.lazy = lazy;
    }

    public void setRegister(Boolean register) {
        this.register = register;
    }

    public void setMenu(ClientViewMenuConfig menu) {
        this.menu = menu;
    }

    public void setChildren(List<ClientViewConfig> children) {
        this.children = children;
    }

    public void setRouteParameters(
            Map<String, RouteParamType> routeParameters) {
        this.routeParameters = routeParameters;
    }
}
