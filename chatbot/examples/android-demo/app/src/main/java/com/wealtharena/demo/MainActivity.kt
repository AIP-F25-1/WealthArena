package com.wealtharena.demo

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.wealtharena.mobile.sdk.*
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private lateinit var wealthArenaClient: WealthArenaClient
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // Initialize WealthArena client
        wealthArenaClient = createWealthArenaClient(
            baseUrl = "http://10.0.2.2:8000", // Android emulator URL
            token = null // No auth for demo
        )
        
        // Test connection on startup
        testConnection()
    }
    
    private fun testConnection() {
        lifecycleScope.launch {
            try {
                val health = wealthArenaClient.health()
                showToast("Connected! Status: ${health.status}")
            } catch (e: Exception) {
                showToast("Connection failed: ${e.message}")
            }
        }
    }
    
    private fun testChat() {
        lifecycleScope.launch {
            try {
                val response = wealthArenaClient.chat(
                    ChatRequest(
                        message = "Explain RSI to me",
                        symbol = "AAPL"
                    )
                )
                
                showToast("Chat Response: ${response.reply}")
            } catch (e: Exception) {
                showToast("Chat failed: ${e.message}")
            }
        }
    }
    
    private fun testAnalysis() {
        lifecycleScope.launch {
            try {
                val analysis = wealthArenaClient.analyze(
                    AnalyzeRequest(symbol = "AAPL")
                )
                
                showToast("Analysis: ${analysis.symbol} - $${analysis.current_price}")
            } catch (e: Exception) {
                showToast("Analysis failed: ${e.message}")
            }
        }
    }
    
    private fun testTradingState() {
        lifecycleScope.launch {
            try {
                val state = wealthArenaClient.state()
                showToast("Balance: $${state.balance}")
            } catch (e: Exception) {
                showToast("State failed: ${e.message}")
            }
        }
    }
    
    private fun testPaperTrade() {
        lifecycleScope.launch {
            try {
                val trade = wealthArenaClient.paperTrade(
                    TradeRequest(
                        action = "buy",
                        symbol = "AAPL",
                        quantity = 1.0
                    )
                )
                
                if (trade.success) {
                    showToast("Trade successful: ${trade.message}")
                } else {
                    showToast("Trade failed: ${trade.message}")
                }
            } catch (e: Exception) {
                showToast("Trade failed: ${e.message}")
            }
        }
    }
    
    private fun showToast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }
}

