use bigdecimal::BigDecimal;

#[derive(Debug, Clone)]
pub struct TradingFees {
    pub maker: BigDecimal,
    pub taker: BigDecimal,
}

#[derive(Debug, Clone)]
pub struct MarketPrecision {
    pub price_precision: BigDecimal,
    pub amount_precision: BigDecimal,
}
