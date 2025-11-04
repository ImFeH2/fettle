use crate::tasks::{BacktestTask, FetchCandlesTask};
use crate::{handlers, strategy::StrategyManager};
use axum::{
    Router,
    routing::{get, post},
};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, broadcast};
use tokio_util::sync::CancellationToken;
use tower_http::cors::{Any, CorsLayer};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct AppState {
    pub fetch_candles_event_tx: broadcast::Sender<FetchCandlesTask>,
    pub fetch_candles_tasks: Arc<RwLock<HashMap<Uuid, Arc<RwLock<FetchCandlesTask>>>>>,
    pub backtest_event_tx: broadcast::Sender<BacktestTask>,
    pub backtest_tasks: Arc<RwLock<HashMap<Uuid, Arc<RwLock<BacktestTask>>>>>,
    pub strategy_manager: StrategyManager,
    pub db_pool: PgPool,
    pub shutdown_token: CancellationToken,
}

pub fn create_app(db_pool: PgPool, shutdown_token: CancellationToken) -> Router {
    let (fetch_candles_event_tx, _) = broadcast::channel(1000);
    let fetch_candles_tasks = Arc::new(RwLock::new(HashMap::new()));
    let (backtest_event_tx, _) = broadcast::channel(1000);
    let backtest_tasks = Arc::new(RwLock::new(HashMap::new()));
    let strategy_manager = StrategyManager::new().expect("Failed to create StrategyManager");

    let state = AppState {
        fetch_candles_event_tx,
        fetch_candles_tasks,
        backtest_event_tx,
        backtest_tasks,
        strategy_manager,
        db_pool,
        shutdown_token,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/health", get(handlers::info::check))
        .route("/exchanges", get(handlers::info::list_exchanges))
        .route("/symbols", get(handlers::info::list_symbols))
        .route("/timeframes", get(handlers::info::list_timeframes))
        .route("/tasks/fetch", get(handlers::fetch_candles::get_all_tasks))
        .route("/tasks/fetch", post(handlers::fetch_candles::create_task))
        .route("/tasks/fetch/{id}", get(handlers::fetch_candles::get_task))
        .route(
            "/tasks/fetch/stream",
            get(handlers::fetch_candles::stream_tasks),
        )
        .route("/tasks/backtest", get(handlers::backtest::get_all_tasks))
        .route("/tasks/backtest", post(handlers::backtest::create_task))
        .route("/tasks/backtest/{id}", get(handlers::backtest::get_task))
        .route(
            "/tasks/backtest/stream",
            get(handlers::backtest::stream_tasks),
        )
        .route("/candles", get(handlers::candles::get_candles))
        .route(
            "/candles/available",
            get(handlers::candles::available_candles),
        )
        .route("/strategy/list", get(handlers::strategy::list_strategies))
        .route("/strategy/add", post(handlers::strategy::add_strategy))
        .route("/strategy/source/get", get(handlers::source::get_source))
        .route("/strategy/source/save", post(handlers::source::save_source))
        .route(
            "/strategy/source/delete",
            get(handlers::source::delete_source),
        )
        .route("/strategy/source/move", get(handlers::source::move_source))
        .layer(cors)
        .with_state(state)
}
