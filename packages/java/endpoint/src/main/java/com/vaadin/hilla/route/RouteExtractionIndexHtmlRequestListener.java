package com.vaadin.hilla.route;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaadin.flow.router.PageTitle;
import com.vaadin.flow.router.RouteData;
import com.vaadin.flow.server.RouteRegistry;
import com.vaadin.flow.server.VaadinService;
import com.vaadin.flow.server.communication.IndexHtmlRequestListener;
import com.vaadin.flow.server.communication.IndexHtmlResponse;
import com.vaadin.hilla.route.records.AvailableViewInfo;
import com.vaadin.hilla.route.records.RouteParamType;
import org.jsoup.nodes.DataNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Index HTML request listener for collecting
 * the client side and the server side views
 * and adding them to index.html response.
 */
@Component
public class RouteExtractionIndexHtmlRequestListener
        implements IndexHtmlRequestListener {
    protected static final String SCRIPT_STRING = "window.Vaadin = window.Vaadin ?? {}; "
            + " window.Vaadin.server = window.Vaadin.server ?? {}; "
            + " window.Vaadin.server.views = %s;";
    private static final Logger LOGGER = LoggerFactory
            .getLogger(RouteExtractionIndexHtmlRequestListener.class);
    private final ObjectMapper mapper = new ObjectMapper();

    private final ClientRouteRegistry clientRouteRegistry;

    /**
     * Creates a new listener instance with the given route registry.
     * @param clientRouteRegistry the client route registry
     *                            for getting the client side views
     */
    @Autowired
    public RouteExtractionIndexHtmlRequestListener(ClientRouteRegistry clientRouteRegistry) {
        this.clientRouteRegistry = clientRouteRegistry;
    }

    @Override
    public void modifyIndexHtmlResponse(IndexHtmlResponse response) {
        final List<AvailableViewInfo> availableViews = new ArrayList<>();
        collectClientViews(availableViews);
        collectServerViews(availableViews);

        if (availableViews.isEmpty()) {
            return;
        }
        try {
            final String viewsJson = mapper.writeValueAsString(availableViews);
            final String script = SCRIPT_STRING.formatted(viewsJson);
            response.getDocument().head().appendElement("script")
                    .appendChild(new DataNode(script));
        } catch (IOException e) {
            LOGGER.warn("Failed to write server views to index response", e);
        }

    }

    protected void collectClientViews(List<AvailableViewInfo> availableViews) {
        clientRouteRegistry.getAllRoutes().forEach(route -> {
            final AvailableViewInfo availableViewInfo = new AvailableViewInfo(route.title(),
                route.rolesAllowed(), route.route(), route.lazy(),
                route.register(), route.menu(), route.routeParameters());
            availableViews.add(availableViewInfo);
        });

    }

    protected void collectServerViews(final List<AvailableViewInfo> serverViews) {
        final RouteRegistry serverRouteRegistry = VaadinService.getCurrent().getRouter()
                .getRegistry();
        serverRouteRegistry.getRegisteredRoutes().forEach(serverView -> {
            final Class<? extends com.vaadin.flow.component.Component> viewClass = serverView
                    .getNavigationTarget();
            final String targetUrl = serverView.getTemplate();
            if (targetUrl != null) {
                final String url = "/" + targetUrl;

                final String title;
                PageTitle pageTitle = viewClass.getAnnotation(PageTitle.class);
                if (pageTitle != null) {
                    title = pageTitle.value();
                } else {
                    title = serverView.getNavigationTarget().getSimpleName();
                }

                final Map<String, RouteParamType> routeParameters = getRouteParameters(serverView);

                final AvailableViewInfo availableViewInfo = new AvailableViewInfo(title,
                    null, url, false, false, null, routeParameters) ;
                serverViews.add(availableViewInfo);
            }
        });
    }

    private Map<String, RouteParamType> getRouteParameters(RouteData serverView) {
        final Map<String, RouteParamType> routeParameters = new HashMap<>();
        serverView.getRouteParameters().forEach((route, params) -> {
            if(params.getTemplate().contains("*")) {
                routeParameters.put(params.getTemplate(), RouteParamType.WILDCARD);
            } else if(params.getTemplate().contains("?")) {
                routeParameters.put(params.getTemplate(), RouteParamType.OPTIONAL);
            } else {
                routeParameters.put(params.getTemplate(), RouteParamType.REQUIRED);
            }
        });
        return routeParameters;
    }

}
