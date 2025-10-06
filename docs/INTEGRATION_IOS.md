# WealthArena iOS Integration Guide

This guide shows how to integrate the WealthArena iOS SDK into your existing iOS app.

## Installation

### 1. Swift Package Manager (Recommended)

1. In Xcode, go to **File > Add Package Dependencies**
2. Enter the repository URL: `https://github.com/wealtharena/mobile-sdk-ios`
3. Select the version and add to your target

### 2. Manual Installation

1. Download the latest release from GitHub
2. Add `WealthArenaSDK.xcframework` to your project
3. Link the framework to your target

### 3. CocoaPods (Alternative)

Add to your `Podfile`:

```ruby
pod 'WealthArenaSDK', :git => 'https://github.com/wealtharena/mobile-sdk-ios.git'
```

Run `pod install`.

## Basic Integration

### 1. Import the SDK

```swift
import WealthArenaSDK
```

### 2. Create the WealthArena Client

```swift
import UIKit
import WealthArenaSDK

class ViewController: UIViewController {
    private var wealthArenaClient: WealthArenaClient!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Create client instance
        guard let baseURL = URL(string: "http://127.0.0.1:8000") else {
            fatalError("Invalid base URL")
        }
        
        wealthArenaClient = createWealthArenaClient(
            baseURL: baseURL,
            token: "your-optional-token"
        )
    }
}
```

### 3. Use the SDK in your view controllers

```swift
class TradingViewController: UIViewController {
    private var wealthArenaClient: WealthArenaClient!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupWealthArenaClient()
        loadTradingData()
    }
    
    private func setupWealthArenaClient() {
        guard let baseURL = URL(string: "http://127.0.0.1:8000") else {
            fatalError("Invalid base URL")
        }
        
        wealthArenaClient = createWealthArenaClient(baseURL: baseURL)
    }
    
    private func loadTradingData() {
        Task {
            do {
                // Get trading state
                let state = try await wealthArenaClient.state()
                await MainActor.run {
                    updateBalanceLabel(state.balance)
                    updatePositionsTable(state.positions)
                }
                
                // Get educational content
                let lessons = try await wealthArenaClient.learn()
                await MainActor.run {
                    updateLessonsTable(lessons.lessons)
                }
                
            } catch {
                await MainActor.run {
                    handleError(error)
                }
            }
        }
    }
    
    @IBAction func chatButtonTapped(_ sender: UIButton) {
        Task {
            do {
                let response = try await wealthArenaClient.chat(
                    ChatRequest(
                        message: "Explain RSI to me",
                        symbol: "AAPL"
                    )
                )
                
                await MainActor.run {
                    displayChatResponse(response.reply)
                }
                
            } catch {
                await MainActor.run {
                    handleError(error)
                }
            }
        }
    }
    
    @IBAction func analyzeButtonTapped(_ sender: UIButton) {
        Task {
            do {
                let analysis = try await wealthArenaClient.analyze(
                    AnalyzeRequest(symbol: "AAPL")
                )
                
                await MainActor.run {
                    displayAnalysis(analysis)
                }
                
            } catch {
                await MainActor.run {
                    handleError(error)
                }
            }
        }
    }
    
    @IBAction func executeTradeButtonTapped(_ sender: UIButton) {
        Task {
            do {
                let trade = try await wealthArenaClient.paperTrade(
                    TradeRequest(
                        action: "buy",
                        symbol: "AAPL",
                        quantity: 10.0
                    )
                )
                
                await MainActor.run {
                    if trade.success {
                        showSuccessAlert(trade.message)
                        loadTradingData() // Refresh data
                    } else {
                        showErrorAlert(trade.message)
                    }
                }
                
            } catch {
                await MainActor.run {
                    handleError(error)
                }
            }
        }
    }
    
    private func handleError(_ error: Error) {
        if let wealthArenaError = error as? WealthArenaError {
            switch wealthArenaError {
            case .serverError(let code, let message):
                showErrorAlert("Server Error \(code): \(message)")
            case .networkError(let networkError):
                showErrorAlert("Network Error: \(networkError.localizedDescription)")
            case .timeout:
                showErrorAlert("Request timeout. Please try again.")
            default:
                showErrorAlert("Error: \(wealthArenaError.localizedDescription)")
            }
        } else {
            showErrorAlert("Unknown error: \(error.localizedDescription)")
        }
    }
}
```

## Advanced Configuration

### 1. Custom Client Configuration

```swift
import WealthArenaSDK

class WealthArenaManager {
    private let client: WealthArenaClient
    
    init(baseURL: URL, token: String? = nil) {
        let config = WealthArenaConfig(
            baseURL: baseURL,
            token: token,
            timeout: 30.0,
            maxRetries: 3
        )
        
        self.client = WealthArenaClient(config: config)
    }
    
    // Convenience methods
    func chat(message: String, symbol: String? = nil) async throws -> ChatResponse {
        return try await client.chat(ChatRequest(
            message: message,
            symbol: symbol
        ))
    }
    
    func analyze(symbol: String) async throws -> AnalyzeResponse {
        return try await client.analyze(AnalyzeRequest(symbol: symbol))
    }
    
    func getState() async throws -> StateResponse {
        return try await client.state()
    }
    
    func executeTrade(action: String, symbol: String, quantity: Double) async throws -> TradeResponse {
        return try await client.paperTrade(TradeRequest(
            action: action,
            symbol: symbol,
            quantity: quantity
        ))
    }
}
```

### 2. Error Handling with Combine

```swift
import Combine
import WealthArenaSDK

class TradingViewModel: ObservableObject {
    @Published var balance: Double = 0.0
    @Published var positions: [String: Position] = [:]
    @Published var errorMessage: String?
    @Published var isLoading: Bool = false
    
    private let wealthArenaClient: WealthArenaClient
    private var cancellables = Set<AnyCancellable>()
    
    init(baseURL: URL) {
        self.wealthArenaClient = createWealthArenaClient(baseURL: baseURL)
    }
    
    func loadTradingState() {
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                let state = try await wealthArenaClient.state()
                
                await MainActor.run {
                    self.balance = state.balance
                    self.positions = state.positions
                    self.isLoading = false
                }
                
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
    
    func executeTrade(action: String, symbol: String, quantity: Double) {
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                let trade = try await wealthArenaClient.paperTrade(
                    TradeRequest(
                        action: action,
                        symbol: symbol,
                        quantity: quantity
                    )
                )
                
                await MainActor.run {
                    if trade.success {
                        self.loadTradingState() // Refresh state
                    } else {
                        self.errorMessage = trade.message
                    }
                    self.isLoading = false
                }
                
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
}
```

### 3. Background Processing

```swift
import BackgroundTasks
import WealthArenaSDK

class TradingBackgroundService {
    private let wealthArenaClient: WealthArenaClient
    
    init(baseURL: URL) {
        self.wealthArenaClient = createWealthArenaClient(baseURL: baseURL)
    }
    
    func registerBackgroundTask() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "com.wealtharena.background-refresh",
            using: nil
        ) { task in
            self.handleBackgroundRefresh(task: task as! BGAppRefreshTask)
        }
    }
    
    private func handleBackgroundRefresh(task: BGAppRefreshTask) {
        task.expirationHandler = {
            task.setTaskCompleted(success: false)
        }
        
        Task {
            do {
                let state = try await wealthArenaClient.state()
                
                // Process state in background
                await processTradingState(state)
                
                task.setTaskCompleted(success: true)
                
            } catch {
                print("Background task failed: \(error)")
                task.setTaskCompleted(success: false)
            }
        }
    }
    
    private func processTradingState(_ state: StateResponse) async {
        // Process trading state in background
        // Update local storage, send notifications, etc.
    }
}
```

## Testing

### 1. Unit Tests

```swift
import XCTest
import WealthArenaSDK
@testable import YourApp

class WealthArenaClientTests: XCTestCase {
    private var client: WealthArenaClient!
    
    override func setUp() {
        super.setUp()
        
        guard let baseURL = URL(string: "http://127.0.0.1:8000") else {
            XCTFail("Invalid base URL")
            return
        }
        
        client = createWealthArenaClient(baseURL: baseURL)
    }
    
    func testHealthCheck() async throws {
        let health = try await client.health()
        XCTAssertEqual(health.status, "healthy")
        XCTAssertEqual(health.service, "wealtharena-mobile-api")
    }
    
    func testChatRequest() async throws {
        let request = ChatRequest(
            message: "What is RSI?",
            symbol: "AAPL"
        )
        
        let response = try await client.chat(request)
        XCTAssertFalse(response.reply.isEmpty)
        XCTAssertFalse(response.sources.isEmpty)
    }
    
    func testAnalysisRequest() async throws {
        let request = AnalyzeRequest(symbol: "AAPL")
        
        let analysis = try await client.analyze(request)
        XCTAssertEqual(analysis.symbol, "AAPL")
        XCTAssertGreaterThan(analysis.current_price, 0)
    }
    
    func testTradingState() async throws {
        let state = try await client.state()
        XCTAssertGreaterThanOrEqual(state.balance, 0)
        XCTAssertNotNil(state.timestamp)
    }
}
```

### 2. Integration Tests

```swift
import XCTest
import WealthArenaSDK

class WealthArenaIntegrationTests: XCTestCase {
    private var client: WealthArenaClient!
    
    override func setUp() {
        super.setUp()
        
        guard let baseURL = URL(string: "http://127.0.0.1:8000") else {
            XCTFail("Invalid base URL")
            return
        }
        
        client = createWealthArenaClient(baseURL: baseURL)
    }
    
    func testFullIntegration() async throws {
        // Test health
        let health = try await client.health()
        XCTAssertEqual(health.status, "healthy")
        
        // Test chat
        let chatResponse = try await client.chat(
            ChatRequest(message: "Hello")
        )
        XCTAssertFalse(chatResponse.reply.isEmpty)
        
        // Test analysis
        let analysis = try await client.analyze(
            AnalyzeRequest(symbol: "AAPL")
        )
        XCTAssertEqual(analysis.symbol, "AAPL")
        XCTAssertGreaterThan(analysis.current_price, 0)
        
        // Test state
        let state = try await client.state()
        XCTAssertGreaterThanOrEqual(state.balance, 0)
        
        // Test trade (if you want to test actual trading)
        // Note: This will modify the trading state
        /*
        let trade = try await client.paperTrade(
            TradeRequest(
                action: "buy",
                symbol: "AAPL",
                quantity: 1.0
            )
        )
        XCTAssertTrue(trade.success)
        */
    }
}
```

## Production Deployment

### 1. App Transport Security (ATS)

Add to your `Info.plist`:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
    <!-- Or be more specific for your domain -->
    <key>NSExceptionDomains</key>
    <dict>
        <key>api.wealtharena.com</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
        </dict>
    </dict>
</dict>
```

### 2. Production Configuration

```swift
// Production configuration
class ProductionWealthArenaClient {
    static let shared: WealthArenaClient = {
        guard let baseURL = URL(string: "https://api.wealtharena.com") else {
            fatalError("Invalid production URL")
        }
        
        return createWealthArenaClient(
            baseURL: baseURL,
            token: Bundle.main.object(forInfoDictionaryKey: "WealthArenaToken") as? String
        )
    }()
}
```

### 3. Environment Configuration

Create different configurations for different environments:

```swift
enum Environment {
    case development
    case staging
    case production
    
    var baseURL: URL {
        switch self {
        case .development:
            return URL(string: "http://127.0.0.1:8000")!
        case .staging:
            return URL(string: "https://staging-api.wealtharena.com")!
        case .production:
            return URL(string: "https://api.wealtharena.com")!
        }
    }
    
    var token: String? {
        switch self {
        case .development:
            return nil
        case .staging:
            return Bundle.main.object(forInfoDictionaryKey: "WealthArenaStagingToken") as? String
        case .production:
            return Bundle.main.object(forInfoDictionaryKey: "WealthArenaToken") as? String
        }
    }
}

// Usage
let environment: Environment = .production
let client = createWealthArenaClient(
    baseURL: environment.baseURL,
    token: environment.token
)
```

## Troubleshooting

### Common Issues

1. **Network Connection Issues**
   - Ensure your backend is running
   - Check ATS settings in Info.plist
   - For simulator, use `http://127.0.0.1:8000`
   - For device, use your computer's IP address

2. **Build Issues**
   - Ensure iOS deployment target is 13.0+
   - Check Swift Package Manager dependencies
   - Verify framework linking

3. **Runtime Issues**
   - Check console logs for detailed error messages
   - Ensure proper async/await usage
   - Verify API endpoint URLs

### Debug Configuration

```swift
// Debug configuration with logging
let debugClient = WealthArenaClient(
    config: WealthArenaConfig(
        baseURL: URL(string: "http://127.0.0.1:8000")!,
        token: nil,
        timeout: 30.0,
        maxRetries: 3
    )
)
```

## Support

For issues and questions:
- Check the [GitHub repository](https://github.com/wealtharena/mobile-sdk-ios)
- Review the [API documentation](https://docs.wealtharena.com)
- Contact support at support@wealtharena.com

