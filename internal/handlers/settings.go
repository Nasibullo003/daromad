package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) GetSettings(c *gin.Context) {
	rows, err := h.DB.Query("SELECT key, value FROM settings")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	m := map[string]string{}
	for rows.Next() {
		var k, v string
		rows.Scan(&k, &v)
		m[k] = v
	}
	c.JSON(http.StatusOK, m)
}

func (h *Handler) UpdateSettings(c *gin.Context) {
	var req map[string]string
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Маълумот нодуруст"})
		return
	}
	for k, v := range req {
		h.DB.Exec(
			`INSERT INTO settings (key, value) VALUES ($1, $2)
			 ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value`, k, v,
		)
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}
