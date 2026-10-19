import Foundation

public enum APIError: Error, Sendable, Equatable {
    /// No connection, timeout, TLS failure.
    case transport(String)
    /// The server refused the request; `code` is the envelope's `status.code`.
    case server(httpStatus: Int, code: String?, type: String?, message: String?, fields: [String: String])
    /// 401 — the session must be refreshed or the user signed out.
    case unauthorized
    /// The body was not the expected shape.
    case decoding(String)
    /// A 2xx envelope without `data` where data was required.
    case emptyData
}
