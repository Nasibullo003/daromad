package handlers

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"warehouse/internal/models"
)

var clothingOrder = []string{"XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "4XL", "5XL"}

func (h *Handler) GetProducts(c *gin.Context) {
	rows, err := h.DB.Query(`
		SELECT id, code, name, category, brand, color, price, cost_price, created_at
		FROM products ORDER BY name ASC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var products []models.Product
	idIndex := map[int64]int{}
	for rows.Next() {
		var p models.Product
		rows.Scan(&p.ID, &p.Code, &p.Name, &p.Category, &p.Brand, &p.Color, &p.Price, &p.CostPrice, &p.CreatedAt)
		p.Sizes = []models.ProductSize{}
		idIndex[p.ID] = len(products)
		products = append(products, p)
	}

	if len(products) == 0 {
		c.JSON(http.StatusOK, []models.Product{})
		return
	}

	sizeRows, err := h.DB.Query(`SELECT product_id, size, quantity FROM product_sizes ORDER BY product_id`)
	if err == nil {
		defer sizeRows.Close()
		for sizeRows.Next() {
			var pid int64
			var ps models.ProductSize
			sizeRows.Scan(&pid, &ps.Size, &ps.Quantity)
			if idx, ok := idIndex[pid]; ok {
				products[idx].Sizes = append(products[idx].Sizes, ps)
				products[idx].TotalQty += ps.Quantity
				products[idx].TotalValue += float64(ps.Quantity) * products[idx].Price
			}
		}
	}

	for i := range products {
		sortSizes(products[i].Sizes, products[i].Category)
	}

	c.JSON(http.StatusOK, products)
}

func (h *Handler) AddProduct(c *gin.Context) {
	var req models.AddProductReq
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Маълумот нодуруст"})
		return
	}

	if strings.TrimSpace(req.Code) == "" {
		prefix := map[string]string{"shoes": "PF", "clothing": "LB", "other": "DG"}[req.Category]
		if prefix == "" {
			prefix = "XX"
		}
		req.Code = fmt.Sprintf("%s-%d", prefix, time.Now().UnixMilli()%100000)
	}

	tx, err := h.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback()

	var pid int64
	err = tx.QueryRow(
		`INSERT INTO products (code, name, category, brand, color, price)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		req.Code, req.Name, req.Category, req.Brand, req.Color, req.Price,
	).Scan(&pid)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			c.JSON(http.StatusConflict, gin.H{"error": "Ин код аллакай мавҷуд аст"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	for _, s := range req.Sizes {
		if s.Size == "" {
			continue
		}
		if _, err := tx.Exec(
			`INSERT INTO product_sizes (product_id, size, quantity) VALUES ($1, $2, $3)`,
			pid, s.Size, s.Quantity,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": pid, "code": req.Code})
}

func (h *Handler) UpdateProduct(c *gin.Context) {
	var req models.AddProductReq
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Маълумот нодуруст"})
		return
	}
	id := c.Param("id")

	tx, err := h.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(
		`UPDATE products SET code=$1, name=$2, category=$3, brand=$4, color=$5, price=$6 WHERE id=$7`,
		req.Code, req.Name, req.Category, req.Brand, req.Color, req.Price, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for _, s := range req.Sizes {
		if s.Size == "" {
			continue
		}
		_, err = tx.Exec(
			`INSERT INTO product_sizes (product_id, size, quantity) VALUES ($1, $2, $3)
			 ON CONFLICT(product_id, size) DO UPDATE SET quantity = EXCLUDED.quantity`,
			id, s.Size, s.Quantity,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (h *Handler) DeleteProduct(c *gin.Context) {
	tx, err := h.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback()

	tx.Exec("DELETE FROM product_sizes WHERE product_id = $1", c.Param("id"))
	result, err := tx.Exec("DELETE FROM products WHERE id = $1", c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Маҳсулот ёфт нашуд"})
		return
	}
	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func sortSizes(sizes []models.ProductSize, category string) {
	if category == "clothing" {
		order := map[string]int{}
		for i, s := range clothingOrder {
			order[s] = i
		}
		sort.Slice(sizes, func(i, j int) bool {
			oi, iok := order[sizes[i].Size]
			oj, jok := order[sizes[j].Size]
			if iok && jok {
				return oi < oj
			}
			return sizes[i].Size < sizes[j].Size
		})
	} else {
		sort.Slice(sizes, func(i, j int) bool {
			ni, erri := strconv.Atoi(sizes[i].Size)
			nj, errj := strconv.Atoi(sizes[j].Size)
			if erri == nil && errj == nil {
				return ni < nj
			}
			return sizes[i].Size < sizes[j].Size
		})
	}
}
