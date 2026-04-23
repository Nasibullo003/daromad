package db

import (
	"database/sql"
	"log"
	"os"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func Init() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost port=5433 user=daromad password=daromad dbname=daromad sslmode=disable"
	}
	var err error
	DB, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal("DB open:", err)
	}
	if err = DB.Ping(); err != nil {
		log.Fatal("DB ping:", err)
	}
	initSchema()
}

func initSchema() {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id            BIGSERIAL PRIMARY KEY,
			username      TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			role          TEXT NOT NULL DEFAULT 'worker',
			created_at    TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS products (
			id         BIGSERIAL PRIMARY KEY,
			code       TEXT UNIQUE NOT NULL,
			name       TEXT NOT NULL,
			category   TEXT NOT NULL DEFAULT 'other',
			brand      TEXT DEFAULT '',
			color      TEXT DEFAULT '',
			price      DOUBLE PRECISION NOT NULL DEFAULT 0,
			cost_price DOUBLE PRECISION NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS product_sizes (
			id         BIGSERIAL PRIMARY KEY,
			product_id BIGINT NOT NULL,
			size       TEXT NOT NULL,
			quantity   INTEGER NOT NULL DEFAULT 0,
			UNIQUE(product_id, size)
		)`,
		`CREATE TABLE IF NOT EXISTS product_transactions (
			id           BIGSERIAL PRIMARY KEY,
			product_id   BIGINT NOT NULL,
			product_code TEXT NOT NULL,
			product_name TEXT NOT NULL,
			size         TEXT NOT NULL,
			type         TEXT NOT NULL,
			quantity     INTEGER NOT NULL,
			price        DOUBLE PRECISION NOT NULL,
			cost_price   DOUBLE PRECISION NOT NULL DEFAULT 0,
			note         TEXT DEFAULT '',
			created_by   TEXT NOT NULL,
			created_at   TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS settings (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL DEFAULT ''
		)`,
		`CREATE TABLE IF NOT EXISTS debts (
			id            BIGSERIAL PRIMARY KEY,
			customer_name TEXT NOT NULL,
			phone         TEXT DEFAULT '',
			amount        DOUBLE PRECISION NOT NULL DEFAULT 0,
			note          TEXT DEFAULT '',
			created_by    TEXT NOT NULL,
			created_at    TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS debt_payments (
			id         BIGSERIAL PRIMARY KEY,
			debt_id    BIGINT NOT NULL,
			amount     DOUBLE PRECISION NOT NULL,
			note       TEXT DEFAULT '',
			created_by TEXT NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS expenses (
			id         BIGSERIAL PRIMARY KEY,
			amount     DOUBLE PRECISION NOT NULL,
			category   TEXT NOT NULL DEFAULT 'other',
			note       TEXT DEFAULT '',
			created_by TEXT NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`,
	}
	for _, s := range stmts {
		if _, err := DB.Exec(s); err != nil {
			log.Fatal("Schema:", err)
		}
	}
	// first registered user becomes admin
	DB.Exec(`UPDATE users SET role='admin' WHERE id=(SELECT MIN(id) FROM users) AND role='worker'`)
}
