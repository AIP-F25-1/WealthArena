// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "WealthArenaSDK",
    platforms: [
        .iOS(.v13),
        .macOS(.v10_15)
    ],
    products: [
        .library(
            name: "WealthArenaSDK",
            targets: ["WealthArenaSDK"]
        ),
    ],
    dependencies: [
        // No external dependencies - uses only Foundation and URLSession
    ],
    targets: [
        .target(
            name: "WealthArenaSDK",
            dependencies: [],
            path: "Sources"
        ),
        .testTarget(
            name: "WealthArenaSDKTests",
            dependencies: ["WealthArenaSDK"],
            path: "Tests"
        ),
    ]
)

