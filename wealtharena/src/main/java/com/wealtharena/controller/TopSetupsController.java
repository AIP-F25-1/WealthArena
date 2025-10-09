package com.wealtharena.controller;

import com.wealtharena.model.TradingSetup;
import com.wealtharena.service.SetupService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class TopSetupsController {

    @Autowired
    private SetupService setupService;

    @GetMapping("/top-setups")
    public ResponseEntity<List<TradingSetup>> getTopSetups(
            @RequestParam(defaultValue = "AAPL,MSFT,GOOGL,AMZN,TSLA,META,NVDA,NFLX") String symbols,
            @RequestParam(defaultValue = "20") int lookbackDays,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "false") boolean persist) {
        List<String> symbolList = Arrays.stream(symbols.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        List<TradingSetup> setups = setupService.getTopSetups(symbolList, lookbackDays, limit);
        if (persist) {
            setups = setupService.persistSetups(setups);
        }
        return ResponseEntity.ok(setups);
    }
}



