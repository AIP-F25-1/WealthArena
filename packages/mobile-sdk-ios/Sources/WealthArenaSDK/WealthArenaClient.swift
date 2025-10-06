import Foundation

// MARK: - Configuration

public struct WealthArenaConfig {
    public let baseURL: URL
    public let token: String?
    public let timeout: TimeInterval
    public let maxRetries: Int
    
    public init(
        baseURL: URL,
        token: String? = nil,
        timeout: TimeInterval = 30.0,
        maxRetries: Int = 3
    ) {
        self.baseURL = baseURL
        self.token = token
        self.timeout = timeout
        self.maxRetries = maxRetries
    }
}

// MARK: - Main Client

@available(iOS 13.0, macOS 10.15, *)
public class WealthArenaClient {
    private let config: WealthArenaConfig
    private let session: URLSession
    
    public init(config: WealthArenaConfig) {
        self.config = config
        
        let sessionConfig = URLSessionConfiguration.default
        sessionConfig.timeoutIntervalForRequest = config.timeout
        sessionConfig.timeoutIntervalForResource = config.timeout
        
        self.session = URLSession(configuration: sessionConfig)
    }
    
    public convenience init(baseURL: URL, token: String? = nil) {
        let config = WealthArenaConfig(baseURL: baseURL, token: token)
        self.init(config: config)
    }
    
    // MARK: - Private Methods
    
    private func makeRequest<T: Codable>(
        endpoint: String,
        method: HTTPMethod = .GET,
        body: Codable? = nil,
        responseType: T.Type
    ) async throws -> T {
        guard let url = URL(string: "\(config.baseURL.absoluteString)/v1\(endpoint)") else {
            throw WealthArenaError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = config.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        if let body = body {
            do {
                request.httpBody = try JSONEncoder().encode(body)
            } catch {
                throw WealthArenaError.decodingError(error)
            }
        }
        
        return try await executeWithRetry(request: request, responseType: responseType)
    }
    
    private func executeWithRetry<T: Codable>(
        request: URLRequest,
        responseType: T.Type
    ) async throws -> T {
        var lastError: Error?
        
        for attempt in 0..<config.maxRetries {
            do {
                let (data, response) = try await session.data(for: request)
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw WealthArenaError.noData
                }
                
                guard httpResponse.statusCode == 200 else {
                    let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
                    throw WealthArenaError.serverError(httpResponse.statusCode, errorMessage)
                }
                
                do {
                    let result = try JSONDecoder().decode(responseType, from: data)
                    return result
                } catch {
                    throw WealthArenaError.decodingError(error)
                }
                
            } catch {
                lastError = error
                
                if attempt < config.maxRetries - 1 {
                    // Exponential backoff
                    let delay = pow(2.0, Double(attempt)) * 1.0
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
            }
        }
        
        throw lastError ?? WealthArenaError.unknown(NSError(domain: "WealthArena", code: -1, userInfo: nil))
    }
    
    // MARK: - Public API Methods
    
    /// Chat with the educational trading bot
    public func chat(_ request: ChatRequest) async throws -> ChatResponse {
        return try await makeRequest(
            endpoint: "/chat",
            method: .POST,
            body: request,
            responseType: ChatResponse.self
        )
    }
    
    /// Analyze an asset with technical indicators
    public func analyze(_ request: AnalyzeRequest) async throws -> AnalyzeResponse {
        return try await makeRequest(
            endpoint: "/analyze",
            method: .POST,
            body: request,
            responseType: AnalyzeResponse.self
        )
    }
    
    /// Get current trading state
    public func state() async throws -> StateResponse {
        return try await makeRequest(
            endpoint: "/state",
            method: .GET,
            responseType: StateResponse.self
        )
    }
    
    /// Execute a paper trade
    public func paperTrade(_ request: TradeRequest) async throws -> TradeResponse {
        return try await makeRequest(
            endpoint: "/papertrade",
            method: .POST,
            body: request,
            responseType: TradeResponse.self
        )
    }
    
    /// Get educational content and quizzes
    public func learn() async throws -> LearnResponse {
        return try await makeRequest(
            endpoint: "/learn",
            method: .GET,
            responseType: LearnResponse.self
        )
    }
    
    /// Health check
    public func health() async throws -> HealthResponse {
        return try await makeRequest(
            endpoint: "/healthz",
            method: .GET,
            responseType: HealthResponse.self
        )
    }
}

// MARK: - HTTP Method

private enum HTTPMethod: String {
    case GET = "GET"
    case POST = "POST"
    case PUT = "PUT"
    case DELETE = "DELETE"
}

// MARK: - Convenience Factory

public func createWealthArenaClient(baseURL: URL, token: String? = nil) -> WealthArenaClient {
    return WealthArenaClient(baseURL: baseURL, token: token)
}

