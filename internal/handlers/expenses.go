package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) GetExpenses(c *gin.Context) {
	filter := c.Query("filter")

	var where string
	switch filter {
	case "today":
		where = `WHERE created_at::date = CURRENT_DATE`
	case "month":
		where = `WHERE TO_CHAR(created_at,'YYYY-MM') = TO_CHAR(NOW(),'YYYY-MM')`
	default:
		where = ``
	}

	rows, err := h.DB.Query(`SELECT id, amount, category, note, created_by, created_at
		FROM expenses ` + where + ` ORDER BY created_at DESC LIMIT 200`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	type Expense struct {
		ID        int64   `json:"id"`
		Amount    float64 `json:"amount"`
		Category  string  `json:"category"`
		Note      string  `json:"note"`
		CreatedBy string  `json:"created_by"`
		CreatedAt string  `json:"created_at"`
	}

	var list []Expense
	for rows.Next() {
		var e Expense
		rows.Scan(&e.ID, &e.Amount, &e.Category, &e.Note, &e.CreatedBy, &e.CreatedAt)
		list = append(list, e)
	}

	var todayTotal, monthTotal float64
	h.DB.QueryRow(`SELECT COALESCE(SUM(amount),0) FROM expenses WHERE created_at::date=CURRENT_DATE`).Scan(&todayTotal)
	h.DB.QueryRow(`SELECT COALESCE(SUM(amount),0) FROM expenses WHERE TO_CHAR(created_at,'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM')`).Scan(&monthTotal)

	if list == nil {
		list = []Expense{}
	}
	c.JSON(http.StatusOK, gin.H{
		"items":      list,
		"todayTotal": todayTotal,
		"monthTotal": monthTotal,
	})
}

func (h *Handler) AddExpense(c *gin.Context) {
	var req struct {
		Amount   float64 `json:"amount"   binding:"required,gt=0"`
		Category string  `json:"category"`
		Note     string  `json:"note"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Маълумот нодуруст"})
		return
	}
	if req.Category == "" {
		req.Category = "other"
	}
	username := c.GetString("username")
	var id int64
	err := h.DB.QueryRow(
		`INSERT INTO expenses (amount, category, note, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
		req.Amount, req.Category, req.Note, username,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id})
}

func (h *Handler) DeleteExpense(c *gin.Context) {
	h.DB.Exec(`DELETE FROM expenses WHERE id = $1`, c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
