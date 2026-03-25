.PHONY: help lint build smoke-oidc seed-clients quality

help:
	@echo "Available targets:"
	@echo "  make lint        - Run ESLint"
	@echo "  make build       - Run Next.js production build"
	@echo "  make smoke-oidc  - Run OIDC smoke checks"
	@echo "  make seed-clients - Register/update OAuth clients"
	@echo "  make quality     - Run lint, build, and smoke checks"

lint:
	npm run lint

build:
	npm run build

smoke-oidc:
	npm run smoke:oidc

seed-clients:
	npm run seed:clients

quality: lint build smoke-oidc
