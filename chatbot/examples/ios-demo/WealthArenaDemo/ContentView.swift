import SwiftUI
import WealthArenaSDK

struct ContentView: View {
    @State private var wealthArenaClient: WealthArenaClient
    @State private var statusMessage = "Initializing..."
    @State private var isLoading = false
    
    init() {
        // Initialize WealthArena client
        guard let baseURL = URL(string: "http://127.0.0.1:8000") else {
            fatalError("Invalid base URL")
        }
        
        self._wealthArenaClient = State(initialValue: createWealthArenaClient(baseURL: baseURL))
    }
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("WealthArena Demo")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundColor(.green)
                
                Text("Trading Education Platform")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                VStack(spacing: 16) {
                    Button("Test Connection") {
                        testConnection()
                    }
                    .buttonStyle(DemoButtonStyle())
                    
                    Button("Test Chat") {
                        testChat()
                    }
                    .buttonStyle(DemoButtonStyle())
                    
                    Button("Test Analysis") {
                        testAnalysis()
                    }
                    .buttonStyle(DemoButtonStyle())
                    
                    Button("Test Trading State") {
                        testTradingState()
                    }
                    .buttonStyle(DemoButtonStyle())
                    
                    Button("Test Paper Trade") {
                        testPaperTrade()
                    }
                    .buttonStyle(DemoButtonStyle())
                }
                
                if isLoading {
                    ProgressView("Loading...")
                        .padding()
                }
                
                Text(statusMessage)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding()
                
                Spacer()
            }
            .padding()
            .navigationTitle("WealthArena Demo")
        }
    }
    
    private func testConnection() {
        isLoading = true
        statusMessage = "Testing connection..."
        
        Task {
            do {
                let health = try await wealthArenaClient.health()
                await MainActor.run {
                    statusMessage = "Connected! Status: \(health.status)"
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    statusMessage = "Connection failed: \(error.localizedDescription)"
                    isLoading = false
                }
            }
        }
    }
    
    private func testChat() {
        isLoading = true
        statusMessage = "Testing chat..."
        
        Task {
            do {
                let response = try await wealthArenaClient.chat(
                    ChatRequest(
                        message: "Explain RSI to me",
                        symbol: "AAPL"
                    )
                )
                
                await MainActor.run {
                    statusMessage = "Chat Response: \(response.reply)"
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    statusMessage = "Chat failed: \(error.localizedDescription)"
                    isLoading = false
                }
            }
        }
    }
    
    private func testAnalysis() {
        isLoading = true
        statusMessage = "Testing analysis..."
        
        Task {
            do {
                let analysis = try await wealthArenaClient.analyze(
                    AnalyzeRequest(symbol: "AAPL")
                )
                
                await MainActor.run {
                    statusMessage = "Analysis: \(analysis.symbol) - $\(analysis.current_price, specifier: "%.2f")"
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    statusMessage = "Analysis failed: \(error.localizedDescription)"
                    isLoading = false
                }
            }
        }
    }
    
    private func testTradingState() {
        isLoading = true
        statusMessage = "Testing trading state..."
        
        Task {
            do {
                let state = try await wealthArenaClient.state()
                
                await MainActor.run {
                    statusMessage = "Balance: $\(state.balance, specifier: "%.2f")"
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    statusMessage = "State failed: \(error.localizedDescription)"
                    isLoading = false
                }
            }
        }
    }
    
    private func testPaperTrade() {
        isLoading = true
        statusMessage = "Testing paper trade..."
        
        Task {
            do {
                let trade = try await wealthArenaClient.paperTrade(
                    TradeRequest(
                        action: "buy",
                        symbol: "AAPL",
                        quantity: 1.0
                    )
                )
                
                await MainActor.run {
                    if trade.success {
                        statusMessage = "Trade successful: \(trade.message)"
                    } else {
                        statusMessage = "Trade failed: \(trade.message)"
                    }
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    statusMessage = "Trade failed: \(error.localizedDescription)"
                    isLoading = false
                }
            }
        }
    }
}

struct DemoButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding()
            .background(Color.green)
            .foregroundColor(.black)
            .cornerRadius(8)
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}

