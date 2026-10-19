package com.kosign.vbiz.notification.sse;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import lombok.extern.slf4j.Slf4j;

/**
 * In-memory fan-out of {@link StreamEvent}s to the open {@code text/event-stream} connections of
 * one API instance (docs/api/phase3-orders-checkout.md § Live updates). A multi-instance deployment
 * replaces the delivery with a shared bus behind the same publish side.
 */
@Slf4j
@Component
public class StreamHub {

    /** A stream closes after this long; the client reconnects with a new ticket. */
    static final Duration STREAM_TTL = Duration.ofMinutes(30);

    public enum Scope { USER, BUSINESS }

    private record Key(Scope scope, UUID id) {
    }

    private final Map<Key, Set<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Scope scope, UUID id) {
        SseEmitter emitter = new SseEmitter(STREAM_TTL.toMillis());
        Key key = new Key(scope, id);
        emitters.computeIfAbsent(key, k -> new CopyOnWriteArraySet<>()).add(emitter);
        Runnable remove = () -> {
            Set<SseEmitter> set = emitters.get(key);
            if (set != null) {
                set.remove(emitter);
                if (set.isEmpty()) {
                    emitters.remove(key, set);
                }
            }
        };
        emitter.onCompletion(remove);
        emitter.onTimeout(() -> {
            remove.run();
            emitter.complete();
        });
        emitter.onError(e -> remove.run());
        try {
            // Opens the stream at once (proxies flush) and tells the client how fast to retry.
            emitter.send(SseEmitter.event().name("ready").data("{}").reconnectTime(3000));
        } catch (IOException ex) {
            remove.run();
        }
        return emitter;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void on(StreamEvent e) {
        e.users().forEach(id -> send(new Key(Scope.USER, id), e.name(), e.data()));
        e.businesses().forEach(id -> send(new Key(Scope.BUSINESS, id), e.name(), e.data()));
    }

    /** Open connections (tests, health). */
    public int connections() {
        return emitters.values().stream().mapToInt(Set::size).sum();
    }

    private void send(Key key, String name, Object data) {
        Set<SseEmitter> set = emitters.get(key);
        if (set == null) {
            return;
        }
        for (SseEmitter em : set) {
            try {
                em.send(SseEmitter.event().name(name).data(data));
            } catch (IOException | IllegalStateException ex) {
                log.debug("Dropping stream {}: {}", key, ex.getMessage());
                set.remove(em);
                em.completeWithError(ex);
            }
        }
    }

    /** A comment line every 25 s keeps idle connections open through proxies. */
    @Scheduled(fixedRate = 25_000, initialDelay = 25_000)
    public void ping() {
        emitters.forEach((key, set) -> set.forEach(em -> {
            try {
                em.send(SseEmitter.event().comment("ping"));
            } catch (IOException | IllegalStateException ex) {
                set.remove(em);
            }
        }));
    }
}
