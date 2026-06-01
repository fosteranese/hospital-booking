use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{get, put},
};
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::middleware::auth::{AuthUser, require_role};
use crate::state::AppState;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct User {
    pub identifier: String,
    pub role: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct UpdateRoleRequest {
    pub role: String,
}

pub async fn list_users(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<User>>, AppError> {
    require_role(&auth, &["admin"])?;
    let users = sqlx::query_as::<_, User>(
        "SELECT * FROM users ORDER BY created_at DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?;
    Ok(Json(users))
}

pub async fn update_user_role(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(identifier): Path<String>,
    Json(body): Json<UpdateRoleRequest>,
) -> Result<Json<User>, AppError> {
    state.check_mutation_rate_limit(&format!("update_user_role:{}", auth.sub))?;
    require_role(&auth, &["admin"])?;

    let valid_roles = ["patient", "doctor", "scheduler", "admin"];
    if !valid_roles.contains(&body.role.as_str()) {
        return Err(AppError::Validation(format!(
            "Invalid role '{}'. Must be one of: patient, doctor, scheduler, admin",
            body.role
        )));
    }

    let user = sqlx::query_as::<_, User>(
        "UPDATE users SET role = $1 WHERE identifier = $2 RETURNING *"
    )
    .bind(&body.role)
    .bind(&identifier)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| AppError::Database(e))?
    .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    Ok(Json(user))
}

pub fn users_routes() -> Router<AppState> {
    Router::new()
        .route("/api/users", get(list_users))
        .route("/api/users/:identifier/role", put(update_user_role))
}
