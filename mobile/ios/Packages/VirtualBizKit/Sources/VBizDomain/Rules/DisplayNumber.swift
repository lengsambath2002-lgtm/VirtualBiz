import Foundation

/// Human-facing document numbers (domain-model.md "IDs", open question #9).
public enum DisplayNumber: String, Sendable, CaseIterable {
    case order = "VB"
    case booking = "BK"
    case posReceipt = "R"
    case providerSale = "S"

    private static let digits = 5

    /// `DisplayNumber.order.format(38)` -> `VB-00038`.
    public func format(_ sequence: Int) -> String {
        let padded = String(sequence)
        let zeros = String(repeating: "0", count: max(0, DisplayNumber.digits - padded.count))
        return "\(rawValue)-\(zeros)\(padded)"
    }

    /// The sequence number back out of `VB-00038`, or `nil` for a different kind or bad input.
    public func sequence(of number: String) -> Int? {
        let prefix = "\(rawValue)-"
        guard number.hasPrefix(prefix) else { return nil }
        return Int(number.dropFirst(prefix.count))
    }
}
