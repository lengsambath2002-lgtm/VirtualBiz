import Foundation

public enum HTTPMethod: String, Sendable {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

/// A typed description of one API call. `Response` is the envelope's `data` type.
///
/// Hand-written until `docs/api/openapi.json` exists; then the generated client replaces the
/// endpoint catalogue and this stays as the seam the repositories call through.
public struct Endpoint<Response: Decodable & Sendable>: Sendable {
    public var method: HTTPMethod
    /// Relative to the API base URL, e.g. `/api/v1/shops`.
    public var path: String
    public var query: [URLQueryItem]
    public var body: Data?
    public var requiresAuth: Bool

    public init(method: HTTPMethod = .get, path: String, query: [URLQueryItem] = [], body: Data? = nil,
                requiresAuth: Bool = true) {
        self.method = method
        self.path = path
        self.query = query
        self.body = body
        self.requiresAuth = requiresAuth
    }

    /// Builds the `URLRequest` against `baseURL`.
    public func urlRequest(baseURL: URL, accessToken: String?, locale: String) -> URLRequest? {
        guard var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)
        else { return nil }
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { return nil }
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(locale, forHTTPHeaderField: "Accept-Language")
        if body != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if requiresAuth, let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        return request
    }
}
