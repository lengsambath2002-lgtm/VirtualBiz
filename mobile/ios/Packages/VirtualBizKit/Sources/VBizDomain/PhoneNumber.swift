import Foundation

/// A Cambodian phone number, stored normalized as `0XXXXXXXX` (9 or 10 digits).
///
/// Rules (domain-model.md "Phone", open question #14):
/// - `+855` and `855` are rewritten to the leading `0`.
/// - Spaces, dashes, dots and brackets are ignored.
/// - The normalized value must match `^0[1-9]\d{7,8}$`.
public struct PhoneNumber: Sendable, Hashable, Codable, CustomStringConvertible {
    public static let countryCode = "855"

    /// The normalized digits, e.g. `0968189261`.
    public let value: String

    /// Fails when the input does not normalize to a valid number.
    public init?(_ raw: String) {
        let normalized = PhoneNumber.normalize(raw)
        guard PhoneNumber.isValidNormalized(normalized) else { return nil }
        value = normalized
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try container.decode(String.self)
        guard let phone = PhoneNumber(raw) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid phone number: \(raw)")
        }
        self = phone
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(value)
    }

    public var description: String { value }

    /// Strips formatting and rewrites the country code. Does not validate.
    public static func normalize(_ raw: String) -> String {
        let ignored: Set<Character> = [" ", "-", ".", "(", ")", "\u{00A0}"]
        var digits = String(raw.filter { !ignored.contains($0) })
        if digits.hasPrefix("+") { digits.removeFirst() }
        if digits.hasPrefix(countryCode), digits.count > countryCode.count + 6 {
            let national = digits.dropFirst(countryCode.count)
            // `+855 012 …` (a trunk zero kept after the country code) is common on forms.
            digits = national.hasPrefix("0") ? String(national) : "0" + national
        }
        return digits
    }

    public static func isValid(_ raw: String) -> Bool {
        isValidNormalized(normalize(raw))
    }

    static func isValidNormalized(_ digits: String) -> Bool {
        digits.wholeMatch(of: /0[1-9][0-9]{7,8}/) != nil
    }

    /// `096 818 9261` (10 digits) or `012 345 678` (9 digits) — the prototype's display grouping.
    public var formatted: String {
        let chars = Array(value)
        let head = String(chars[0..<3])
        let middle = String(chars[3..<6])
        let tail = String(chars[6...])
        return "\(head) \(middle) \(tail)"
    }
}
