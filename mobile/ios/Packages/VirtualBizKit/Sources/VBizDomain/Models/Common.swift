import Foundation

/// A time-of-day span in minutes from midnight, `[start, end)`. On the wire it is a two-element
/// array (`[480, 1080]` = 08:00–18:00), as in `Business.hours` and `BusinessMember.shifts`.
public struct MinuteRange: Sendable, Hashable, Codable {
    public var start: Int
    public var end: Int

    public init(start: Int, end: Int) {
        self.start = start
        self.end = end
    }

    public init(from decoder: any Decoder) throws {
        var container = try decoder.unkeyedContainer()
        start = try container.decode(Int.self)
        end = try container.decode(Int.self)
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.unkeyedContainer()
        try container.encode(start)
        try container.encode(end)
    }

    public func contains(minute: Int) -> Bool { minute >= start && minute < end }
    public var durationMinutes: Int { end - start }
}

/// A calendar date in `Asia/Phnom_Penh`, as `YYYY-MM-DD` (appointment `date`, closures).
public typealias LocalDate = String

public enum TimeOfDay {
    public static let minutesPerHour = 60

    /// `630` -> `10:30`.
    public static func text(_ minutes: Int) -> String {
        let hours = minutes / minutesPerHour
        let mins = minutes % minutesPerHour
        return String(format: "%02d:%02d", hours, mins)
    }
}
