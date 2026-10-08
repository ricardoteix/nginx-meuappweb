# Atalhos (Linux/macOS/WSL). No Windows, use os comandos docker compose do README.
.PHONY: up down logs certs hosts unhosts test ratelimit scale clean nginx-test

up:            ## Sobe tudo (gera certificados na primeira vez)
	docker compose up -d --build

down:          ## Derruba os containers
	docker compose down

logs:          ## Acompanha os logs do NGINX
	docker compose logs -f nginx

certs:         ## Gera CA + certificado localmente (requer openssl)
	sh scripts/gen-certs.sh ./nginx/certs

hosts:         ## Adiciona os domínios no /etc/hosts
	sudo ./scripts/hosts.sh add

unhosts:       ## Remove os domínios do /etc/hosts
	sudo ./scripts/hosts.sh remove

nginx-test:    ## Valida a sintaxe (nginx -t) e recarrega sem downtime
	docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload

test:          ## Testes de fumaça (não precisa do hosts)
	./scripts/smoke-test.sh

ratelimit:     ## Demonstra o HTTP 429 no login
	./scripts/test-rate-limit.sh

scale:         ## Sobe 3 réplicas da API para ver o least_conn
	docker compose up -d --scale api=3 && docker compose restart nginx

clean:         ## Remove containers, imagens locais e certificados
	docker compose down --rmi local
	find nginx/certs -type f ! -name .gitkeep -delete
