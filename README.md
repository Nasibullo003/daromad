# Warehouse Management System

A modern, professional warehouse inventory management system built with **Go** and a beautiful web interface.

## Features

- 📦 **Inventory Management** - Add, edit, and delete items from your warehouse
- 💰 **Price & Quality Tracking** - Track item prices and quality levels (Premium, Standard, Economy)
- 📊 **Dashboard Stats** - Real-time statistics including total items, quantities, and inventory value
- 🔍 **Search & Filter** - Quickly find items by name or quality
- 📅 **Date Tracking** - Automatic timestamp for all inventory changes
- 🎨 **Modern UI** - Beautiful, responsive interface that works on all devices
- 💾 **Data Persistence** - All data stored in SQLite database

## Technology Stack

- **Backend**: Go with Gin Web Framework
- **Database**: SQLite3
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Responsive Design**: Mobile-friendly layout

## Quick Start

### Prerequisites

- Go 1.21 or higher
- SQLite3 (usually included with the system)

### Installation

1. Navigate to the project directory:
```bash
cd daromad
```

2. Download dependencies:
```bash
go mod download
```

3. Run the application:
```bash
go run main.go models.go
```

The application will start on `http://localhost:8080`

## Usage

### Dashboard
View summary statistics:
- Total number of different items
- Total quantity in stock
- Total inventory value
- Recent items list

### Items List
- View all items in inventory
- Search by product name or quality level
- Click any item to view details

### Add New Item
Create a new inventory item with:
- Product name (required)
- Quality level: Premium, Standard, or Economy
- Price per unit
- Quantity in stock

### Edit/Update Items
- Click on any item card to open the edit modal
- Modify the item details
- Click "Update Item" to save changes

### Delete Items
- Open an item details modal
- Click "Delete Item"
- Confirm deletion

## API Endpoints

```
GET  /          - Serve main page
GET  /api/items - Get all items
POST /api/items - Add new item
GET  /api/items/:id - Get item details
PUT  /api/items/:id - Update item
DELETE /api/items/:id - Delete item
GET  /api/stats - Get inventory statistics
```

## Database Schema

### items table
```sql
CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    quality TEXT,
    price REAL NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    date_added DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## File Structure

```
daromad/
├── main.go           - Main application and HTTP handlers
├── models.go         - Data models
├── go.mod            - Go module file
├── go.sum            - Go dependencies checksums
├── warehouse.db      - SQLite database (created on first run)
└── static/
    ├── index.html    - HTML template
    ├── styles.css    - Styling
    └── script.js     - Frontend logic
```

## Configuration

The application runs on port `8080` by default. To change this, modify the port in `main.go`:

```go
if err := router.Run(":YOUR_PORT"); err != nil {
    log.Fatal(err)
}
```

## Features Details

### Dashboard
- **Real-time Statistics**: Updates every 5 seconds
- **Recent Items**: Shows the 5 most recently added items
- **Quick Overview**: See total value and quantity at a glance

### Search Functionality
- Search by product name (case-insensitive)
- Filter by quality level
- Real-time filtering as you type

### Quality Levels
- **Premium**: Gold-colored badge
- **Standard**: Blue-colored badge
- **Economy**: Green-colored badge

## Building for Production

To build a standalone executable:

```bash
go build -o warehouse main.go models.go
./warehouse
```

## Troubleshooting

### Port already in use
If port 8080 is already in use, modify the port number in `main.go`

### Database locked
Ensure no other instances of the application are running

### Static files not found
Verify that the `static/` folder exists in the same directory as the executable

## License

This project is open source and available for use.

## Author

Created as a professional warehouse management solution.

---

**Enjoy managing your warehouse! 📦**
