import Foundation

/// The wrapper every VirtualBiz endpoint returns, success or failure — mirrors
/// `com.kosign.vbiz.common.api.ApiResponse` (`{status, data, common, error}`).
///
/// Every field is optional: the backend serialises with `@JsonInclude(NON_NULL)`, so a null value
/// is omitted from the JSON rather than sent as `null`, and a non-optional property would throw
/// `keyNotFound` on an ordinary response.
public struct APIEnvelope<Payload: Decodable & Sendable>: Decodable, Sendable {
    public struct Status: Decodable, Sendable, Equatable {
        /// A `StatusCode` name, e.g. `SUCCESS`. The client translates it; never show it raw.
        public let code: String?
        public let message: String?
    }

    public struct Detail: Decodable, Sendable, Equatable {
        public let field: String?
        public let message: String?
    }

    public struct ErrorBody: Decodable, Sendable, Equatable {
        /// An `ErrorType` name (`VALIDATION`, `NOT_FOUND`, …).
        public let type: String?
        public let details: [Detail]?
    }

    public struct Common: Decodable, Sendable, Equatable {
        public let requestId: String?
        public let timestamp: Date?
    }

    public let status: Status?
    public let data: Payload?
    public let common: Common?
    public let error: ErrorBody?
}

/// An empty `data` (for endpoints that return only a status).
public struct EmptyPayload: Decodable, Sendable, Equatable {
    public init() {}
}
