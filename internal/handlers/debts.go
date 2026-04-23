package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"warehouse/internal/models"
)

func (h *Handler) GetDebts(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT d.id, d.customer_name, d.phone, d.amount,
		       COALESCE((SELECT SUM(amount) FROM debt_payments WHERE debt_id = d.id), 0),
		       d.note, d.created_by, d.created_at
		FROM debts d ORDER BY d.created_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	var list []models.Debt
	for rows.Next() {
		var d models.Debt
		rows.Scan(&d.ID, &d.CustomerName, &d.Phone, &d.Amount, &d.PaidAmount, &d.Note, &d.CreatedBy, &d.CreatedAt)
		d.Remaining = d.Amount - d.PaidAmount
		list = append(list, d)
	}
	if list == nil {
		list = []models.Debt{}
	}
	c.JSON(http.StatusOK, list)
}

func (h *Handler) AddDebt(c *gin.Context) {
	var req struct {
		CustomerName string  `json:"customerName" binding:"required"`
		Phone        string  `json:"phone"`
		Amount       float64 `json:"amount"       binding:"required,gt=0"`
		Note         string  `json:"note"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Маълумот нодуруст"})
		return
	}
	username := c.GetString("username")
	var id int64
	err := h.DB.QueryRow(
		`INSERT INTO debts (customer_name, phone, amount, note, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		req.CustomerName, req.Phone, req.Amount, req.Note, username,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id})
}

func (h *Handler) PayDebt(c *gin.Context) {
	var req struct {
		Amount float64 `json:"amount" binding:"required,gt=0"`
		Note   string  `json:"note"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Маълумот нодуруст"})
		return
	}
	debtID := c.Param("id")

	var total, paid float64
	err := h.DB.QueryRow(`
		SELECT d.amount, COALESCE((SELECT SUM(amount) FROM debt_payments WHERE debt_id = d.id), 0)
		FROM debts d WHERE d.id = $1`, debtID).Scan(&total, &paid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Карз ёфт нашуд"})
		return
	}
	remaining := total - paid
	if req.Amount > remaining+0.001 {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Боқимонда: %.2f смн. Зиёд пардохт карда наметавон", remaining)})
		return
	}
	username := c.GetString("username")
	h.DB.Exec(
		`INSERT INTO debt_payments (debt_id, amount, note, created_by) VALUES ($1, $2, $3, $4)`,
		debtID, req.Amount, req.Note, username,
	)
	c.JSON(http.StatusOK, gin.H{"message": "ok", "remaining": remaining - req.Amount})
}

func (h *Handler) DeleteDebt(c *gin.Context) {
	h.DB.Exec("DELETE FROM debt_payments WHERE debt_id = $1", c.Param("id"))
	result, err := h.DB.Exec("DELETE FROM debts WHERE id = $1", c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Карз ёфт нашуд"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
