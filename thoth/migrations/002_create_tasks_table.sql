CREATE TABLE fetch_candles_tasks (
    id UUID PRIMARY KEY,
    data JSONB NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE backtest_tasks (
    id UUID PRIMARY KEY,
    data JSONB NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL
);
