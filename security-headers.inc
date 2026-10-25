# Her location'a eklenen güvenlik başlıkları (nginx.conf'ta neden olduğu açıklandı).
add_header X-Robots-Tag "noindex, nofollow" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "same-origin" always;
add_header Permissions-Policy "geolocation=(), camera=(), microphone=(), payment=()" always;
add_header Content-Security-Policy $csp always;
