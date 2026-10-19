import Testing
@testable import VBizDomain

@Test("+855 and 855 normalize to a leading 0; formatting characters are ignored",
      arguments: [
          ("096 818 9261", "0968189261"),
          ("+855 96 818 9261", "0968189261"),
          ("855968189261", "0968189261"),
          ("+855 012 345 678", "012345678"),
          ("012-345-678", "012345678"),
          ("(012) 345.678", "012345678"),
      ])
func normalizes(raw: String, expected: String) {
    #expect(PhoneNumber(raw)?.value == expected)
}

@Test("validation is ^0[1-9]\\d{7,8}$ on the normalized value",
      arguments: ["0012345678", "01234567", "01234567890", "12345678", "09a8189261", "", "+855"])
func rejectsInvalid(raw: String) {
    #expect(PhoneNumber(raw) == nil)
    #expect(!PhoneNumber.isValid(raw))
}

@Test("display grouping follows the prototype")
func displayGrouping() {
    #expect(PhoneNumber("0968189261")?.formatted == "096 818 9261")
    #expect(PhoneNumber("012345678")?.formatted == "012 345 678")
}
