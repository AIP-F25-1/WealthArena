package com.wealtharena.repository;

import com.wealtharena.model.TradingSetup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TradingSetupRepository extends JpaRepository<TradingSetup, Long> {
}



