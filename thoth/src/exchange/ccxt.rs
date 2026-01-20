use crate::errors::{AppError, AppResult};
use crate::models::{Candle, MarketPrecision, Timeframe, TradingFees};
use crate::utils::str_to_bigdecimal;
use chrono::{TimeZone, Utc};
use pyo3::types::PyList;
use pyo3::{prelude::*, types::PyDict};
use std::str::FromStr;

#[derive(Debug)]
pub struct CCXT {
    exchange_name: String,
    instance: Py<PyAny>,
}

impl CCXT {
    const MODULE_NAME: &str = "ccxt";
    const AVAILABLE_EXCHANGES: [&str; 42] = [
        "apex",
        "ascendex",
        "bequant",
        "binance",
        "binanceus",
        "binanceusdm",
        "bingx",
        "bitbank",
        "bitget",
        "bithumb",
        "bitmex",
        "bitopro",
        "bitstamp",
        "bittrade",
        "bitvavo",
        "btcalpha",
        "btcmarkets",
        "bybit",
        "coinex",
        "coinmetro",
        "defx",
        "deribit",
        "fmfwio",
        "gemini",
        "hashkey",
        "hibachi",
        "hollaex",
        "htx",
        "huobi",
        "hyperliquid",
        "krakenfutures",
        "kucoin",
        "lbank",
        "mercado",
        "ndax",
        "oceanex",
        "okxus",
        "poloniex",
        "upbit",
        "whitebit",
        "woo",
        "zonda",
    ];

    pub fn exchanges() -> AppResult<Vec<String>> {
        Python::attach(|py| {
            let ccxt = py.import(Self::MODULE_NAME)?;
            let exchanges: Vec<String> = ccxt.getattr("exchanges")?.extract()?;

            let available_exchanges: Vec<String> = Self::AVAILABLE_EXCHANGES
                .iter()
                .map(|s| s.to_string())
                .filter(|s| exchanges.contains(s))
                .collect();

            Ok(available_exchanges)
        })
    }

    pub fn with_exchange(exchange: &str) -> AppResult<Self> {
        if !Self::AVAILABLE_EXCHANGES.contains(&exchange) {
            return Err(AppError::BadRequest(format!(
                "Invalid exchange: {}",
                exchange
            )));
        }

        Python::attach(|py| {
            let ccxt = py.import(Self::MODULE_NAME)?;
            let exchange_class = ccxt.getattr(exchange)?;
            let exchange_instance = exchange_class.call0()?;
            exchange_instance.call_method0("load_markets")?;

            Ok(Self {
                exchange_name: exchange.to_string(),
                instance: exchange_instance.unbind(),
            })
        })
    }

    pub fn symbols(&self) -> AppResult<Vec<String>> {
        Python::attach(|py| {
            let exchange = self.instance.bind(py);
            Ok(exchange.getattr("symbols")?.extract()?)
        })
    }

    pub fn timeframes(&self) -> AppResult<Vec<Timeframe>> {
        Python::attach(|py| {
            let exchange = self.instance.bind(py);
            let timeframes_any = exchange.getattr("timeframes")?;
            let timeframes_dict = timeframes_any.cast::<PyDict>()?;

            let mut timeframes = Vec::new();
            for key in timeframes_dict.keys() {
                let key: String = key.extract()?;
                timeframes.push(Timeframe::from_str(&key)?);
            }

            Ok(timeframes)
        })
    }

    pub fn fees(&self, symbol: &str) -> AppResult<TradingFees> {
        Python::attach(|py| {
            let exchange = self.instance.bind(py);
            let markets = exchange.getattr("markets")?;
            let market = markets.get_item(symbol)?;

            let maker: String = market.get_item("maker")?.str()?.extract()?;
            let taker: String = market.get_item("taker")?.str()?.extract()?;

            let maker = str_to_bigdecimal(&maker, "maker fee")?;
            let taker = str_to_bigdecimal(&taker, "taker fee")?;

            Ok(TradingFees { maker, taker })
        })
    }

    pub fn precision(&self, symbol: &str) -> AppResult<MarketPrecision> {
        Python::attach(|py| {
            let exchange = self.instance.bind(py);
            let markets = exchange.getattr("markets")?;
            let market = markets.get_item(symbol)?;
            let precision = market.get_item("precision")?;

            let price_value: String = precision.get_item("price")?.str()?.extract()?;
            let price_precision = str_to_bigdecimal(&price_value, "price precision")?;

            let amount_value: String = precision.get_item("amount")?.str()?.extract()?;
            let amount_precision = str_to_bigdecimal(&amount_value, "amount precision")?;

            Ok(MarketPrecision {
                price_precision,
                amount_precision,
            })
        })
    }

    pub fn fetch_candles(
        &self,
        symbol: &str,
        timeframe: Timeframe,
        since: Option<i64>,
        limit: Option<i64>,
    ) -> AppResult<Vec<Candle>> {
        Python::attach(|py| {
            let exchange = self.instance.bind(py);
            let args = (symbol, timeframe.to_string(), since, limit);

            let candles_any = exchange.call_method("fetch_ohlcv", args, None)?;
            let candles_list = candles_any
                .cast_into::<PyList>()
                .map_err(|e| format!("Failed to cast candles to PyList: {}", e))?;

            let mut candles = Vec::new();
            for item in candles_list.iter() {
                let candle_list = item
                    .cast_into::<PyList>()
                    .map_err(|e| format!("Failed to cast candle to PyList: {}", e))?;

                let timestamp_ms: i64 = candle_list.get_item(0)?.extract()?;
                let Some(timestamp) = Utc.timestamp_millis_opt(timestamp_ms).single() else {
                    return Err(format!("Error while parse timestamp: {}", timestamp_ms).into());
                };

                let open: String = candle_list.get_item(1)?.str()?.extract()?;
                let high: String = candle_list.get_item(2)?.str()?.extract()?;
                let low: String = candle_list.get_item(3)?.str()?.extract()?;
                let close: String = candle_list.get_item(4)?.str()?.extract()?;
                let volume: String = candle_list.get_item(5)?.str()?.extract()?;

                candles.push(Candle {
                    timestamp,
                    exchange: self.exchange_name.clone(),
                    symbol: symbol.to_string(),
                    timeframe,
                    open: str_to_bigdecimal(&open, "open price")?,
                    high: str_to_bigdecimal(&high, "high price")?,
                    low: str_to_bigdecimal(&low, "low price")?,
                    close: str_to_bigdecimal(&close, "close price")?,
                    volume: str_to_bigdecimal(&volume, "volume")?,
                });
            }

            Ok(candles)
        })
    }

    pub fn first_candle(&self, symbol: &str, timeframe: Timeframe) -> AppResult<Option<Candle>> {
        let mut left = 0i64;
        let mut right = Utc::now().timestamp_millis();
        let mut first_candle: Option<Candle> = None;

        while left <= right {
            let mid = left + (right - left) / 2;
            let candles = self.fetch_candles(symbol, timeframe, Some(mid), Some(1))?;

            if let Some(candle) = candles.into_iter().next() {
                first_candle = Some(candle);
                right = mid.saturating_sub(1);
            } else {
                left = mid.saturating_add(1);
            }
        }

        Ok(first_candle)
    }
}
