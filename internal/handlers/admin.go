package handlers

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func (h *Handler) ExportCSV(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT p.code, p.name, p.category, p.brand, p.color, p.price,
		       ps.size, ps.quantity, ps.quantity * p.price
		FROM products p
		LEFT JOIN product_sizes ps ON ps.product_id = p.id
		ORDER BY p.name, ps.size`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="store_%s.csv"`, time.Now().Format("2006-01-02")))
	w := csv.NewWriter(c.Writer)
	w.Write([]string{"Код", "Ном", "Категория", "Бренд", "Ранг", "Нарх", "Размер", "Ҳаҷм", "Арзиш"})
	for rows.Next() {
		var code, name, cat, brand, color string
		var price, value float64
		var size sql.NullString
		var qty sql.NullInt64
		rows.Scan(&code, &name, &cat, &brand, &color, &price, &size, &qty, &value)
		w.Write([]string{
			code, name, cat, brand, color,
			fmt.Sprintf("%.2f", price),
			size.String, fmt.Sprintf("%d", qty.Int64),
			fmt.Sprintf("%.2f", value),
		})
	}
	w.Flush()
}

func (h *Handler) CreateBackup(c *gin.Context) {
	dbSrc := os.Getenv("DB_PATH")
	if dbSrc == "" {
		dbSrc = "./warehouse.db"
	}
	backupDir := os.Getenv("BACKUP_DIR")
	if backupDir == "" {
		backupDir = "."
	}
	path := fmt.Sprintf("%s/backup_%s.db", backupDir, time.Now().Format("2006-01-02_15-04-05"))
	src, err := os.ReadFile(dbSrc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read db"})
		return
	}
	if err := os.WriteFile(path, src, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to write backup"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Нусхабардорӣ шуд", "path": path})
}

func (h *Handler) GetSystemStats(c *gin.Context) {
	var productCount, userCount, txCount int
	h.DB.QueryRow("SELECT COUNT(*) FROM products").Scan(&productCount)
	h.DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&userCount)
	h.DB.QueryRow("SELECT COUNT(*) FROM product_transactions").Scan(&txCount)
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./warehouse.db"
	}
	info, _ := os.Stat(dbPath)
	size := int64(0)
	if info != nil {
		size = info.Size()
	}
	c.JSON(http.StatusOK, gin.H{
		"productCount": productCount,
		"userCount":    userCount,
		"txCount":      txCount,
		"dbSize":       fmt.Sprintf("%.1f KB", float64(size)/1024),
		"uptime":       time.Now().Format("2006-01-02 15:04:05"),
	})
}

// GetAdminActivity returns a unified activity feed for the admin cabinet.
// It merges transactions, expenses and debt payments into one chronological list.
func (h *Handler) GetAdminActivity(c *gin.Context) {
	limit := 100
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 500 {
			limit = n
		}
	}

	type ActivityItem struct {
		Kind      string  `json:"kind"`
		User      string  `json:"user"`
		Detail    string  `json:"detail"`
		Amount    float64 `json:"amount"`
		CreatedAt string  `json:"createdAt"`
	}

	var items []ActivityItem

	// transactions
	txRows, err := h.DB.Query(`
		SELECT type, product_name, size, quantity, price, created_by, created_at
		FROM product_transactions ORDER BY created_at DESC LIMIT $1`, limit)
	if err == nil {
		defer txRows.Close()
		for txRows.Next() {
			var typ, name, size, user, at string
			var qty int
			var price float64
			txRows.Scan(&typ, &name, &size, &qty, &price, &user, &at)
			kind := "in"
			if typ == "out" {
				kind = "out"
			}
			items = append(items, ActivityItem{
				Kind:      kind,
				User:      user,
				Detail:    fmt.Sprintf("%s / %s × %d", name, size, qty),
				Amount:    float64(qty) * price,
				CreatedAt: at,
			})
		}
	}

	// expenses
	expRows, err := h.DB.Query(`
		SELECT category, note, amount, created_by, created_at
		FROM expenses ORDER BY created_at DESC LIMIT $1`, limit)
	if err == nil {
		defer expRows.Close()
		for expRows.Next() {
			var cat, note, user, at string
			var amount float64
			expRows.Scan(&cat, &note, &amount, &user, &at)
			detail := cat
			if note != "" {
				detail += ": " + note
			}
			items = append(items, ActivityItem{
				Kind:      "expense",
				User:      user,
				Detail:    detail,
				Amount:    amount,
				CreatedAt: at,
			})
		}
	}

	// debt payments
	dpRows, err := h.DB.Query(`
		SELECT d.customer_name, dp.amount, dp.created_by, dp.created_at
		FROM debt_payments dp JOIN debts d ON d.id = dp.debt_id
		ORDER BY dp.created_at DESC LIMIT $1`, limit)
	if err == nil {
		defer dpRows.Close()
		for dpRows.Next() {
			var customer, user, at string
			var amount float64
			dpRows.Scan(&customer, &amount, &user, &at)
			items = append(items, ActivityItem{
				Kind:      "debt_pay",
				User:      user,
				Detail:    "Пардохт: " + customer,
				Amount:    amount,
				CreatedAt: at,
			})
		}
	}

	if items == nil {
		items = []ActivityItem{}
	}
	c.JSON(http.StatusOK, items)
}
