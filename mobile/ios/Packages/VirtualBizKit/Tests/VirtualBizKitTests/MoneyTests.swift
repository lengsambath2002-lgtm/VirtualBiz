import Foundation
import Testing
@testable import VBizDomain

@Test("KHR is round(usd × 4100 / 100) × 100")
func khrRounding() {
    #expect(Money(2.5).khr == 10_300)      // 10,250 -> 10,300 (half up)
    #expect(Money(2).khr == 8_200)
    #expect(Money(829).khr == 3_398_900)
    #expect(Money(0.01).khr == 0)          // 41 -> 0
    #expect(Money(0.02).khr == 100)        // 82 -> 100
    #expect(Money(224.1).khr == 918_800)   // 918,810 -> 918,800
    #expect(Money.zero.khr == 0)
}

@Test("money is always held to cents and formats as USD and KHR text")
func formatting() {
    #expect(Money(Decimal(string: "1.005") ?? 0).amount == Decimal(string: "1.01"))
    #expect(Money(1234.5).usdText == "$1,234.50")
    #expect(Money(-3).usdText == "-$3.00")
    #expect(Money(2.5).khrText == "10,300 KHR")
}

@Test("arithmetic stays exact in decimal")
func arithmetic() {
    let sum = Money(0.1) + Money(0.2)
    #expect(sum == Money(0.3))
    #expect(Money(2.5) * 3 == Money(7.5))
    #expect(Money(10) - Money(2.25) == Money(7.75))
}

@Test("Money decodes from a JSON number or string and rounds float noise away")
func moneyCoding() throws {
    struct Box: Codable { let price: Money }
    let decoded = try JSONDecoder().decode(Box.self, from: Data(#"{"price":224.1}"#.utf8))
    #expect(decoded.price.amount == Decimal(string: "224.1"))
    let fromString = try JSONDecoder().decode(Box.self, from: Data(#"{"price":"18.50"}"#.utf8))
    #expect(fromString.price == Money(18.5))
    let encoded = String(decoding: try JSONEncoder().encode(Box(price: Money(18.5))), as: UTF8.self)
    #expect(encoded == #"{"price":18.5}"#)
}

@Test("cash change is whole dollars plus the cents in riel")
func cashChange() {
    #expect(CashChange(change: Money(3.5)).text == "$3 + 2,100 KHR")    // 0.50 × 4100 = 2050 -> 2100
    #expect(CashChange(change: Money(5)).text == "$5")
    #expect(CashChange(change: Money(0.25)).text == "$0 + 1,000 KHR")   // 1025 -> 1000
    #expect(CashChange(change: Money(12.75)).dollars == 12)
    #expect(CashChange(change: Money(12.75)).riel == 3_100)             // 3075 -> 3100
    #expect(CashChange(change: Money(-1)).isZero)
}

@Test("display numbers are zero-padded to five digits")
func displayNumbers() {
    #expect(DisplayNumber.order.format(38) == "VB-00038")
    #expect(DisplayNumber.booking.format(2201) == "BK-02201")
    #expect(DisplayNumber.posReceipt.format(1) == "R-00001")
    #expect(DisplayNumber.providerSale.format(123_456) == "S-123456")
    #expect(DisplayNumber.order.sequence(of: "VB-24038") == 24038)
    #expect(DisplayNumber.order.sequence(of: "BK-24038") == nil)
}
