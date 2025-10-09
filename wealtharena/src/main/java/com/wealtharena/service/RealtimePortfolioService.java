package com.wealtharena.service;

import com.wealtharena.model.*;
import com.wealtharena.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class RealtimePortfolioService {

    @Autowired
    private PortfolioRepository portfolioRepository;
    
    @Autowired
    private PortfolioHoldingRepository portfolioHoldingRepository;
    
    @Autowired
    private YahooFinanceService yahooFinanceService;
    
    @Autowired
    private PriceBarRepository priceBarRepository;
    
    // Store active SSE connections
    private final Map<Long, List<SseEmitter>> portfolioConnections = new ConcurrentHashMap<>();
    
    // Cache for portfolio snapshots
    private final Map<Long, PortfolioSnapshot> portfolioCache = new ConcurrentHashMap<>();
    
    /**
     * Get real-time portfolio snapshot
     */
    public PortfolioSnapshot getRealtimePortfolioSnapshot(Long portfolioId) {
        try 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    {
            Portfolio portfolio = portfolioRepository.findById(portfolioId)
                .orElseThrow(() -> new RuntimeException("Portfolio not found"));
            
            List<PortfolioHolding> holdings = portfolioHoldingRepository.findByPortfolioId(portfolioId);
            
            // Calculate total values
            BigDecimal totalValue = BigDecimal.ZERO;
            BigDecimal totalCost = BigDecimal.ZERO;
            Map<String, PortfolioSnapshot.PositionSnapshot> positions = new HashMap<>();
            
            for (PortfolioHolding holding : holdings) {
                String symbol = holding.getSymbol();
                BigDecimal quantity = holding.getQuantity();
                BigDecimal averagePrice = holding.getAveragePrice();
                BigDecimal costBasis = quantity.multiply(averagePrice);
                
                // Get current price
                BigDecimal currentPrice = getCurrentPrice(symbol);
                BigDecimal marketValue = quantity.multiply(currentPrice);
                
                // Calculate P&L
                BigDecimal pnl = marketValue.subtract(costBasis);
                BigDecimal pnlPercent = costBasis.compareTo(BigDecimal.ZERO) > 0 ? 
                    pnl.divide(costBasis, 4, RoundingMode.HALF_UP) : BigDecimal.ZERO;
                
                // Create position snapshot
                PortfolioSnapshot.PositionSnapshot positionSnapshot = new PortfolioSnapshot.PositionSnapshot(
                    symbol, quantity, currentPrice, costBasis);
                positionSnapshot.setPnl(pnl);
                positionSnapshot.setPnlPercent(pnlPercent);
                positionSnapshot.setMarketValue(marketValue);
                
                positions.put(symbol, positionSnapshot);
                
                totalValue = totalValue.add(marketValue);
                totalCost = totalCost.add(costBasis);
            }
            
            // Create portfolio snapshot (cash not tracked in Portfolio entity; default to 0)
            PortfolioSnapshot snapshot = new PortfolioSnapshot(
                portfolioId, portfolio.getName(), totalValue, java.math.BigDecimal.ZERO, totalCost);
            
            // Calculate weights
            for (PortfolioSnapshot.PositionSnapshot position : positions.values()) {
                BigDecimal weight = totalValue.compareTo(BigDecimal.ZERO) > 0 ? 
                    position.getMarketValue().divide(totalValue, 4, RoundingMode.HALF_UP) : BigDecimal.ZERO;
                position.setWeight(weight);
            }
            
            snapshot.setPositions(positions);
            
            // Calculate performance metrics
            Map<String, Object> metrics = calculatePerformanceMetrics(portfolioId, snapshot);
            snapshot.setPerformanceMetrics(metrics);
            
            // Cache the snapshot
            portfolioCache.put(portfolioId, snapshot);
            
            return snapshot;
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to get real-time portfolio snapshot: " + e.getMessage());
        }
    }
    
    /**
     * Get real-time portfolio snapshots for all user portfolios
     */
    public List<PortfolioSnapshot> getRealtimePortfolioSnapshots(Long userId) {
        try {
            List<Portfolio> portfolios = portfolioRepository.findByUserId(userId);
            List<PortfolioSnapshot> snapshots = new ArrayList<>();
            
            for (Portfolio portfolio : portfolios) {
                PortfolioSnapshot snapshot = getRealtimePortfolioSnapshot(portfolio.getId());
                snapshots.add(snapshot);
            }
            
            return snapshots;
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to get real-time portfolio snapshots: " + e.getMessage());
        }
    }
    
    /**
     * Subscribe to real-time portfolio updates via SSE
     */
    public SseEmitter subscribeToPortfolioUpdates(Long portfolioId) {
        SseEmitter emitter = new SseEmitter(Long.MAX_VALUE);
        
        // Add to connections
        portfolioConnections.computeIfAbsent(portfolioId, k -> new CopyOnWriteArrayList<>()).add(emitter);
        
        // Send initial snapshot
        try {
            PortfolioSnapshot snapshot = getRealtimePortfolioSnapshot(portfolioId);
            emitter.send(snapshot);
        } catch (Exception e) {
            emitter.completeWithError(e);
        }
        
        // Handle completion and errors
        emitter.onCompletion(() -> removeConnection(portfolioId, emitter));
        emitter.onError(throwable -> removeConnection(portfolioId, emitter));
        emitter.onTimeout(() -> removeConnection(portfolioId, emitter));
        
        return emitter;
    }
    
    /**
     * Get real-time market data for symbols
     */
    public Map<String, BigDecimal> getRealtimePrices(List<String> symbols) {
        Map<String, BigDecimal> prices = new HashMap<>();
        
        for (String symbol : symbols) {
            try {
                BigDecimal price = getCurrentPrice(symbol);
                prices.put(symbol, price);
            } catch (Exception e) {
                // Use cached price if available
                BigDecimal cachedPrice = getCachedPrice(symbol);
                if (cachedPrice != null) {
                    prices.put(symbol, cachedPrice);
                }
            }
        }
        
        return prices;
    }
    
    /**
     * Get portfolio performance over time
     */
    public List<PortfolioSnapshot> getPortfolioPerformanceHistory(Long portfolioId, int days) {
        try {
            // This would typically query a time series database
            // For now, return current snapshot
            PortfolioSnapshot snapshot = getRealtimePortfolioSnapshot(portfolioId);
            return Arrays.asList(snapshot);
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to get portfolio performance history: " + e.getMessage());
        }
    }
    
    /**
     * Calculate portfolio performance metrics
     */
    private Map<String, Object> calculatePerformanceMetrics(Long portfolioId, PortfolioSnapshot snapshot) {
        Map<String, Object> metrics = new HashMap<>();
        
        // Basic metrics
        metrics.put("totalValue", snapshot.getTotalValue());
        metrics.put("totalCost", snapshot.getTotalCost());
        metrics.put("totalPnl", snapshot.getTotalPnl());
        metrics.put("totalPnlPercent", snapshot.getTotalPnlPercent());
        metrics.put("cash", snapshot.getCash());
        
        // Position metrics
        Map<String, PortfolioSnapshot.PositionSnapshot> positions = snapshot.getPositions();
        metrics.put("positionCount", positions.size());
        
        // Calculate diversification metrics
        BigDecimal totalWeight = positions.values().stream()
            .map(PortfolioSnapshot.PositionSnapshot::getWeight)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        metrics.put("totalWeight", totalWeight);
        
        // Calculate largest position
        Optional<PortfolioSnapshot.PositionSnapshot> largestPosition = positions.values().stream()
            .max(Comparator.comparing(PortfolioSnapshot.PositionSnapshot::getWeight));
        if (largestPosition.isPresent()) {
            metrics.put("largestPosition", largestPosition.get().getSymbol());
            metrics.put("largestPositionWeight", largestPosition.get().getWeight());
        }
        
        // Calculate performance by position
        Map<String, Object> positionPerformance = new HashMap<>();
        for (Map.Entry<String, PortfolioSnapshot.PositionSnapshot> entry : positions.entrySet()) {
            String symbol = entry.getKey();
            PortfolioSnapshot.PositionSnapshot position = entry.getValue();
            
            Map<String, Object> posMetrics = new HashMap<>();
            posMetrics.put("marketValue", position.getMarketValue());
            posMetrics.put("pnl", position.getPnl());
            posMetrics.put("pnlPercent", position.getPnlPercent());
            posMetrics.put("weight", position.getWeight());
            
            positionPerformance.put(symbol, posMetrics);
        }
        metrics.put("positionPerformance", positionPerformance);
        
        return metrics;
    }
    
    /**
     * Get current price for a symbol
     */
    private BigDecimal getCurrentPrice(String symbol) {
        try {
            // Try to get from Yahoo Finance service
            return yahooFinanceService.getCurrentPrice(symbol);
        } catch (Exception e) {
            // Fallback to cached price
            BigDecimal cachedPrice = getCachedPrice(symbol);
            if (cachedPrice != null) {
                return cachedPrice;
            }
            throw new RuntimeException("Unable to get current price for " + symbol);
        }
    }
    
    /**
     * Get cached price for a symbol
     */
    private BigDecimal getCachedPrice(String symbol) {
        try {
            // Get the most recent price from database
            return priceBarRepository.findFirstBySymbolOrderByTradeDateDesc(symbol)
                .map(PriceBar::getClose)
                .orElse(BigDecimal.ZERO);
        } catch (Exception e) {
            return BigDecimal.ZERO;
        }
    }
    
    /**
     * Remove SSE connection
     */
    private void removeConnection(Long portfolioId, SseEmitter emitter) {
        List<SseEmitter> connections = portfolioConnections.get(portfolioId);
        if (connections != null) {
            connections.remove(emitter);
            if (connections.isEmpty()) {
                portfolioConnections.remove(portfolioId);
            }
        }
    }
    
    /**
     * Scheduled task to update portfolio snapshots and send SSE updates
     */
    @Scheduled(fixedRate = 30000) // Update every 30 seconds
    public void updatePortfolioSnapshots() {
        try {
            // Update all cached portfolios
            for (Long portfolioId : portfolioCache.keySet()) {
                PortfolioSnapshot snapshot = getRealtimePortfolioSnapshot(portfolioId);
                portfolioCache.put(portfolioId, snapshot);
                
                // Send updates to subscribers
                List<SseEmitter> connections = portfolioConnections.get(portfolioId);
                if (connections != null) {
                    for (SseEmitter emitter : connections) {
                        try {
                            emitter.send(snapshot);
                        } catch (Exception e) {
                            // Remove failed connections
                            connections.remove(emitter);
                        }
                    }
                }
            }
        } catch (Exception e) {
            // Log error but don't stop the scheduled task
            System.err.println("Error updating portfolio snapshots: " + e.getMessage());
        }
    }
    
    /**
     * Get portfolio alerts and notifications
     */
    public List<Map<String, Object>> getPortfolioAlerts(Long portfolioId) {
        List<Map<String, Object>> alerts = new ArrayList<>();
        
        try {
            PortfolioSnapshot snapshot = getRealtimePortfolioSnapshot(portfolioId);
            
            // Check for significant P&L changes
            BigDecimal totalPnlPercent = snapshot.getTotalPnlPercent();
            if (totalPnlPercent.abs().compareTo(new BigDecimal("0.05")) > 0) { // 5% threshold
                Map<String, Object> alert = new HashMap<>();
                alert.put("type", "P&L_ALERT");
                alert.put("message", "Portfolio P&L: " + totalPnlPercent.multiply(new BigDecimal("100")) + "%");
                alert.put("severity", totalPnlPercent.compareTo(BigDecimal.ZERO) > 0 ? "POSITIVE" : "NEGATIVE");
                alert.put("timestamp", LocalDateTime.now());
                alerts.add(alert);
            }
            
            // Check for position concentration
            Map<String, PortfolioSnapshot.PositionSnapshot> positions = snapshot.getPositions();
            for (PortfolioSnapshot.PositionSnapshot position : positions.values()) {
                if (position.getWeight().compareTo(new BigDecimal("0.3")) > 0) { // 30% threshold
                    Map<String, Object> alert = new HashMap<>();
                    alert.put("type", "CONCENTRATION_ALERT");
                    alert.put("message", "High concentration in " + position.getSymbol() + ": " + 
                        position.getWeight().multiply(new BigDecimal("100")) + "%");
                    alert.put("severity", "WARNING");
                    alert.put("timestamp", LocalDateTime.now());
                    alerts.add(alert);
                }
            }
            
        } catch (Exception e) {
            // Log error
            System.err.println("Error getting portfolio alerts: " + e.getMessage());
        }
        
        return alerts;
    }
}
