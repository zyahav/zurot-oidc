.PHONY: help lint build smoke-oidc quality

help:
	@echo "Available targets:"
	@echo "  make lint        - Run ESLint"
	@echo "  make build       - Run Next.js production build"
	@echo "  make smoke-oidc  - Run OIDC smoke checks"
	@echo "  make quality     - Run lint, build, and smoke checks"

lint:
	npm run lint

build:
	npm run build

smoke-oidc:
	npm run smoke:oidc

quality: lint build smoke-oidc
