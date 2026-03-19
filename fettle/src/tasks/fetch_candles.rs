use crate::exchange::ccxt::CCXT;
use crate::models::Timeframe;
use crate::services::candles;
use crate::{errors::AppResult, services::tasks::save_fetch_candles_task};
use bigdecimal::ToPrimitive;
use chrono::{DateTime, Utc, serde::ts_milliseconds, serde::ts_milliseconds_option};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::{RwLock, broadcast};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FetchCandlesResult {
    pub symbol: String,
    pub exchange: String,
    pub timeframe: Timeframe,
    pub records: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum FetchCandlesStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FetchCandlesTask {
    pub id: Uuid,
    pub status: FetchCandlesStatus,
    pub progress: f32,
    pub symbol: String,
    pub exchange: String,
    pub timeframe: Timeframe,
    #[ts(optional)]
    pub result: Option<FetchCandlesResult>,
    #[ts(optional)]
    pub error_message: Option<String>,
    #[serde(with = "ts_milliseconds")]
    #[ts(type = "number")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "ts_milliseconds_option")]
    #[ts(optional, type = "number")]
    pub started_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_milliseconds_option")]
    #[ts(optional, type = "number")]
    pub completed_at: Option<DateTime<Utc>>,
    #[serde(with = "ts_milliseconds")]
    #[ts(type = "number")]
    pub updated_at: DateTime<Utc>,
    #[serde(skip)]
    #[ts(skip)]
    pub event_tx: Option<broadcast::Sender<FetchCandlesTask>>,
}

impl FetchCandlesTask {
    async fn update<F>(task: &Arc<RwLock<Self>>, update: F)
    where
        F: FnOnce(&mut Self),
    {
        let mut task = task.write().await;
        update(&mut task);
        task.broadcast();
    }

    pub fn broadcast(&self) {
        if let Some(tx) = &self.event_tx {
            let _ = tx.send(self.clone());
        }
    }

    pub async fn run(task: Arc<RwLock<Self>>, db_pool: PgPool) {
        let now = Utc::now();
        Self::update(&task, |task| {
            task.status = FetchCandlesStatus::Running;
            task.started_at = Some(now);
            task.updated_at = now;
        })
        .await;

        let task_snapshot = task.read().await.clone();
        let result = Self::execute_fetch(
            &task,
            &db_pool,
            &task_snapshot.exchange,
            &task_snapshot.symbol,
            task_snapshot.timeframe,
        )
        .await;
        let now = Utc::now();
        match result {
            Ok(fetch_result) => {
                Self::update(&task, |task| {
                    task.status = FetchCandlesStatus::Completed;
                    task.progress = 100.0;
                    task.result = Some(fetch_result);
                    task.completed_at = Some(now);
                    task.updated_at = now;
                })
                .await;
            }
            Err(e) => {
                Self::update(&task, |task| {
                    task.status = FetchCandlesStatus::Failed;
                    task.error_message = Some(e.to_string());
                    task.completed_at = Some(now);
                    task.updated_at = now;
                })
                .await;
            }
        }

        let task_snapshot = task.read().await.clone();
        save_fetch_candles_task(&db_pool, &task_snapshot)
            .await
            .expect("Failed to save fetch candles task");
    }

    async fn execute_fetch(
        task: &Arc<RwLock<Self>>,
        db_pool: &PgPool,
        exchange: &str,
        symbol: &str,
        timeframe: Timeframe,
    ) -> AppResult<FetchCandlesResult> {
        tracing::info!(
            "Fetching candles data for {} on {} with timeframe {}",
            symbol,
            exchange,
            timeframe
        );

        let ccxt = CCXT::with_exchange(&exchange)?;

        let timeframe_ms = timeframe.to_ms();
        let timeframe_delta = timeframe.to_delta();
        let mut next_since =
            match candles::get_latest_candle(db_pool, &exchange, &symbol, timeframe).await? {
                Some(latest_candle) => latest_candle.timestamp + timeframe_delta,
                None => {
                    let first_candle = ccxt.first_candle(&symbol, timeframe)?;
                    let Some(first_candle) = first_candle else {
                        return Err(format!(
                            "No candles data available for {} on {}",
                            symbol, exchange
                        )
                        .into());
                    };

                    first_candle.timestamp
                }
            };

        let now = Utc::now();
        let duration = now.signed_duration_since(next_since);
        let Some(time_diff_ms) = duration.num_milliseconds().to_u64() else {
            return Ok(FetchCandlesResult {
                symbol: symbol.to_string(),
                exchange: exchange.to_string(),
                timeframe,
                records: 0,
            });
        };

        let mut count: u64 = 0;
        let total = (time_diff_ms + timeframe_ms - 1) / timeframe_ms;
        let mut progress = 0.0;

        let now = Utc::now();
        Self::update(task, |task| {
            task.progress = progress;
            task.updated_at = now;
        })
        .await;

        loop {
            let next_since_ms = next_since.timestamp_millis();
            let epoch = ccxt.fetch_candles(&symbol, timeframe, Some(next_since_ms), None)?;
            let Some(latest) = epoch.last() else {
                break;
            };

            candles::insert_candles(db_pool, &epoch).await?;

            next_since = latest.timestamp + timeframe_delta;
            count += epoch.len() as u64;
            progress = 100.0 * (count as f32) / (total as f32);

            let now = Utc::now();
            Self::update(task, |task| {
                task.progress = progress;
                task.updated_at = now;
            })
            .await;
        }

        Ok(FetchCandlesResult {
            symbol: symbol.to_string(),
            exchange: exchange.to_string(),
            timeframe,
            records: total,
        })
    }
}
