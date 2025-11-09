mod config;

use merco::app::create_app;
use merco::errors::{AppError, AppResult};
use sqlx::postgres::PgPoolOptions;
use std::{
    net::{Ipv4Addr, SocketAddrV4},
    str::FromStr,
};
use tokio_util::sync::CancellationToken;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> AppResult<()> {
    let Ok(config) = config::Config::load() else {
        return Err(AppError::Internal(
            "Failed to load configuration".to_string(),
        ));
    };

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(config.log_level))
        .with(tracing_subscriber::fmt::layer())
        .init();
    tracing::info!("Loaded configuration");

    tracing::info!("Connecting to database at {}", config.database.url);
    let db_pool = PgPoolOptions::new()
        .max_connections(config.database.max_connections)
        .connect(&config.database.url)
        .await?;
    tracing::info!("Connected to database");

    sqlx::migrate!("./migrations").run(&db_pool).await?;

    let token = CancellationToken::new();
    let app = create_app(db_pool, token.clone()).await?;

    let Ok(host) = Ipv4Addr::from_str(&config.server.host) else {
        return Err(AppError::Internal(format!(
            "Invalid server host IP: {}",
            config.server.host
        )));
    };
    let addr = SocketAddrV4::new(host, config.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Server listening on {}", addr);

    async fn shutdown_signal(token: CancellationToken) {
        let _ = tokio::signal::ctrl_c().await;
        tracing::info!("Ctrl+C received, shutting down...");
        token.cancel();
    }

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(token.clone()))
        .await?;

    Ok(())
}
