use crate::errors::ApiResult;
use crate::exchange::ccxt::CCXT;
use crate::models::Timeframe;
use axum::{Json, extract::Query};
use serde::Deserialize;
use ts_rs::TS;

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
pub struct ExchangeQuery {
    pub exchange: String,
}

pub async fn check() -> ApiResult<&'static str> {
    Ok(Json("OK"))
}

pub async fn list_exchanges() -> ApiResult<Vec<String>> {
    Ok(Json(CCXT::exchanges()?))
}

pub async fn list_symbols(Query(query): Query<ExchangeQuery>) -> ApiResult<Vec<String>> {
    let exchange = CCXT::with_exchange(&query.exchange)?;
    Ok(Json(exchange.symbols()?))
}

pub async fn list_timeframes(Query(query): Query<ExchangeQuery>) -> ApiResult<Vec<Timeframe>> {
    let exchange = CCXT::with_exchange(&query.exchange)?;
    Ok(Json(exchange.timeframes()?))
}
