import Foundation
import Testing
@testable import VBizDomain

/// The app's String Catalog, read from disk (the package cannot see the app bundle).
private func catalog() throws -> [String: Any] {
    let url = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        .deletingLastPathComponent().deletingLastPathComponent()
        .appending(path: "VirtualBiz/Resources/Localizable.xcstrings")
    let json = try JSONSerialization.jsonObject(with: Data(contentsOf: url))
    return (json as? [String: Any])?["strings"] as? [String: Any] ?? [:]
}

@Test("every customer order label key exists in the catalogue, in English and Khmer")
func orderLabelKeysLocalized() throws {
    let strings = try catalog()
    for status in OrderStatus.allCases {
        for method in FulfilmentMethod.allCases {
            let key = status.customerLabelKey(method: method)
            let entry = strings[key] as? [String: Any]
            let localizations = entry?["localizations"] as? [String: Any]
            #expect(localizations?["en"] != nil, "\(key) en")
            #expect(localizations?["km"] != nil, "\(key) km")
        }
    }
}

@Test("every catalogue entry has both en and km")
func catalogueComplete() throws {
    let strings = try catalog()
    #expect(!strings.isEmpty)
    for (key, value) in strings {
        let localizations = (value as? [String: Any])?["localizations"] as? [String: Any]
        #expect(localizations?.keys.sorted() == ["en", "km"], "\(key)")
    }
}
