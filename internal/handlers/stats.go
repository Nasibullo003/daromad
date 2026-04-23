package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (h *Handler) GetStats(c *gin.Context) {
	var productCount int
	var totalValue float64
	h.DB.QueryRow(`SELECT COUNT(*) FROM products`).Scan(&productCount)
	h.DB.QueryRow(`
		SELECT COALESCE(SUM(ps.quantity * p.cost_price), 0)
		FROM product_sizes ps
		JOIN products p ON p.id = ps.product_id
		WHERE p.cost_price > 0`).Scan(&totalValue)

	type CatStat struct {
		Category string  `json:"category"`
		Count    int     `json:"count"`
		TotalQty int     `json:"totalQty"`
		Value    float64 `json:"value"`
	}
	rows, _ := h.DB.Query(`
		SELECT p.category, COUNT(DISTINCT p.id), COALESCE(SUM(ps.quantity),0), COALESCE(SUM(ps.quantity*p.cost_price),0)
		FROM products p LEFT JOIN product_sizes ps ON ps.product_id = p.id
		GROUP BY p.category`)
	defer rows.Close()
	var cats []CatStat
	for rows.Next() {
		var cs CatStat
		rows.Scan(&cs.Category, &cs.Count, &cs.TotalQty, &cs.Value)
		cats = append(cats, cs)
	}

	type LowItem struct {
		ProductID   int64  `json:"productId"`
		ProductCode string `json:"productCode"`
		ProductName string `json:"productName"`
		Size        string `json:"size"`
		Quantity    int    `json:"quantity"`
	}
	lowRows, _ := h.DB.Query(`
		SELECT p.id, p.code, p.name, ps.size, ps.quantity
		FROM product_sizes ps JOIN products p ON p.id = ps.product_id
		WHERE ps.quantity <= 2 ORDER BY ps.quantity ASC LIMIT 20`)
	defer lowRows.Close()
	var lowStock []LowItem
	for lowRows.Next() {
		var li LowItem
		lowRows.Scan(&li.ProductID, &li.ProductCode, &li.ProductName, &li.Size, &li.Quantity)
		lowStock = append(lowStock, li)
	}
	if lowStock == nil {
		lowStock = []LowItem{}
	}

	type TopSold struct {
		ProductName string  `json:"productName"`
		TotalSold   float64 `json:"totalSold"`
	}
	topRows, _ := h.DB.Query(`
		SELECT product_name, SUM(quantity*price) as total
		FROM product_transactions WHERE type='out'
		GROUP BY product_name ORDER BY total DESC LIMIT 5`)
	defer topRows.Close()
	var topSold []TopSold
	for topRows.Next() {
		var ts TopSold
		topRows.Scan(&ts.ProductName, &ts.TotalSold)
		topSold = append(topSold, ts)
	}

	c.JSON(http.StatusOK, gin.H{
		"productCount": productCount,
		"totalValue":   totalValue,
		"catStats":     cats,
		"lowStock":     lowStock,
		"topSold":      topSold,
	})
}

func (h *Handler) GetProfit(c *gin.Context) {
	var todayRev, todayCost, monthRev, monthCost, totalRev, totalCost float64
	h.DB.QueryRow(`SELECT COALESCE(SUM(quantity*price),0)      FROM product_transactions WHERE type='out' AND cost_price>0 AND created_at::date=CURRENT_DATE`).Scan(&todayRev)
	h.DB.QueryRow(`SELECT COALESCE(SUM(quantity*cost_price),0) FROM product_transactions WHERE type='out' AND cost_price>0 AND created_at::date=CURRENT_DATE`).Scan(&todayCost)
	h.DB.QueryRow(`SELECT COALESCE(SUM(quantity*price),0)      FROM product_transactions WHERE type='out' AND cost_price>0 AND TO_CHAR(created_at,'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM')`).Scan(&monthRev)
	h.DB.QueryRow(`SELECT COALESCE(SUM(quantity*cost_price),0) FROM product_transactions WHERE type='out' AND cost_price>0 AND TO_CHAR(created_at,'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM')`).Scan(&monthCost)
	h.DB.QueryRow(`SELECT COALESCE(SUM(quantity*price),0)      FROM product_transactions WHERE type='out' AND cost_price>0`).Scan(&totalRev)
	h.DB.QueryRow(`SELECT COALESCE(SUM(quantity*cost_price),0) FROM product_transactions WHERE type='out' AND cost_price>0`).Scan(&totalCost)
	c.JSON(http.StatusOK, gin.H{
		"todayRevenue": todayRev, "todayCost": todayCost, "todayProfit": todayRev - todayCost,
		"monthRevenue": monthRev, "monthCost": monthCost, "monthProfit": monthRev - monthCost,
		"totalRevenue": totalRev, "totalCost": totalCost, "totalProfit": totalRev - totalCost,
	})
}

func (h *Handler) GetProfile(c *gin.Context) {
	var monthIn, monthOut, totalDebt, totalPaid float64
	var monthTxCount int

	h.DB.QueryRow(`SELECT COALESCE(SUM(quantity*price),0) FROM product_transactions
		WHERE type='in' AND TO_CHAR(created_at,'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM')`).Scan(&monthIn)
	h.DB.QueryRow(`SELECT COALESCE(SUM(quantity*price),0) FROM product_transactions
		WHERE type='out' AND TO_CHAR(created_at,'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM')`).Scan(&monthOut)
	h.DB.QueryRow(`SELECT COUNT(*) FROM product_transactions
		WHERE TO_CHAR(created_at,'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM')`).Scan(&monthTxCount)
	h.DB.QueryRow(`SELECT COALESCE(SUM(amount),0) FROM debts`).Scan(&totalDebt)
	h.DB.QueryRow(`SELECT COALESCE(SUM(amount),0) FROM debt_payments`).Scan(&totalPaid)

	c.JSON(http.StatusOK, gin.H{
		"monthIn":        monthIn,
		"monthOut":       monthOut,
		"monthTxCount":   monthTxCount,
		"totalDebt":      totalDebt,
		"totalPaid":      totalPaid,
		"totalRemaining": totalDebt - totalPaid,
	})
}
