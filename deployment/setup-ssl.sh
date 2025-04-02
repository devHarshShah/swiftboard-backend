#!/bin/bash
set -e

DOMAIN="swiftboard-api.devharsh.in"

echo "Setting up SSL certificate for $DOMAIN"
echo "This script will use certbot with the standalone plugin"
echo "Make sure port 80 is open in your security group!"

# Stop nginx temporarily (standalone mode requires port 80)
echo "Stopping Nginx temporarily..."
sudo systemctl stop nginx

# Use certbot in standalone mode
echo "Requesting certificate..."
sudo certbot certonly --standalone -d $DOMAIN

# Start nginx again
echo "Starting Nginx again..."
sudo systemctl start nginx

# Check if certificate was obtained
if sudo ls /etc/letsencrypt/live/$DOMAIN/fullchain.pem > /dev/null 2>&1; then
    echo "SSL certificate obtained successfully!"
    
    # Update Nginx config to use SSL
    echo "Updating Nginx configuration to use SSL..."
    cat > /tmp/ssl_nginx.conf << 'EOL'
server {
    listen 80;
    server_name swiftboard-api.devharsh.in;
    
    # Redirect all HTTP requests to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
    
    # Let's Encrypt verification path (keep this even with redirects)
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        try_files $uri =404;
    }
}

server {
    listen 443 ssl;
    server_name swiftboard-api.devharsh.in;
    
    ssl_certificate /etc/letsencrypt/live/swiftboard-api.devharsh.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/swiftboard-api.devharsh.in/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/swiftboard-api.devharsh.in/chain.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers EECDH+AESGCM:EDH+AESGCM;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 180m;
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # Let's Encrypt verification path
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        try_files $uri =404;
    }
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "no-referrer-when-downgrade";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self';";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
EOL

    sudo cp /tmp/ssl_nginx.conf /etc/nginx/sites-available/swiftboard-api.conf
    sudo nginx -t
    
    if [ $? -eq 0 ]; then
        sudo systemctl reload nginx
        echo "Nginx configured with SSL successfully!"
        echo "Your API should now be accessible at https://swiftboard-api.devharsh.in"
    else
        echo "Nginx configuration test failed. Please check the configuration."
    fi
else
    echo "Failed to obtain SSL certificate!"
    echo "Please check the certbot logs for more information."
    exit 1
fi

# Set up auto-renewal
echo "Setting up automatic certificate renewal..."
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

echo "SSL setup completed!"
