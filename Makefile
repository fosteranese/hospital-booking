.PHONY: dev-api dev-web dev db-migrate build

# Start the backend API server
dev-api:
	cd backend && cargo run

# Start the frontend dev server
dev-web:
	cd frontend && npm run dev

# Run both backend and frontend concurrently
dev:
	@echo "Starting backend and frontend..."
	@trap 'kill 0' EXIT; \
		(cd backend && cargo run) & \
		(cd frontend && npm run dev) & \
		wait

# Run database migrations
db-migrate:
	cd backend && DATABASE_URL=$${DATABASE_URL} cargo run -- --migrate-only 2>/dev/null || \
	cd backend && sqlx migrate run

# Full build
build:
	cd backend && cargo build
	cd frontend && npm run build

# Lint
lint:
	cd backend && cargo clippy -- -D warnings
	cd frontend && npm run lint
