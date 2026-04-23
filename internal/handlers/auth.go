package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func (h *Handler) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			token = c.Query("token")
		}
		sess, ok := h.Store.Get(token)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}
		c.Set("username", sess.Username)
		c.Set("role", sess.Role)
		c.Next()
	}
}

func (h *Handler) RequireAdmin(c *gin.Context) {
	if c.GetString("role") != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Танҳо администратор иҷозат дорад"})
		c.Abort()
		return
	}
	c.Next()
}

func (h *Handler) HandleRegister(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Дархост нодуруст"})
		return
	}
	if len(req.Username) < 3 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Номи корбар ҳадди аққал 3 ҳарф"})
		return
	}
	if len(req.Password) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Парол ҳадди аққал 6 ҳарф"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Хатогии сервер"})
		return
	}

	var count int
	h.DB.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	role := "worker"
	if count == 0 {
		role = "admin"
	}

	_, err = h.DB.Exec(
		"INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)",
		req.Username, string(hash), role,
	)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Ин номи корбар банд аст"})
		return
	}
	tok := h.Store.Create(req.Username, role)
	c.JSON(http.StatusOK, gin.H{"token": tok, "username": req.Username, "role": role})
}

func (h *Handler) HandleLogin(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Дархост нодуруст"})
		return
	}
	var hash, role string
	if err := h.DB.QueryRow(
		"SELECT password_hash, role FROM users WHERE username = $1", req.Username,
	).Scan(&hash, &role); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Номи корбар ё парол нодуруст"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Номи корбар ё парол нодуруст"})
		return
	}
	tok := h.Store.Create(req.Username, role)
	c.JSON(http.StatusOK, gin.H{"token": tok, "username": req.Username, "role": role})
}

func (h *Handler) HandleLogout(c *gin.Context) {
	h.Store.Delete(c.GetHeader("Authorization"))
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}
