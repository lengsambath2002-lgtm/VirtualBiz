package com.kosign.vbiz.config;

import jakarta.servlet.DispatcherType;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import com.kosign.vbiz.common.security.ApiErrorWriter;
import com.kosign.vbiz.common.security.JwtAuthenticationFilter;
import com.kosign.vbiz.common.security.SessionValidator;
import com.kosign.vbiz.common.security.JwtTokenService;
import com.kosign.vbiz.common.security.RestAccessDeniedHandler;
import com.kosign.vbiz.common.security.RestAuthenticationEntryPoint;
import com.kosign.vbiz.common.tenancy.TenancyFilter;
import com.kosign.vbiz.common.tenancy.TenantMembershipChecker;

/**
 * Stateless JWT security. Public: auth endpoints (except log out everywhere), health, meta, marketplace reads (GET),
 * the checkout quote, the ticket-opened event streams, API docs. Everything else needs a Bearer access token. 401/403 use the API envelope.
 * The browser reaches the API through the Next.js rewrite (same origin), so CORS stays off.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain apiSecurity(
            HttpSecurity http,
            JwtTokenService tokens,
            SessionValidator sessions,
            TenantMembershipChecker membership,
            ApiErrorWriter errorWriter,
            RestAuthenticationEntryPoint entryPoint,
            RestAccessDeniedHandler accessDenied) throws Exception {
        JwtAuthenticationFilter jwtFilter = new JwtAuthenticationFilter(tokens, sessions);
        TenancyFilter tenancyFilter = new TenancyFilter(membership, errorWriter);
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(e -> e.authenticationEntryPoint(entryPoint).accessDeniedHandler(accessDenied))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // SSE responses complete on async dispatches; the stream itself checked its ticket.
                        .dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll()
                        .requestMatchers("/api/auth/logout-all").authenticated()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/health", "/api/meta/**", "/api/staff-invites/**", "/api/join/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/marketplace/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/files/**").permitAll()
                        // Guests see server totals on the cart page (an address id still needs a token).
                        .requestMatchers(HttpMethod.POST, "/api/checkout/quote").permitAll()
                        // EventSource cannot send the bearer header: a single-use ticket opens the stream.
                        .requestMatchers(HttpMethod.GET, "/api/stream/me", "/api/stream/business").permitAll()
                        .requestMatchers("/api/docs", "/api/docs/**", "/api/swagger-ui/**").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                        .requestMatchers("/error").permitAll()
                        .anyRequest().authenticated())
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(tenancyFilter, JwtAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** No form/basic users; stops Boot from generating a default password. */
    @Bean
    public UserDetailsService noUsers() {
        return new InMemoryUserDetailsManager();
    }
}
