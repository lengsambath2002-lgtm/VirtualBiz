import Foundation

/// Maps the prototype's icon keys (`Category.icon`) to SF Symbols.
public enum VBizIcon {
    public static func symbol(for key: String) -> String {
        switch key {
        case "cup": return "cup.and.saucer"
        case "phone": return "iphone"
        case "shirt": return "tshirt"
        case "basket": return "basket"
        case "leaf": return "leaf"
        case "brush": return "paintbrush.pointed"
        case "scissors": return "scissors"
        case "wrench": return "wrench.and.screwdriver"
        default: return "square.grid.2x2"
        }
    }
}
