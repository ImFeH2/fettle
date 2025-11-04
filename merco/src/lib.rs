#[doc(hidden)]
pub mod app;
#[doc(hidden)]
pub mod errors;
#[doc(hidden)]
pub mod exchange;
#[doc(hidden)]
pub mod handlers;
#[doc(hidden)]
pub mod models;
#[doc(hidden)]
pub mod services;
#[doc(hidden)]
pub mod strategy;
#[doc(hidden)]
pub mod tasks;
#[doc(hidden)]
pub mod utils;

pub use crate::errors::AppResult;
pub use crate::models::{Candle, MarketPrecision, Timeframe, TradingFees};
pub use crate::strategy::{Order, OrderType, Strategy, StrategyContext, Trade, TradeType};
pub use strategy_macro::strategy;
