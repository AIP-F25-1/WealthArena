package com.wealtharena.service;

import com.wealtharena.model.TradingSetup;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
public class TopSetupsBroadcastService {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private SetupService setupService;

    @Scheduled(fixedRate = 60000)
    public void publishTopSetups() {
        List<String> defaultSymbols = Arrays.asList("AAPL","MSFT","GOOGL","AMZN","TSLA","META","NVDA","NFLX");
        List<TradingSetup> setups = setupService.getTopSetups(defaultSymbols, 20, 10);
        messagingTemplate.convertAndSend("/topic/top-setups", setups);
    }
}




