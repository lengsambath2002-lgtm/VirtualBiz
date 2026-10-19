import Foundation
import Testing
@testable import VBizDomain

@Test("delivery orders run NEW → ACCEPTED → PACKED → SHIPPED → DELIVERED → RETURNED")
func deliveryFlow() {
    let path: [OrderStatus] = [.new, .accepted, .packed, .shipped, .delivered, .returned]
    for (from, to) in zip(path, path.dropFirst()) {
        #expect(from.canTransition(to: to, method: .delivery), "\(from) -> \(to)")
    }
    #expect(!OrderStatus.packed.canTransition(to: .pickedUp, method: .delivery))
    #expect(!OrderStatus.new.canTransition(to: .shipped, method: .delivery))
    #expect(!OrderStatus.shipped.canTransition(to: .cancelled, method: .delivery))
}

@Test("pickup orders skip SHIPPED: PACKED is 'Ready for pickup', then PICKED_UP")
func pickupFlow() {
    #expect(OrderStatus.packed.canTransition(to: .pickedUp, method: .pickup))
    #expect(!OrderStatus.packed.canTransition(to: .shipped, method: .pickup))
    #expect(OrderStatus.pickedUp.canTransition(to: .returned, method: .pickup))
    #expect(OrderStatus.packed.customerLabel(method: .pickup) == "Ready for pickup")
    #expect(OrderStatus.packed.customerLabel(method: .delivery) == "Ready")
}

@Test("cancelled and returned are terminal; cancel is allowed up to PACKED")
func terminalOrders() {
    for status in OrderStatus.allCases where status.isTerminal {
        #expect(status.allowedNext(method: .delivery).isEmpty)
        #expect(status.allowedNext(method: .pickup).isEmpty)
    }
    for status in [OrderStatus.new, .accepted, .packed] {
        #expect(status.canTransition(to: .cancelled, method: .delivery))
    }
}

@Test("every order status has a customer label and a localization key")
func customerLabels() {
    let expected: [OrderStatus: String] = [.new: "Order placed", .accepted: "Preparing", .shipped: "On the way",
                                           .delivered: "Delivered", .pickedUp: "Picked up", .cancelled: "Cancelled",
                                           .returned: "Returned"]
    for (status, label) in expected { #expect(status.customerLabel(method: .delivery) == label) }
    #expect(OrderStatus.pickedUp.customerLabelKey(method: .pickup) == "order.status.pickedUp")
    #expect(OrderStatus.packed.customerLabelKey(method: .pickup) == "order.status.readyForPickup")
}

@Test("order time rules: 5-minute customer cancel, 1-hour auto-cancel, 7-day returns, 5% online commission")
func orderTimeRules() {
    let created = Date(timeIntervalSince1970: 1_791_523_800)
    let order = Order(id: "o", number: "VB-00001", businessId: "b", customerId: "c",
                      lines: [OrderLine(variantId: "v", title: "t", variantName: "", qty: 2, unitPrice: Money(10))],
                      subtotal: Money(20), discount: .zero, deliveryFee: .zero, total: Money(20),
                      payment: Payment(method: .khqr, channel: .online, paid: true), method: .delivery,
                      status: .new, timeline: [OrderTimelineEntry(status: .new, at: created)], createdAt: created)
    #expect(OrderRules.customerCanCancel(order, now: created.addingTimeInterval(299)))
    #expect(!OrderRules.customerCanCancel(order, now: created.addingTimeInterval(301)))
    #expect(!OrderRules.shouldAutoCancel(order, now: created.addingTimeInterval(3600)))
    #expect(OrderRules.shouldAutoCancel(order, now: created.addingTimeInterval(3601)))
    #expect(OrderRules.commission(on: order) == Money(1))

    var delivered = order
    delivered.status = .delivered
    delivered.timeline.append(OrderTimelineEntry(status: .delivered, at: created))
    #expect(OrderRules.canReturn(delivered, now: created.addingTimeInterval(6 * 86_400)))
    #expect(!OrderRules.canReturn(delivered, now: created.addingTimeInterval(8 * 86_400)))

    var cod = order
    cod.payment = Payment(method: .cash, channel: .cod, paid: false)
    #expect(OrderRules.commission(on: cod) == .zero)
}

@Test("appointments: request → booked → confirmed → arrived → started → completed")
func appointmentFlow() {
    let path: [AppointmentStatus] = [.requested, .booked, .confirmed, .arrived, .started, .completed]
    for (from, to) in zip(path, path.dropFirst()) {
        #expect(from.canTransition(to: to), "\(from) -> \(to)")
    }
    #expect(AppointmentStatus.requested.canTransition(to: .declined))
    #expect(AppointmentStatus.booked.canTransition(to: .noShow))
    #expect(AppointmentStatus.arrived.canTransition(to: .completed))   // checkout straight from arrived
    #expect(!AppointmentStatus.requested.canTransition(to: .noShow))
    #expect(!AppointmentStatus.started.canTransition(to: .cancelled))
    for status in AppointmentStatus.allCases where status.isTerminal {
        #expect(status.allowedNext.isEmpty)
    }
}

@Test("a booking starts REQUESTED, or BOOKED with auto-confirm; walk-ins start ARRIVED")
func appointmentInitial() {
    #expect(AppointmentStatus.initial(source: .online, autoConfirm: false) == .requested)
    #expect(AppointmentStatus.initial(source: .online, autoConfirm: true) == .booked)
    #expect(AppointmentStatus.initial(source: .walkIn, autoConfirm: false) == .arrived)
    #expect(AppointmentStatus.initial(source: .phone, autoConfirm: false) == .booked)
    #expect(AppointmentStatus.requested.customerLabel == "Requested")
    #expect(AppointmentStatus.booked.customerLabel == "Confirmed")
}

@Test("enum raw values are the UPPER_SNAKE wire values")
func wireValues() {
    #expect(OrderStatus.pickedUp.rawValue == "PICKED_UP")
    #expect(AppointmentStatus.noShow.rawValue == "NO_SHOW")
    #expect(AppointmentSource.walkIn.rawValue == "WALK_IN")
    #expect(DeliveryProvider.virtualbizRider.rawValue == "VIRTUALBIZ_RIDER")
    #expect(StockReason.markedSoldOut.rawValue == "MARKED_SOLD_OUT")
    #expect(SignInMethod.emailCode.rawValue == "EMAIL_CODE")
    for status in OrderStatus.allCases {
        #expect(status.rawValue == status.rawValue.uppercased())
    }
}
