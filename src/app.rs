use crate::handlers;
use crate::tasks::TaskManager;
use axum::{
    Router,
    routing::{get, post},
};
use sqlx::PgPool;
use tokio_util::sync::CancellationToken;
use tower_http::cors::{CorsLayer, Any};

#[derive(Debug, Clone)]
pub struct AppState {
    pub task_manager: TaskManager,
    pub db_pool: PgPool,
    pub shutdown_token: CancellationToken,
}

pub fn create_app(db_pool: PgPool, shutdown_token: CancellationToken) -> Router {
    let task_manager = TaskManager::new();
    let state = AppState {
        task_manager,
        db_pool,
        shutdown_token,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/health", get(handlers::info::check))
        .route("/error", get(handlers::info::error))
        .route("/exchanges", get(handlers::info::list_exchanges))
        .route("/symbols", get(handlers::info::list_symbols))
        .route("/timeframes", get(handlers::info::list_timeframes))
        .route("/tasks", get(handlers::tasks::get_all_tasks))
        .route("/tasks/{id}", get(handlers::tasks::get_task))
        .route("/tasks/stream", get(handlers::tasks::stream_tasks))
        .route("/tasks/fetch", post(handlers::tasks::create_fetch_task))
        .route("/candles", get(handlers::candles::get_candles))
        .layer(cors)
        .with_state(state)
}
