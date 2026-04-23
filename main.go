package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"warehouse/internal/db"
	"warehouse/internal/handlers"
	"warehouse/internal/session"
)

func main() {
	db.Init()
	store := session.NewStore()
	h := &handlers.Handler{DB: db.DB, Store: store}

	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	router.Static("/static", "./static")
	router.GET("/", func(c *gin.Context) { c.File("./static/index.html") })

	router.POST("/api/register", h.HandleRegister)
	router.POST("/api/login", h.HandleLogin)

	api := router.Group("/api", h.AuthMiddleware())
	{
		api.POST("/logout", h.HandleLogout)

		api.GET("/products", h.GetProducts)
		api.POST("/products", h.AddProduct)
		api.PUT("/products/:id", h.UpdateProduct)
		api.DELETE("/products/:id", h.RequireAdmin, h.DeleteProduct)

		api.POST("/transactions", h.AddTransaction)
		api.GET("/transactions", h.GetTransactions)
		api.GET("/transactions/summary", h.GetTransactionSummary)

		api.GET("/stats", h.GetStats)
		api.GET("/profit", h.GetProfit)
		api.GET("/profile", h.GetProfile)

		api.GET("/settings", h.GetSettings)
		api.PUT("/settings", h.UpdateSettings)

		api.GET("/debts", h.GetDebts)
		api.POST("/debts", h.AddDebt)
		api.POST("/debts/:id/pay", h.PayDebt)
		api.DELETE("/debts/:id", h.DeleteDebt)

		api.GET("/expenses", h.GetExpenses)
		api.POST("/expenses", h.AddExpense)
		api.DELETE("/expenses/:id", h.DeleteExpense)

		// admin-only
		api.GET("/users", h.RequireAdmin, h.ListUsers)
		api.DELETE("/users/:id", h.RequireAdmin, h.DeleteUser)
		api.PUT("/users/:id/role", h.RequireAdmin, h.SetUserRole)

		api.GET("/admin/export-csv", h.RequireAdmin, h.ExportCSV)
		api.POST("/admin/backup", h.RequireAdmin, h.CreateBackup)
		api.GET("/admin/system-stats", h.RequireAdmin, h.GetSystemStats)
		api.GET("/admin/activity", h.RequireAdmin, h.GetAdminActivity)
	}

	log.Println("Server running on http://localhost:8080")
	if err := router.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
