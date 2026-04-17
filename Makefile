.PHONY: validate generate health-check

validate:
	npm run validate:config

generate:
	npm run generate

health-check:
	npm run health-check
