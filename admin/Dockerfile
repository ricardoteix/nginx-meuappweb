# Imagem NGINX sem root apenas para servir os arquivos estáticos já "buildados".
# TLS, headers de segurança e rate limiting ficam no NGINX de borda (edge).
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/

EXPOSE 3001
