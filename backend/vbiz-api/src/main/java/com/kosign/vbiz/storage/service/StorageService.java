package com.kosign.vbiz.storage.service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.kosign.vbiz.common.api.StatusCode;
import com.kosign.vbiz.common.error.BusinessException;
import com.kosign.vbiz.storage.domain.FilePurpose;
import com.kosign.vbiz.storage.domain.StoredFile;
import com.kosign.vbiz.storage.payload.FileResponse;
import com.kosign.vbiz.storage.repository.StoredFileRepository;

import lombok.RequiredArgsConstructor;

/**
 * Image uploads (docs/api/phase6-files-profiles.md): checked by their bytes (JPEG, PNG or WebP,
 * at most {@code vbiz.storage.max-bytes}), kept by the {@link FileStore}, served at
 * {@code /api/files/{id}}. Profile, cover, logo and product photo fields only take the URL of a
 * file the caller uploaded for that purpose.
 */
@Service
@RequiredArgsConstructor
public class StorageService {

    public static final String URL_PREFIX = "/api/files/";
    private static final Pattern OWN_URL = Pattern.compile("^/api/files/([0-9a-fA-F-]{36})$");

    private final StoredFileRepository files;
    private final FileStore store;
    private final StorageProperties props;

    /** The bytes and type of a stored file, for serving. */
    public record Content(byte[] bytes, String contentType) {
    }

    @Transactional
    public FileResponse upload(UUID ownerId, FilePurpose purpose, MultipartFile file) {
        if (purpose == null) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "purpose", "Required");
        }
        if (file == null || file.isEmpty()) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, "file", "Choose an image");
        }
        if (file.getSize() > props.maxBytes()) {
            throw new BusinessException(StatusCode.FILE_TOO_LARGE);
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
        String type = sniff(bytes);
        if (type == null) {
            throw new BusinessException(StatusCode.UNSUPPORTED_FILE);
        }
        StoredFile f = new StoredFile();
        f.setOwnerId(ownerId);
        f.setPurpose(purpose);
        f.setContentType(type);
        f.setSizeBytes(bytes.length);
        UUID id = UUID.randomUUID();
        f.setStorageKey(purpose.name().toLowerCase(Locale.ROOT) + "/" + id + extension(type));
        try {
            store.put(f.getStorageKey(), bytes, type);
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
        f = files.saveAndFlush(f);
        return new FileResponse(f.getId().toString(), URL_PREFIX + f.getId(), purpose, type, bytes.length);
    }

    @Transactional(readOnly = true)
    public Optional<Content> read(UUID id) {
        return files.findById(id).map(f -> {
            try {
                byte[] b = store.get(f.getStorageKey());
                return b == null ? null : new Content(b, f.getContentType());
            } catch (IOException ex) {
                throw new UncheckedIOException(ex);
            }
        });
    }

    /**
     * {@code url} as an image field may hold it: empty clears it (null back); otherwise it must be
     * {@code /api/files/{id}} of a file {@code userId} uploaded for one of {@code purposes}.
     * {@code VALIDATION_FAILED} on {@code field} otherwise.
     */
    @Transactional(readOnly = true)
    public String requireOwnImage(String url, UUID userId, String field, Set<FilePurpose> purposes) {
        if (url == null || url.isBlank()) {
            return null;
        }
        Matcher m = OWN_URL.matcher(url.trim());
        StoredFile f = m.matches() ? parse(m.group(1)).flatMap(files::findById).orElse(null) : null;
        if (f == null || !userId.equals(f.getOwnerId()) || !purposes.contains(f.getPurpose())) {
            throw BusinessException.withDetail(StatusCode.VALIDATION_FAILED, field, "Upload the image first");
        }
        return URL_PREFIX + f.getId();
    }

    /** True for a {@code /api/files/{id}} URL (as opposed to an inline data URL). */
    public static boolean isFileUrl(String url) {
        return url != null && OWN_URL.matcher(url.trim()).matches();
    }

    /** The image type from the first bytes, or null when it is not JPEG, PNG or WebP. */
    static String sniff(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G'
                && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) {
            return "image/png";
        }
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "image/webp";
        }
        return null;
    }

    private static String extension(String type) {
        return switch (type) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
    }

    private static Optional<UUID> parse(String s) {
        try {
            return Optional.of(UUID.fromString(s));
        } catch (IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
