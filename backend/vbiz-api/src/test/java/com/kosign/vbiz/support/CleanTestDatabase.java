package com.kosign.vbiz.support;

import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/** Wipes and re-migrates the test database once per context. Refuses anything not named *_test. */
@TestConfiguration(proxyBeanMethods = false)
public class CleanTestDatabase {

    @Bean
    public FlywayMigrationStrategy cleanMigrate() {
        return flyway -> {
            String url = flyway.getConfiguration().getUrl();
            if (url == null) {
                try (var c = flyway.getConfiguration().getDataSource().getConnection()) {
                    url = c.getMetaData().getURL();
                } catch (java.sql.SQLException ex) {
                    throw new IllegalStateException(ex);
                }
            }
            if (url == null || !url.replaceAll("\\?.*$", "").endsWith("_test")) {
                throw new IllegalStateException("Refusing to clean a non-test database: " + url);
            }
            flyway.clean();
            flyway.migrate();
        };
    }
}
