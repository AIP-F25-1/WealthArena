package com.wealtharena.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "trading_setups", indexes = {
    @Index(name = "idx_trading_setups_symbol_date", columnList = "symbol,signalDate")
})
public class TradingSetup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String symbol;

    @Column(nullable = false)
    private LocalDate signalDate;

    @Column(nullable = false, precision = 19, scale = 6)
    private BigDecimal entryPrice;

    @Column(nullable = false, precision = 19, scale = 6)
    private BigDecimal stopLoss;

    @Column(nullable = false, precision = 19, scale = 6)
    private BigDecimal takeProfit;

    @Column(nullable = false, precision = 19, scale = 6)
    private BigDecimal score;

    @Column(length = 50)
    private String strategy;

    public Long getId() { return id; }
    public String getSymbol() { return symbol; }
    public void setSymbol(String symbol) { this.symbol = symbol; }
    public LocalDate getSignalDate() { return signalDate; }
    public void setSignalDate(LocalDate signalDate) { this.signalDate = signalDate; }
    public BigDecimal getEntryPrice() { return entryPrice; }
    public void setEntryPrice(BigDecimal entryPrice) { this.entryPrice = entryPrice; }
    public BigDecimal getStopLoss() { return stopLoss; }
    public void setStopLoss(BigDecimal stopLoss) { this.stopLoss = stopLoss; }
    public BigDecimal getTakeProfit() { return takeProfit; }
    public void setTakeProfit(BigDecimal takeProfit) { this.takeProfit = takeProfit; }
    public BigDecimal getScore() { return score; }
    public void setScore(BigDecimal score) { this.score = score; }
    public String getStrategy() { return strategy; }
    public void setStrategy(String strategy) { this.strategy = strategy; }
}



