# WealthArena Android Integration Guide

This guide shows how to integrate the WealthArena Android SDK into your existing Android app.

## Installation

### 1. Add the SDK to your project

#### Option A: JAR/AAR (Recommended)
Download the latest `wealtharena-android-sdk.aar` from the releases page and add it to your `libs` folder.

#### Option B: Gradle (if published to Maven)
```gradle
dependencies {
    implementation 'com.wealtharena.mobile:android-sdk:1.0.0'
}
```

### 2. Add to your app's `build.gradle`

```gradle
android {
    compileSdk 34
    
    defaultConfig {
        minSdk 21
        targetSdk 34
    }
    
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}

dependencies {
    // WealthArena SDK
    implementation files('libs/wealtharena-android-sdk.aar')
    
    // Required dependencies
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
}
```

### 3. Add network permissions to `AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

## Basic Integration

### 1. Create the WealthArena Client

```kotlin
import com.wealtharena.mobile.sdk.WealthArenaClient
import com.wealtharena.mobile.sdk.createWealthArenaClient

class MainActivity : AppCompatActivity() {
    private lateinit var wealthArenaClient: WealthArenaClient
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        // Create client instance
        wealthArenaClient = createWealthArenaClient(
            baseUrl = "http://127.0.0.1:8000", // Your backend URL
            token = "your-optional-token"      // Optional auth token
        )
    }
}
```

### 2. Use the SDK in your activities

```kotlin
class TradingActivity : AppCompatActivity() {
    private lateinit var wealthArenaClient: WealthArenaClient
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_trading)
        
        wealthArenaClient = createWealthArenaClient("http://127.0.0.1:8000")
        
        // Example: Chat with the bot
        chatWithBot()
        
        // Example: Analyze an asset
        analyzeAsset("AAPL")
        
        // Example: Get trading state
        getTradingState()
    }
    
    private fun chatWithBot() {
        lifecycleScope.launch {
            try {
                val response = wealthArenaClient.chat(
                    ChatRequest(
                        message = "Explain RSI to me",
                        symbol = "AAPL"
                    )
                )
                
                // Update UI with response
                runOnUiThread {
                    updateChatUI(response.reply)
                }
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }
    
    private fun analyzeAsset(symbol: String) {
        lifecycleScope.launch {
            try {
                val analysis = wealthArenaClient.analyze(
                    AnalyzeRequest(symbol = symbol)
                )
                
                runOnUiThread {
                    displayAnalysis(analysis)
                }
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }
    
    private fun getTradingState() {
        lifecycleScope.launch {
            try {
                val state = wealthArenaClient.state()
                
                runOnUiThread {
                    updateBalanceUI(state.balance)
                    updatePositionsUI(state.positions)
                }
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }
    
    private fun executeTrade() {
        lifecycleScope.launch {
            try {
                val trade = wealthArenaClient.paperTrade(
                    TradeRequest(
                        action = "buy",
                        symbol = "AAPL",
                        quantity = 10.0
                    )
                )
                
                runOnUiThread {
                    if (trade.success) {
                        showSuccessMessage(trade.message)
                        getTradingState() // Refresh state
                    } else {
                        showErrorMessage(trade.message)
                    }
                }
            } catch (e: Exception) {
                handleError(e)
            }
        }
    }
    
    private fun handleError(e: Exception) {
        runOnUiThread {
            when (e) {
                is WealthArenaException -> {
                    showErrorMessage("WealthArena Error: ${e.message}")
                }
                else -> {
                    showErrorMessage("Network Error: ${e.message}")
                }
            }
        }
    }
}
```

## Advanced Configuration

### 1. Custom Client Configuration

```kotlin
val client = WealthArenaClient.builder("http://127.0.0.1:8000")
    .token("your-auth-token")
    .timeout(30000) // 30 seconds
    .retries(3)
    .enableLogging(true) // Enable for debugging
    .build()
```

### 2. Error Handling

```kotlin
import com.wealtharena.mobile.sdk.WealthArenaException

try {
    val response = await wealthArenaClient.chat(request)
} catch (e: WealthArenaException) {
    when {
        e.status == 401 -> {
            // Handle authentication error
            redirectToLogin()
        }
        e.status == 404 -> {
            // Handle not found error
            showErrorMessage("Service not found")
        }
        e.status in 500..599 -> {
            // Handle server error
            showErrorMessage("Server error, please try again")
        }
        else -> {
            // Handle other errors
            showErrorMessage("Error: ${e.message}")
        }
    }
} catch (e: Exception) {
    // Handle network or other errors
    showErrorMessage("Network error: ${e.message}")
}
```

### 3. Background Processing

```kotlin
class TradingService : Service() {
    private val wealthArenaClient = createWealthArenaClient("http://127.0.0.1:8000")
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Perform background trading operations
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val state = wealthArenaClient.state()
                // Process state in background
                processTradingState(state)
            } catch (e: Exception) {
                Log.e("TradingService", "Error in background processing", e)
            }
        }
        
        return START_STICKY
    }
}
```

## Testing

### 1. Unit Tests

```kotlin
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.junit.MockitoJUnitRunner
import com.wealtharena.mobile.sdk.WealthArenaClient

@RunWith(MockitoJUnitRunner::class)
class WealthArenaClientTest {
    
    @Mock
    private lateinit var mockClient: WealthArenaClient
    
    @Test
    fun testHealthCheck() = runBlocking {
        // Mock health response
        val healthResponse = HealthResponse(
            status = "healthy",
            service = "wealtharena-mobile-api",
            version = "1.0.0",
            timestamp = "2024-01-01T00:00:00Z"
        )
        
        // Test health endpoint
        val result = mockClient.health()
        assertEquals("healthy", result.status)
    }
    
    @Test
    fun testChatRequest() = runBlocking {
        val request = ChatRequest(
            message = "What is RSI?",
            symbol = "AAPL"
        )
        
        val response = mockClient.chat(request)
        assertNotNull(response.reply)
        assertTrue(response.sources.isNotEmpty())
    }
}
```

### 2. Integration Tests

```kotlin
@RunWith(AndroidJUnit4::class)
class WealthArenaIntegrationTest {
    
    private lateinit var wealthArenaClient: WealthArenaClient
    
    @Before
    fun setup() {
        wealthArenaClient = createWealthArenaClient("http://127.0.0.1:8000")
    }
    
    @Test
    fun testFullIntegration() = runBlocking {
        // Test health
        val health = wealthArenaClient.health()
        assertEquals("healthy", health.status)
        
        // Test chat
        val chatResponse = wealthArenaClient.chat(
            ChatRequest(message = "Hello")
        )
        assertNotNull(chatResponse.reply)
        
        // Test analysis
        val analysis = wealthArenaClient.analyze(
            AnalyzeRequest(symbol = "AAPL")
        )
        assertEquals("AAPL", analysis.symbol)
        assertTrue(analysis.current_price > 0)
        
        // Test state
        val state = wealthArenaClient.state()
        assertTrue(state.balance >= 0)
    }
}
```

## Production Deployment

### 1. Proguard Configuration

Add to your `proguard-rules.pro`:

```proguard
# WealthArena SDK
-keep class com.wealtharena.mobile.sdk.** { *; }
-keep class com.wealtharena.mobile.sdk.models.** { *; }

# Retrofit
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
```

### 2. Network Security Configuration

Create `res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">127.0.0.1</domain>
        <domain includeSubdomains="true">localhost</domain>
    </domain-config>
</network-security-config>
```

Update `AndroidManifest.xml`:

```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    ... >
```

### 3. Production Configuration

```kotlin
// Production client configuration
val productionClient = WealthArenaClient.builder("https://api.wealtharena.com")
    .token(BuildConfig.WEALTHARENA_TOKEN)
    .timeout(30000)
    .retries(3)
    .enableLogging(BuildConfig.DEBUG)
    .build()
```

## Troubleshooting

### Common Issues

1. **Network Connection Issues**
   - Ensure your backend is running
   - Check network permissions in manifest
   - For emulator, use `http://10.0.2.2:8000`
   - For device, use your computer's IP address

2. **Build Issues**
   - Ensure all required dependencies are added
   - Check Proguard rules if using release builds
   - Verify Kotlin version compatibility

3. **Runtime Issues**
   - Check logs for detailed error messages
   - Ensure proper coroutine scope usage
   - Verify API endpoint URLs

### Debug Logging

Enable debug logging for troubleshooting:

```kotlin
val client = WealthArenaClient.builder("http://127.0.0.1:8000")
    .enableLogging(true)
    .build()
```

## Support

For issues and questions:
- Check the [GitHub repository](https://github.com/wealtharena/mobile-sdk)
- Review the [API documentation](https://docs.wealtharena.com)
- Contact support at support@wealtharena.com

