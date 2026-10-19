package com.kosign.vbiz;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Scans both modules: {@code vbiz-common} and {@code vbiz-api} share the {@code com.kosign.vbiz} root. */
@SpringBootApplication(scanBasePackages = "com.kosign.vbiz")
@EntityScan(basePackages = "com.kosign.vbiz")
@EnableJpaRepositories(basePackages = "com.kosign.vbiz")
@ConfigurationPropertiesScan(basePackages = "com.kosign.vbiz")
@EnableScheduling
public class VbizApplication {

    public static void main(String[] args) {
        // Instants are stored and processed in UTC; Asia/Phnom_Penh is a display concern.
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        SpringApplication.run(VbizApplication.class, args);
    }
}
