mod context;
mod handle;
mod manager;

use crate::errors::AppResult;
pub use context::{Order, OrderType, StrategyContext, Trade, TradeType};
pub use handle::StrategyHandle;
pub use manager::{STRATEGY_WORKDIR_NAME, StrategyManager};

pub trait Strategy: Send {
    fn tick(&mut self, context: &mut StrategyContext) -> AppResult<()>;
}
