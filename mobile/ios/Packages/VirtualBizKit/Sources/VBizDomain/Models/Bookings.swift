import Foundation

public struct AppointmentLogEntry: Sendable, Hashable, Codable {
    public var text: String
    public var at: Date

    public init(text: String, at: Date) {
        self.text = text
        self.at = at
    }
}

public struct Appointment: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    /// `BK-00001` (open question #9) — see `DisplayNumber`.
    public var number: String
    public var businessId: String
    public var clientId: String
    public var serviceId: String
    public var staffId: String
    public var date: LocalDate
    /// Minutes from midnight.
    public var start: Int
    public var durationMin: Int
    public var price: Money
    public var status: AppointmentStatus
    public var source: AppointmentSource
    public var note: String?
    public var log: [AppointmentLogEntry]
    public var saleId: String?

    public init(id: String, number: String, businessId: String, clientId: String, serviceId: String,
                staffId: String, date: LocalDate, start: Int, durationMin: Int, price: Money,
                status: AppointmentStatus, source: AppointmentSource, note: String? = nil,
                log: [AppointmentLogEntry] = [], saleId: String? = nil) {
        self.id = id
        self.number = number
        self.businessId = businessId
        self.clientId = clientId
        self.serviceId = serviceId
        self.staffId = staffId
        self.date = date
        self.start = start
        self.durationMin = durationMin
        self.price = price
        self.status = status
        self.source = source
        self.note = note
        self.log = log
        self.saleId = saleId
    }

    public var end: Int { start + durationMin }
    public var timeRange: MinuteRange { MinuteRange(start: start, end: end) }
}

public struct Block: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var businessId: String
    public var staffId: String
    public var date: LocalDate
    public var start: Int
    public var durationMin: Int
    public var reason: BlockReason
}

/// A business's CRM record of a customer. Order count, spend and last visit are derived.
public struct Client: Sendable, Hashable, Codable, Identifiable {
    public var id: String
    public var businessId: String
    public var name: String
    public var phone: String
    public var email: String?
    public var note: String?
    public var district: String?
    public var since: Date
    public var tags: [String]
}
