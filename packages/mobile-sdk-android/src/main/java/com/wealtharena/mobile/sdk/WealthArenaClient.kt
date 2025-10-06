package com.wealtharena.mobile.sdk

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*
import java.util.concurrent.TimeUnit

/**
 * WealthArena Mobile SDK for Android
 * Main client class for Android integration
 */

// Data classes
data class ChatRequest(
    val message: String,
    val symbol: String? = null,
    val mode: String? = null
)

data class ChatResponse(
    val reply: String,
    val sources: List<String>,
    val suggestions: List<String>,
    val timestamp: String
)

data class AnalyzeRequest(
    val symbol: String
)

data class AnalyzeResponse(
    val symbol: String,
    val current_price: Double,
    val indicators: Indicators,
    val signals: List<Signal>,
    val timestamp: String
)

data class Indicators(
    val sma_20: List<Double?>,
    val ema_12: List<Double?>,
    val rsi: List<Double?>
)

data class Signal(
    val type: String,
    val indicator: String,
    val message: String,
    val explanation: String
)

data class TradeRequest(
    val action: String,
    val symbol: String,
    val quantity: Double,
    val price: Double? = null
)

data class TradeResponse(
    val success: Boolean,
    val message: String,
    val new_balance: Double,
    val position: Position? = null,
    val timestamp: String
)

data class Position(
    val quantity: Double,
    val avg_price: Double
)

data class StateResponse(
    val balance: Double,
    val positions: Map<String, Position>,
    val trades: List<Trade>,
    val total_pnl: Double,
    val timestamp: String
)

data class Trade(
    val timestamp: String,
    val symbol: String,
    val action: String,
    val quantity: Double,
    val price: Double,
    val total: Double
)

data class LearnResponse(
    val lessons: List<Lesson>,
    val quizzes: List<Quiz>,
    val timestamp: String
)

data class Lesson(
    val id: String,
    val title: String,
    val content: String,
    val topics: List<String>
)

data class Quiz(
    val id: String,
    val question: String,
    val options: List<String>,
    val correct: Int,
    val explanation: String
)

data class HealthResponse(
    val status: String,
    val service: String,
    val version: String,
    val timestamp: String
)

// API Interface
interface WealthArenaApi {
    @POST("/v1/chat")
    suspend fun chat(@Body request: ChatRequest): ChatResponse

    @POST("/v1/analyze")
    suspend fun analyze(@Body request: AnalyzeRequest): AnalyzeResponse

    @GET("/v1/state")
    suspend fun state(): StateResponse

    @POST("/v1/papertrade")
    suspend fun paperTrade(@Body request: TradeRequest): TradeResponse

    @GET("/v1/learn")
    suspend fun learn(): LearnResponse

    @GET("/v1/healthz")
    suspend fun health(): HealthResponse
}

// Custom Exception
class WealthArenaException(
    message: String,
    val code: String? = null,
    val status: Int? = null
) : Exception(message)

// Main Client Class
class WealthArenaClient private constructor(
    private val api: WealthArenaApi,
    private val timeoutMs: Long = 30000,
    private val maxRetries: Int = 3
) {

    data class Builder(
        private var baseUrl: String,
        private var token: String? = null,
        private var timeoutMs: Long = 30000,
        private var maxRetries: Int = 3,
        private var enableLogging: Boolean = false
    ) {
        fun token(token: String?) = apply { this.token = token }
        fun timeout(timeoutMs: Long) = apply { this.timeoutMs = timeoutMs }
        fun retries(maxRetries: Int) = apply { this.maxRetries = maxRetries }
        fun enableLogging(enable: Boolean) = apply { this.enableLogging = enable }

        fun build(): WealthArenaClient {
            val httpClient = OkHttpClient.Builder()
                .connectTimeout(timeoutMs, TimeUnit.MILLISECONDS)
                .readTimeout(timeoutMs, TimeUnit.MILLISECONDS)
                .writeTimeout(timeoutMs, TimeUnit.MILLISECONDS)
                .apply {
                    if (enableLogging) {
                        val logging = HttpLoggingInterceptor()
                        logging.level = HttpLoggingInterceptor.Level.BODY
                        addInterceptor(logging)
                    }
                    
                    if (token != null) {
                        addInterceptor { chain ->
                            val request = chain.request().newBuilder()
                                .addHeader("Authorization", "Bearer $token")
                                .build()
                            chain.proceed(request)
                        }
                    }
                }
                .build()

            val retrofit = Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(httpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()

            val api = retrofit.create(WealthArenaApi::class.java)
            return WealthArenaClient(api, timeoutMs, maxRetries)
        }
    }

    companion object {
        fun builder(baseUrl: String): Builder = Builder(baseUrl)
    }

    private suspend fun <T> executeWithRetry(operation: suspend () -> T): T {
        var lastException: Exception? = null
        
        repeat(maxRetries) { attempt ->
            try {
                return withTimeout(timeoutMs) {
                    withContext(Dispatchers.IO) {
                        operation()
                    }
                }
            } catch (e: Exception) {
                lastException = e
                if (attempt < maxRetries - 1) {
                    // Exponential backoff
                    val delay = (2.0.pow(attempt) * 1000).toLong()
                    kotlinx.coroutines.delay(delay)
                }
            }
        }
        
        throw lastException ?: WealthArenaException("Request failed after $maxRetries retries")
    }

    /**
     * Chat with the educational trading bot
     */
    suspend fun chat(request: ChatRequest): ChatResponse {
        return executeWithRetry { api.chat(request) }
    }

    /**
     * Analyze an asset with technical indicators
     */
    suspend fun analyze(request: AnalyzeRequest): AnalyzeResponse {
        return executeWithRetry { api.analyze(request) }
    }

    /**
     * Get current trading state
     */
    suspend fun state(): StateResponse {
        return executeWithRetry { api.state() }
    }

    /**
     * Execute a paper trade
     */
    suspend fun paperTrade(request: TradeRequest): TradeResponse {
        return executeWithRetry { api.paperTrade(request) }
    }

    /**
     * Get educational content and quizzes
     */
    suspend fun learn(): LearnResponse {
        return executeWithRetry { api.learn() }
    }

    /**
     * Health check
     */
    suspend fun health(): HealthResponse {
        return executeWithRetry { api.health() }
    }
}

// Extension function for easy client creation
fun createWealthArenaClient(baseUrl: String, token: String? = null): WealthArenaClient {
    return WealthArenaClient.builder(baseUrl)
        .token(token)
        .build()
}

