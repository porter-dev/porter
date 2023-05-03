package database

//go:generate sqlc generate -f sqlc.yaml
//go:generate atlas migrate diff --dir file://migrations --to file://schema.sql --dev-url "postgresql://porter:porter@localhost:5432/atlas?sslmode=disable" --format "{{ sql . ' ' }}"
//go:generate atlas migrate lint --dir file://migrations --dev-url "postgresql://porter:porter@localhost:5432/atlas?sslmode=disable" --latest 1
