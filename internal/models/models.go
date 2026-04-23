package models

type ProductSize struct {
	Size     string `json:"size"`
	Quantity int    `json:"quantity"`
}

type Product struct {
	ID         int64         `json:"id"`
	Code       string        `json:"code"`
	Name       string        `json:"name"`
	Category   string        `json:"category"`
	Brand      string        `json:"brand"`
	Color      string        `json:"color"`
	Price      float64       `json:"price"`
	CostPrice  float64       `json:"costPrice"`
	Sizes      []ProductSize `json:"sizes"`
	TotalQty   int           `json:"totalQty"`
	TotalValue float64       `json:"totalValue"`
	CreatedAt  string        `json:"createdAt"`
}

type AddProductReq struct {
	Code     string        `json:"code"`
	Name     string        `json:"name"     binding:"required"`
	Category string        `json:"category" binding:"required"`
	Brand    string        `json:"brand"`
	Color    string        `json:"color"`
	Price    float64       `json:"price"    binding:"required,gt=0"`
	Sizes    []ProductSize `json:"sizes"`
}

type Debt struct {
	ID           int64   `json:"id"`
	CustomerName string  `json:"customerName"`
	Phone        string  `json:"phone"`
	Amount       float64 `json:"amount"`
	PaidAmount   float64 `json:"paidAmount"`
	Remaining    float64 `json:"remaining"`
	Note         string  `json:"note"`
	CreatedBy    string  `json:"createdBy"`
	CreatedAt    string  `json:"createdAt"`
}
