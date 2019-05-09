all: build

deps:
	npm install

test: deps
	npm run test
	
build: test
	npm run build
	@echo "Build success!"
	@echo "Built: 'dist/', 'examples/browser/'"

clean:
	rm -rf ipfs/
	rm -rf node_modules/

clean-dependencies: clean
	rm -f package-lock.json
	rm -rf keystore

rebuild: | clean-dependencies build
	
.PHONY: test
