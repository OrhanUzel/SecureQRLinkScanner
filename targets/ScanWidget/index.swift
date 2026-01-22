import WidgetKit
import SwiftUI
import AppIntents

@available(iOS 18.0, *)
struct ScanControlWidget: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "ScanControlWidget") {
            ControlWidgetButton(action: OpenURLIntent(URL(string: "secureqrlinkscanner://scan")!)) {
                Label("Secure Scan", systemImage: "qrcode.viewfinder")
            }
        }
        .displayName("Secure Scan")
        .description("Quickly scan a QR code.")
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
