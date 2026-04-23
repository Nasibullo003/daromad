package handlers

import (
	"database/sql"

	"warehouse/internal/session"
)

type Handler struct {
	DB    *sql.DB
	Store *session.Store
}
