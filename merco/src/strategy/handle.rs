use crate::errors::AppResult;
use crate::strategy::Strategy;
use libloading::{Library, Symbol};
use std::{
    ops::{Deref, DerefMut},
    path::PathBuf,
};

const PLUGIN_CREATE_FUNCTION_NAME: &'static str = "_plugin_create";

pub struct StrategyHandle {
    strategy: Box<dyn Strategy>,
    _lib: Library, // Keep the library loaded
}

impl StrategyHandle {
    pub fn try_from_path(path: &PathBuf) -> AppResult<Self> {
        unsafe {
            let lib = Library::new(path)?;
            let constructor: Symbol<fn() -> *mut dyn Strategy> =
                lib.get(PLUGIN_CREATE_FUNCTION_NAME.as_bytes())?;
            let strategy = Box::from_raw(constructor());
            Ok(Self {
                strategy,
                _lib: lib,
            })
        }
    }
}

impl Deref for StrategyHandle {
    type Target = Box<dyn Strategy>;
    fn deref(&self) -> &Self::Target {
        &self.strategy
    }
}

impl DerefMut for StrategyHandle {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.strategy
    }
}
