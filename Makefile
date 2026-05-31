# ============================================================
# Jarvis — developer task runner.
# Usage: make <target>   (run `make help` to list targets)
# ============================================================

PYTHON ?= python3.11
VENV   := .venv
BIN    := $(VENV)/bin

.DEFAULT_GOAL := help
.PHONY: help setup run test lint check clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

setup: ## Create venv and install dependencies
	$(PYTHON) -m venv $(VENV)
	$(BIN)/pip install --upgrade pip
	$(BIN)/pip install -r requirements.txt
	@echo "✅ Environment ready. Activate with: source $(BIN)/activate"

run: ## Run the assistant (python -m jarvis)
	$(BIN)/python -m jarvis

test: ## Run the test suite
	$(BIN)/pytest -q

lint: ## Lint and format check (ruff)
	$(BIN)/ruff check src/jarvis tests
	$(BIN)/ruff format --check src/jarvis tests

check: ## Run environment diagnostics
	bash scripts/check_env.sh

clean: ## Remove caches and build artifacts
	rm -rf .pytest_cache .ruff_cache **/__pycache__ build dist *.egg-info
