import Foundation

// MARK: - Request Models

public struct ChatRequest: Codable {
    public let message: String
    public let symbol: String?
    public let mode: String?
    
    public init(message: String, symbol: String? = nil, mode: String? = nil) {
        self.message = message
        self.symbol = symbol
        self.mode = mode
    }
}

public struct AnalyzeRequest: Codable {
    public let symbol: String
    
    public init(symbol: String) {
        self.symbol = symbol
    }
}

public struct TradeRequest: Codable {
    public let action: String
    public let symbol: String
    public let quantity: Double
    public let price: Double?
    
    public init(action: String, symbol: String, quantity: Double, price: Double? = nil) {
        self.action = action
        self.symbol = symbol
        self.quantity = quantity
        self.price = price
    }
}

// MARK: - Response Models

public struct ChatResponse: Codable {
    public let reply: String
    public let sources: [String]
    public let suggestions: [String]
    public let timestamp: String
}

public struct AnalyzeResponse: Codable {
    public let symbol: String
    public let current_price: Double
    public let indicators: Indicators
    public let signals: [Signal]
    public let timestamp: String
}

public struct Indicators: Codable {
    public let sma_20: [Double?]
    public let ema_12: [Double?]
    public let rsi: [Double?]
}

public struct Signal: Codable {
    public let type: String
    public let indicator: String
    public let message: String
    public let explanation: String
}

public struct TradeResponse: Codable {
    public let success: Bool
    public let message: String
    public let new_balance: Double
    public let position: Position?
    public let timestamp: String
}

public struct Position: Codable {
    public let quantity: Double
    public let avg_price: Double
}

public struct StateResponse: Codable {
    public let balance: Double
    public let positions: [String: Position]
    public let trades: [Trade]
    public let total_pnl: Double
    public let timestamp: String
}

public struct Trade: Codable {
    public let timestamp: String
    public let symbol: String
    public let action: String
    public let quantity: Double
    public let price: Double
    public let total: Double
}

public struct LearnResponse: Codable {
    public let lessons: [Lesson]
    public let quizzes: [Quiz]
    public let timestamp: String
}

public struct Lesson: Codable {
    public let id: String
    public let title: String
    public let content: String
    public let topics: [String]
}

public struct Quiz: Codable {
    public let id: String
    public let question: String
    public let options: [String]
    public let correct: Int
    public let explanation: String
}

public struct HealthResponse: Codable {
    public let status: String
    public let service: String
    public let version: String
    public let timestamp: String
}

// MARK: - Error Types

public enum WealthArenaError: Error, LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case networkError(Error)
    case serverError(Int, String)
    case timeout
    case unknown(Error)
    
    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .noData:
            return "No data received"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .serverError(let code, let message):
            return "Server error \(code): \(message)"
        case .timeout:
            return "Request timeout"
        case .unknown(let error):
            return "Unknown error: \(error.localizedDescription)"
        }
    }
}

