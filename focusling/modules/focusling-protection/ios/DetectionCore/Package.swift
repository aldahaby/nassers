// swift-tools-version:5.9
// Pure-Swift detection logic shared by the app module. Runs anywhere Swift runs:
//   cd modules/focusling-protection/ios/DetectionCore && swift test
import PackageDescription

let package = Package(
  name: "DetectionCore",
  products: [.library(name: "DetectionCore", targets: ["DetectionCore"])],
  targets: [
    .target(name: "DetectionCore"),
    .testTarget(
      name: "DetectionCoreTests",
      dependencies: ["DetectionCore"],
      resources: [.copy("protectionVectors.json")]
    ),
  ]
)
