use crate::errors::AppResult;
use crate::tasks::{BacktestTask, FetchCandlesTask};
use sqlx::PgPool;

pub async fn save_fetch_candles_task(pool: &PgPool, task: &FetchCandlesTask) -> AppResult<()> {
    let data = serde_json::to_value(task)?;
    let completed_at = task.completed_at.ok_or("Task not completed yet")?;

    sqlx::query!(
        r#"
        INSERT INTO fetch_candles_tasks (id, data, completed_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET
            data = EXCLUDED.data,
            completed_at = EXCLUDED.completed_at
        "#,
        task.id,
        data,
        completed_at
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn load_fetch_candles_tasks(pool: &PgPool) -> AppResult<Vec<FetchCandlesTask>> {
    let rows = sqlx::query!(
        r#"
        SELECT data
        FROM fetch_candles_tasks
        ORDER BY completed_at DESC
        "#
    )
    .fetch_all(pool)
    .await?;

    let mut tasks = Vec::new();
    for row in rows {
        let task = serde_json::from_value(row.data)?;
        tasks.push(task);
    }

    Ok(tasks)
}

pub async fn save_backtest_task(pool: &PgPool, task: &BacktestTask) -> AppResult<()> {
    let data = serde_json::to_value(task)?;
    let completed_at = task.completed_at.ok_or("Task not completed yet")?;

    sqlx::query!(
        r#"
        INSERT INTO backtest_tasks (id, data, completed_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET
            data = EXCLUDED.data,
            completed_at = EXCLUDED.completed_at
        "#,
        task.id,
        data,
        completed_at
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn load_backtest_tasks(pool: &PgPool) -> AppResult<Vec<BacktestTask>> {
    let rows = sqlx::query!(
        r#"
        SELECT data
        FROM backtest_tasks
        ORDER BY completed_at DESC
        "#
    )
    .fetch_all(pool)
    .await?;

    let mut tasks = Vec::new();
    for row in rows {
        let task = serde_json::from_value(row.data)?;
        tasks.push(task);
    }

    Ok(tasks)
}
