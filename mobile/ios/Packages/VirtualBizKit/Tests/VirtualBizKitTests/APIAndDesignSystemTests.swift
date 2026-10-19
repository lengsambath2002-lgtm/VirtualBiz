import Foundation
import Testing
@testable import VBizAPI
@testable import VBizDesignSystem

private struct Shop: Decodable, Sendable, Equatable { let id: String }

@Test("a success envelope yields its data")
func envelopeSuccess() throws {
    let body = Data(#"{"status":{"code":"SUCCESS","message":"OK"},"data":{"id":"happy-coffee"},"common":{"requestId":"r1","timestamp":"2026-10-09T05:30:00Z"}}"#.utf8)
    #expect(try APIResponseDecoder.decode(Shop.self, httpStatus: 200, body: body) == Shop(id: "happy-coffee"))
}

@Test("an error envelope maps to APIError.server with field messages; 401 is unauthorized")
func envelopeFailure() {
    let body = Data(#"{"status":{"code":"INVALID_INPUT","message":"Check the form"},"error":{"type":"VALIDATION","details":[{"field":"phone","message":"Invalid phone"}]}}"#.utf8)
    #expect(throws: APIError.server(httpStatus: 400, code: "INVALID_INPUT", type: "VALIDATION",
                                    message: "Check the form", fields: ["phone": "Invalid phone"])) {
        try APIResponseDecoder.decode(Shop.self, httpStatus: 400, body: body)
    }
    #expect(throws: APIError.unauthorized) {
        try APIResponseDecoder.decode(Shop.self, httpStatus: 401, body: Data())
    }
}

@Test("an endpoint builds a request with auth, locale and query")
func endpointRequest() throws {
    let endpoint = Endpoint<Shop>(path: "/api/v1/shops", query: [URLQueryItem(name: "district", value: "bkk1")])
    let base = try #require(URL(string: "https://api.example.com"))
    let request = try #require(endpoint.urlRequest(baseURL: base, accessToken: "t0k", locale: "km"))
    #expect(request.url?.absoluteString == "https://api.example.com/api/v1/shops?district=bkk1")
    #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer t0k")
    #expect(request.value(forHTTPHeaderField: "Accept-Language") == "km")
}

@Test("design tokens carry the prototype's brand values in both appearances")
func brandTokens() {
    #expect(VBiz.Swatch.ink.light == 0x141A2B)
    #expect(VBiz.Swatch.primary.light == 0x1C2438)
    #expect(VBiz.Swatch.primary.dark == 0xF5B800)
    #expect(VBiz.Swatch.accent.light == 0xF5B800 && VBiz.Swatch.accent.dark == 0xF5B800)
    #expect(VBiz.Swatch.background.light == 0xF2F2F7 && VBiz.Swatch.background.dark == 0x000000)
    #expect(VBiz.Swatch.tints.count == 6)
    #expect(VBiz.Swatch.tint(7) == VBiz.Swatch.tint(1))
    #expect(VBiz.Radius.small == 12 && VBiz.Radius.medium == 20 && VBiz.Radius.large == 28)
    #expect(VBizIcon.symbol(for: "cup") == "cup.and.saucer")
}
