package com.kosign.vbiz.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;

/** OpenAPI document (/api/docs/openapi.json) and Swagger UI (/api/docs). */
@Configuration
public class OpenApiConfig {

    private static final String BEARER = "bearer";

    @Bean
    public OpenAPI vbizOpenApi(@Value("${vbiz.version:dev}") String version) {
        return new OpenAPI()
                .info(new Info()
                        .title("VirtualBiz API")
                        .version(version)
                        .description("Every response uses the ApiResponse envelope; error codes are StatusCode names. "
                                + "Contract: docs/api/phase1-auth-account-business.md"))
                .components(new Components().addSecuritySchemes(BEARER, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER));
    }
}
