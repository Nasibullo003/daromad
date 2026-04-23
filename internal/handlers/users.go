package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) ListUsers(c *gin.Context) {
	rows, err := h.DB.Query("SELECT id, username, role, created_at FROM users ORDER BY id ASC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	type User struct {
		ID        int64  `json:"id"`
		Username  string `json:"username"`
		Role      string `json:"role"`
		CreatedAt string `json:"createdAt"`
	}
	var users []User
	for rows.Next() {
		var u User
		rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt)
		users = append(users, u)
	}
	if users == nil {
		users = []User{}
	}
	c.JSON(http.StatusOK, users)
}

func (h *Handler) DeleteUser(c *gin.Context) {
	me := c.GetString("username")
	var uname string
	h.DB.QueryRow("SELECT username FROM users WHERE id = $1", c.Param("id")).Scan(&uname)
	if uname == me {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Худатонро нест карда намешавад"})
		return
	}
	result, err := h.DB.Exec("DELETE FROM users WHERE id = $1", c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Корбар ёфт нашуд"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) SetUserRole(c *gin.Context) {
	var req struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Маълумот нодуруст"})
		return
	}
	if req.Role != "admin" && req.Role != "worker" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Нақш нодуруст"})
		return
	}
	me := c.GetString("username")
	var uname string
	h.DB.QueryRow("SELECT username FROM users WHERE id = $1", c.Param("id")).Scan(&uname)
	if uname == me && req.Role != "admin" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Администратор худашро паст карда наметавонад"})
		return
	}
	result, err := h.DB.Exec("UPDATE users SET role=$1 WHERE id=$2", req.Role, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Корбар ёфт нашуд"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok", "role": req.Role})
}
