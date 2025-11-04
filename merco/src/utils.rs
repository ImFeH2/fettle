use crate::errors::{AppError, AppResult};
use bigdecimal::{BigDecimal, RoundingMode, Zero};
use std::{
    path::{Path, PathBuf},
    str::FromStr,
};

pub fn safe_join(base_dir: &Path, path: &str) -> AppResult<PathBuf> {
    let path = path.trim().trim_start_matches('/');

    if path.contains("..") {
        return Err(AppError::BadRequest(
            "Path traversal attempt detected".to_string(),
        ));
    }

    let candidate = base_dir.join(path);
    let base_canonical = base_dir.canonicalize()?;

    let canonical = if candidate.exists() {
        candidate.canonicalize()?
    } else {
        if let Some(parent) = candidate.parent() {
            let canonical_parent = parent.canonicalize()?;
            let file_name = candidate
                .file_name()
                .ok_or(AppError::BadRequest("Invalid path".to_string()))?;
            canonical_parent.join(file_name)
        } else {
            candidate
        }
    };

    if !canonical.starts_with(&base_canonical) {
        return Err(AppError::BadRequest(
            "Path traversal attempt detected".to_string(),
        ));
    }

    Ok(canonical)
}

pub fn str_to_bigdecimal(value: &str, field_name: &str) -> AppResult<BigDecimal> {
    BigDecimal::from_str(value).map_err(|_| format!("Invalid {}: {}", field_name, value).into())
}

pub fn round_down_to_precision(value: &BigDecimal, precision: &BigDecimal) -> BigDecimal {
    if precision.is_zero() {
        return value.clone();
    }

    let divided = value / precision;
    let floored = divided.with_scale_round(0, RoundingMode::Down);
    floored * precision
}

pub fn round_up_to_precision(value: &BigDecimal, precision: &BigDecimal) -> BigDecimal {
    if precision.is_zero() {
        return value.clone();
    }

    let divided = value / precision;
    let ceiled = divided.with_scale_round(0, RoundingMode::Up);
    ceiled * precision
}
