package com.wealtharena.service;

import com.wealtharena.model.PriceBar;
import com.wealtharena.model.TradingSetup;
import com.wealtharena.repository.PriceBarRepository;
import com.wealtharena.repository.TradingSetupRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

@Service
public class SetupService {

    @Autowired
    private PriceBarRepository priceBarRepository;

    @Autowired
    private TradingSetupRepository tradingSetupRepository;

    public List<TradingSetup> getTopSetups(List<String> symbols, int lookbackDays, int limit) {
        List<TradingSetup> setups = new ArrayList<>();
        for (String symbol : symbols) {
            List<PriceBar> bars = priceBarRepository.findBySymbolOrderByTradeDateDesc(symbol, PageRequest.of(0, Math.max(lookbackDays + 1, 30)));
            if (bars.size() < 15) {
                continue;
            }
            Collections.reverse(bars);

            BigDecimal latestClose = bars.get(bars.size() - 1).getClose();
            BigDecimal atr = calculateAtr(bars, 14);
            if (atr.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            BigDecimal momentum = calculateMomentum(bars, Math.min(lookbackDays, bars.size() - 1));
            BigDecimal rr = new BigDecimal("1.5");

            TradingSetup setup = new TradingSetup();
            setup.setSymbol(symbol);
            setup.setSignalDate(bars.get(bars.size() - 1).getTradeDate());
            setup.setEntryPrice(latestClose);
            setup.setStopLoss(latestClose.subtract(atr.multiply(new BigDecimal("2"))));
            setup.setTakeProfit(latestClose.add(atr.multiply(rr.multiply(new BigDecimal("2")))));
            BigDecimal volatility = atr.divide(latestClose, 8, RoundingMode.HALF_UP);
            BigDecimal score = momentum.subtract(volatility).multiply(new BigDecimal("100"));
            setup.setScore(score.setScale(6, RoundingMode.HALF_UP));
            setup.setStrategy("MOMENTUM_ATR");
            setups.add(setup);
        }

        setups.sort(Comparator.comparing(TradingSetup::getScore).reversed());
        if (setups.size() > limit) {
            setups = setups.subList(0, limit);
        }

        return setups;
    }

    public List<TradingSetup> persistSetups(List<TradingSetup> setups) {
        return tradingSetupRepository.saveAll(setups);
    }

    private BigDecimal calculateAtr(List<PriceBar> bars, int period) {
        BigDecimal atr = BigDecimal.ZERO;
        int count = 0;
        BigDecimal prevClose = null;
        for (int i = bars.size() - period; i < bars.size(); i++) {
            if (i <= 0) continue;
            PriceBar b = bars.get(i);
            BigDecimal highLow = b.getHigh().subtract(b.getLow()).abs();
            BigDecimal highPrevClose = prevClose == null ? BigDecimal.ZERO : b.getHigh().subtract(prevClose).abs();
            BigDecimal lowPrevClose = prevClose == null ? BigDecimal.ZERO : b.getLow().subtract(prevClose).abs();
            BigDecimal tr = highLow.max(highPrevClose).max(lowPrevClose);
            atr = atr.add(tr);
            prevClose = b.getClose();
            count++;
        }
        if (count == 0) return BigDecimal.ZERO;
        return atr.divide(new BigDecimal(count), 8, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateMomentum(List<PriceBar> bars, int period) {
        if (bars.size() <= period) return BigDecimal.ZERO;
        BigDecimal latest = bars.get(bars.size() - 1).getClose();
        BigDecimal prior = bars.get(bars.size() - 1 - period).getClose();
        if (prior.compareTo(BigDecimal.ZERO) == 0) return BigDecimal.ZERO;
        return latest.subtract(prior).divide(prior, 8, RoundingMode.HALF_UP);
    }
}



