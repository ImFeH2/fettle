use crate::app::AppState;
use crate::errors::{ApiResult, AppError};
use crate::models::Timeframe;
use crate::tasks::{FetchCandlesStatus, FetchCandlesTask};
use axum::{
    extract::{Path, State},
    response::{
        Json,
        sse::{Event, KeepAlive, Sse},
    },
};
use chrono::Utc;
use futures::stream::Stream;
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::sync::Arc;
use tokio::sync::RwLock;
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
pub struct CreateFetchCandlesTaskRequest {
    pub symbol: String,
    pub exchange: String,
    pub timeframe: Timeframe,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct CreateFetchCandlesTaskResponse {
    pub task_id: Uuid,
}

pub async fn create_task(
    State(state): State<AppState>,
    Json(request): Json<CreateFetchCandlesTaskRequest>,
) -> ApiResult<CreateFetchCandlesTaskResponse> {
    let now = Utc::now();
    let task = FetchCandlesTask {
        id: Uuid::new_v4(),
        status: FetchCandlesStatus::Pending,
        progress: 0.0,
        symbol: request.symbol.clone(),
        exchange: request.exchange.clone(),
        timeframe: request.timeframe,
        result: None,
        error_message: None,
        created_at: now,
        started_at: None,
        completed_at: None,
        updated_at: now,
        event_tx: Some(state.fetch_candles_event_tx.clone()),
    };

    let task_id = task.id;
    let task = Arc::new(RwLock::new(task));

    {
        let mut tasks = state.fetch_candles_tasks.write().await;
        tasks.insert(task_id, task.clone());
    }

    let db_pool = state.db_pool.clone();
    tokio::spawn(async move {
        let mut task = task.write().await;
        task.execute(db_pool).await;
    });

    Ok(Json(CreateFetchCandlesTaskResponse { task_id }))
}

pub async fn get_all_tasks(State(state): State<AppState>) -> ApiResult<Vec<FetchCandlesTask>> {
    let mut tasks = Vec::new();
    let fetch_candles_tasks = state.fetch_candles_tasks.read().await;
    for task in fetch_candles_tasks.values() {
        let task = task.read().await;
        tasks.push(task.clone());
    }

    Ok(Json(tasks))
}

pub async fn get_task(
    State(state): State<AppState>,
    Path(task_id): Path<Uuid>,
) -> ApiResult<FetchCandlesTask> {
    let fetch_candles_tasks = state.fetch_candles_tasks.read().await;
    let task = fetch_candles_tasks.get(&task_id);

    match task {
        Some(task) => {
            let task = task.read().await;
            Ok(Json(task.clone()))
        }
        _ => Err(AppError::NotFound(format!(
            "Task with id \"{}\" is not a FetchCandles task",
            task_id
        ))),
    }
}

pub async fn stream_tasks(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let mut rx = state.fetch_candles_event_tx.subscribe();
    let mut initial_events = Vec::new();
    {
        let fetch_candles_tasks = state.fetch_candles_tasks.read().await;
        for task in fetch_candles_tasks.values() {
            let task = task.read().await;
            if let Ok(data) = serde_json::to_string(&*task) {
                initial_events.push(data);
            }
        }
    }

    let stream = async_stream::stream! {
        for data in initial_events {
            yield Ok(Event::default().data(data));
        }

        loop {
            tokio::select! {
                _ = state.shutdown_token.cancelled() => {
                    break;
                }
                result = rx.recv() => {
                    let Ok(task) = result else {
                        break;
                    };

                    let Ok(data) = serde_json::to_string(&task) else {
                        continue;
                    };

                    yield Ok(Event::default().data(data));
                }
            }
        }
    };

    Sse::new(stream).keep_alive(KeepAlive::default())
}
