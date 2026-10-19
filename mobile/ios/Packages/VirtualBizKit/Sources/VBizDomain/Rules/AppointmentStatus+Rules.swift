import Foundation

/// The appointment state machine (open question #2: the provider's nine statuses are the source).
///
/// ```
/// REQUESTED ─▶ BOOKED ─▶ CONFIRMED ─▶ ARRIVED ─▶ STARTED ─▶ COMPLETED
///     │           │           │          └──────────────────▶ COMPLETED (checkout from arrived)
///     ├─▶ DECLINED├─▶ NO_SHOW ├─▶ NO_SHOW
///     └─▶ CANCELLED└▶ CANCELLED└▶ CANCELLED
/// ```
/// Walk-ins are created at `ARRIVED`. A request goes straight to `BOOKED` when auto-confirm is on.
public extension AppointmentStatus {
    var isTerminal: Bool {
        switch self {
        case .completed, .noShow, .cancelled, .declined: return true
        default: return false
        }
    }

    /// Occupies the calendar (the prototype's `active`).
    var holdsSlot: Bool { !(self == .cancelled || self == .noShow || self == .declined) }

    var allowedNext: Set<AppointmentStatus> {
        switch self {
        case .requested: return [.booked, .declined, .cancelled]
        case .booked: return [.confirmed, .arrived, .noShow, .cancelled]
        case .confirmed: return [.arrived, .noShow, .cancelled]
        case .arrived: return [.started, .completed]
        case .started: return [.completed]
        case .completed, .noShow, .cancelled, .declined: return []
        }
    }

    func canTransition(to next: AppointmentStatus) -> Bool { allowedNext.contains(next) }

    /// The status a new booking starts in.
    static func initial(source: AppointmentSource, autoConfirm: Bool) -> AppointmentStatus {
        if source == .walkIn { return .arrived }
        if source == .online { return autoConfirm ? .booked : .requested }
        return .booked
    }

    /// What the customer reads. "Requested" until the provider confirms (open question #2).
    var customerLabel: String {
        switch self {
        case .requested: return "Requested"
        case .booked, .confirmed: return "Confirmed"
        case .arrived, .started: return "In progress"
        case .completed: return "Completed"
        case .noShow: return "Missed"
        case .cancelled: return "Cancelled"
        case .declined: return "Declined"
        }
    }
}

public enum BookingRules {
    /// The customer may cancel or reschedule until `freeCancelHours` before the start.
    public static func customerCanChange(_ appointment: Appointment, startsAt: Date, now: Date,
                                         settings: BookingSettings) -> Bool {
        guard [.requested, .booked, .confirmed].contains(appointment.status) else { return false }
        let cutoff = startsAt.addingTimeInterval(-Double(settings.freeCancelHours) * 3600)
        return now <= cutoff
    }
}
