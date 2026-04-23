# ── Stage 1: Build ───────────────────────────────────────
FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o daromad_app .

# ── Stage 2: Runtime ─────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/daromad_app .
COPY --from=builder /app/static ./static

EXPOSE 8080

ENV TZ=Asia/Dushanbe

CMD ["./daromad_app"]
