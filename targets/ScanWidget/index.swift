import WidgetKit
import SwiftUI
import AppIntents

@available(iOS 18.0, *)
struct ScanControlWidget: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "ScanControlWidget") {
            ControlWidgetButton(action: LaunchAppIntent()) {
                Label("Secure Scan", systemImage: "qrcode.viewfinder")
            }
        }
        .displayName("Secure Scan")
        .description("Quickly scan a QR code.")
    }
}

@available(iOS 18.0, *)
struct LaunchAppIntent: AppIntent {
    static var title: LocalizedStringResource = "Secure Scan"
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}

@main
struct SecureQRWidgets: WidgetBundle {
    var body: some Widget {
        if #available(iOS 18.0, *) {
            ScanControlWidget()
        }
    }
}
