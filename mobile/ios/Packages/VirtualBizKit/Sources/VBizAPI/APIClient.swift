import Foundation

/// The seam between repositories and the network. The live implementation (URLSession, token
/// refresh) arrives with the first real endpoint; repositories depend only on this protocol.
public protocol APIClient: Sendable {
    func send<Response: Decodable & Sendable>(_ endpoint: Endpoint<Response>) async throws -> Response
}

/// Decodes an HTTP response into the envelope's payload or a mapped `APIError`.
public enum APIResponseDecoder {
    public static func makeJSONDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let text = try container.decode(String.self)
            if let date = try? Date(text, strategy: .iso8601) { return date }
            let fractional = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
            if let date = try? fractional.parse(text) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Not ISO-8601: \(text)")
        }
        return decoder
    }

    public static func decode<Response: Decodable & Sendable>(
        _ type: Response.Type, httpStatus: Int, body: Data, decoder: JSONDecoder = makeJSONDecoder()
    ) throws -> Response {
        if httpStatus == 401 { throw APIError.unauthorized }
        let envelope: APIEnvelope<Response>
        do {
            envelope = try decoder.decode(APIEnvelope<Response>.self, from: body)
        } catch {
            if (200..<300).contains(httpStatus) { throw APIError.decoding(String(describing: error)) }
            throw APIError.server(httpStatus: httpStatus, code: nil, type: nil, message: nil, fields: [:])
        }
        guard (200..<300).contains(httpStatus), envelope.error == nil else {
            var fields: [String: String] = [:]
            for detail in envelope.error?.details ?? [] {
                if let field = detail.field { fields[field] = detail.message ?? "" }
            }
            throw APIError.server(httpStatus: httpStatus, code: envelope.status?.code,
                                  type: envelope.error?.type, message: envelope.status?.message, fields: fields)
        }
        if let data = envelope.data { return data }
        if let empty = EmptyPayload() as? Response { return empty }
        throw APIError.emptyData
    }
}
