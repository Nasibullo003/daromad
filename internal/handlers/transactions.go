package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) AddTransaction(c *gin.Context) {
	var req struct {
		ProductID int64   `json:"product_id" binding:"required"`
		Size      string  `json:"size"       binding:"required"`
		Type      string  `json:"type"       binding:"required"`
		Quantity  int     `json:"quantity"   binding:"required,gt=0"`
		Price     float64 `json:"price"      binding:"required,gt=0"`
		SalePrice float64 `json:"sale_price"`
		Note      string  `json:"note"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Маълумот нодуруст"})
		return
	}
	if req.Type != "in" && req.Type != "out" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Намуд: 'in' ё 'out'"})
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback()

	var pCode, pName string
	var prodCostPrice float64
	if err := tx.QueryRow("SELECT code, name, cost_price FROM products WHERE id = $1", req.ProductID).Scan(&pCode, &pName, &prodCostPrice); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Маҳсулот ёфт нашуд"})
		return
	}

	txCostPrice := prodCostPrice

	if req.Type == "in" {
		_, err = tx.Exec(
			`INSERT INTO product_sizes (product_id, size, quantity) VALUES ($1, $2, $3)
			 ON CONFLICT(product_id, size) DO UPDATE SET quantity = product_sizes.quantity + EXCLUDED.quantity`,
			req.ProductID, req.Size, req.Quantity,
		)
		tx.Exec(`UPDATE products SET cost_price = $1 WHERE id = $2`, req.Price, req.ProductID)
		txCostPrice = req.Price
		if req.SalePrice > 0 {
			tx.Exec(`UPDATE products SET price = $1 WHERE id = $2`, req.SalePrice, req.ProductID)
		}
	} else {
		var cur int
		tx.QueryRow("SELECT COALESCE(quantity,0) FROM product_sizes WHERE product_id=$1 AND size=$2", req.ProductID, req.Size).Scan(&cur)
		if cur < req.Quantity {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Дар омбор %d дона. Кофӣ нест", cur)})
			return
		}
		_, err = tx.Exec(
			`UPDATE product_sizes SET quantity = quantity - $1 WHERE product_id = $2 AND size = $3`,
			req.Quantity, req.ProductID, req.Size,
		)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	username := c.GetString("username")
	_, err = tx.Exec(
		`INSERT INTO product_transactions (product_id, product_code, product_name, size, type, quantity, price, cost_price, note, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		req.ProductID, pCode, pName, req.Size, req.Type, req.Quantity, req.Price, txCostPrice, req.Note, username,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

func (h *Handler) GetTransactions(c *gin.Context) {
	txType := c.Query("type")
	query := `SELECT id, product_id, product_code, product_name, size, type, quantity, price,
	           quantity*price, note, created_by, created_at FROM product_transactions`
	var args []interface{}
	if txType == "in" || txType == "out" {
		query += " WHERE type = $1"
		args = append(args, txType)
	}
	query += " ORDER BY created_at DESC LIMIT 300"

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type TX struct {
		ID          int64   `json:"id"`
		ProductID   int64   `json:"productId"`
		ProductCode string  `json:"productCode"`
		ProductName string  `json:"productName"`
		Size        string  `json:"size"`
		Type        string  `json:"type"`
		Quantity    int     `json:"quantity"`
		Price       float64 `json:"price"`
		Total       float64 `json:"total"`
		Note        string  `json:"note"`
		CreatedBy   string  `json:"createdBy"`
		CreatedAt   string  `json:"createdAt"`
	}
	var list []TX
	for rows.Next() {
		var t TX
		rows.Scan(&t.ID, &t.ProductID, &t.ProductCode, &t.ProductName, &t.Size,
			&t.Type, &t.Quantity, &t.Price, &t.Total, &t.Note, &t.CreatedBy, &t.CreatedAt)
		list = append(list, t)
	}
	if list == nil {
		list = []TX{}
	}
	c.JSON(http.StatusOK, list)
}

func (h *Handler) GetTransactionSummary(c *gin.Context) {
	var totalIn, totalOut, todayIn, todayOut float64
	h.DB.QueryRow(`SELECT COALESCE(SUM(quantity*price),0) FROM product_transactions WHERE type='in'`).Scan(&totalIn)
	h.DB.QueryRow(`SELECT COALESCE(SUM(quantity*price),0) FROM product_transactions WHERE type='out'`).Scan(&totalOut)
	h.DB.QueryRow(`SELECT COALESCE(SUM(quantity*price),0) FROM product_transactions WHERE type='in' AND created_at::date=CURRENT_DATE`).Scan(&todayIn)
	h.DB.QueryRow(`SELECT COALESCE(SUM(quantity*price),0) FROM product_transactions WHERE type='out' AND created_at::date=CURRENT_DATE`).Scan(&todayOut)
	c.JSON(http.StatusOK, gin.H{"totalIn": totalIn, "totalOut": totalOut, "todayIn": todayIn, "todayOut": todayOut})
}
