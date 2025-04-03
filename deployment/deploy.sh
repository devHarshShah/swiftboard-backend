#!/bin/bash
set -e

# Check if DNS is properly configured
echo "Checking DNS configuration..."
DOMAIN="swiftboard-api.devharsh.in"
SERVER_IP="13.201.186.211"
RESOLVED_IP=$(dig +short $DOMAIN)

if [ "$RESOLVED_IP" != "$SERVER_IP" ]; then
  echo "Warning: The domain $DOMAIN is not pointing to this server ($SERVER_IP)"
  echo "Current IP: $RESOLVED_IP"
  echo "Please ensure your DNS A record is properly configured and has propagated"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Create production environment file
echo "Setting up environment file..."
cp .env.prod.example .env.prod
echo "Please edit .env.prod with your production values before continuing"
read -p "Press Enter to continue after editing .env.prod..." -n 1 -r
echo

# Configure Nginx (before SSL to ensure it's serving on port 80)
echo "Configuring Nginx..."
sudo cp deployment/nginx/swiftboard-api.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/swiftboard-api.conf /etc/nginx/sites-enabled/
# Remove default site to avoid conflicts
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Check security group setup
echo "IMPORTANT: Before continuing with SSL setup, ensure your AWS EC2 security group allows:"
echo "  - HTTP (port 80) from anywhere (0.0.0.0/0) for Let's Encrypt verification"
echo "  - HTTPS (port 443) from anywhere (0.0.0.0/0) for secure access"
echo "  - SSH (port 22) from your IP for management"
echo ""
echo "You can set this up in the AWS Console under:"
echo "EC2 > Security Groups > [Your Instance's Security Group] > Edit inbound rules"
echo ""
read -p "Have you configured the security group properly? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Please configure the security group before continuing"
  exit 1
fi

# Verify port 80 is accessible from the internet
echo "Verifying port 80 is accessible..."
echo "This test will create a temporary file that should be accessible from the internet"
sudo mkdir -p /var/www/html/.well-known/acme-challenge
echo "port-check-successful" | sudo tee /var/www/html/.well-known/acme-challenge/test > /dev/null
echo "Please try accessing http://$DOMAIN/.well-known/acme-challenge/test from your local machine"
echo "It should display 'port-check-successful' if your security group is configured correctly"
read -p "Was the test file accessible? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Port 80 doesn't seem to be accessible from the internet."
  echo "Please check your security group settings and try again."
  exit 1
fi
sudo rm -f /var/www/html/.well-known/acme-challenge/test

# Set up SSL for the domain
echo "Setting up SSL certificate..."
# Stop Nginx temporarily to free up port 80
sudo systemctl stop nginx

# Use standalone mode for better reliability
sudo certbot certonly --standalone -d "$DOMAIN" || {
  echo "SSL certificate generation failed!"
  echo "This could be due to:"
  echo "  1. AWS security group not allowing inbound HTTP traffic (port 80)"
  echo "  2. DNS propagation not complete yet (can take up to 24 hours)"
  echo "  3. Rate limits with Let's Encrypt"
  echo ""
  echo "Detailed error information may be found in /var/log/letsencrypt/letsencrypt.log"
  echo ""
  echo "Continuing without SSL for now. You can run the following command later to retry:"
  echo "sudo systemctl stop nginx && sudo certbot certonly --standalone -d $DOMAIN && sudo systemctl start nginx"
  echo ""
  read -p "Continue deployment without SSL? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    sudo systemctl start nginx
    exit 1
  fi
}

# Start Nginx back up
sudo systemctl start nginx

# Update Nginx config to use the certificate if it exists
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "Configuring Nginx to use SSL certificate..."
  # Enable SSL in Nginx config if not already enabled
  if ! grep -q "ssl_certificate" /etc/nginx/sites-available/swiftboard-api.conf; then
    sudo sed -i "s/listen 80;/listen 80;\n    listen 443 ssl;\n    ssl_certificate \/etc\/letsencrypt\/live\/$DOMAIN\/fullchain.pem;\n    ssl_certificate_key \/etc\/letsencrypt\/live\/$DOMAIN\/privkey.pem;\n    ssl_protocols TLSv1.2 TLSv1.3;\n    ssl_prefer_server_ciphers on;/" /etc/nginx/sites-available/swiftboard-api.conf
    sudo nginx -t && sudo systemctl reload nginx
  fi
fi

# Start the containers
echo "Starting Docker containers..."
docker-compose -f docker-compose.prod.yml up -d

echo "Deployment completed!"
if [ $? -eq 0 ]; then
  if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "Your API should be accessible at https://$DOMAIN"
  else
    echo "Your API should be accessible at http://$DOMAIN"
    echo "SSL setup failed. You can try setting it up manually later with:"
    echo "sudo systemctl stop nginx && sudo certbot certonly --standalone -d $DOMAIN && sudo systemctl start nginx"
  fi
else
  echo "There was an issue with starting the containers. Please check the logs."
fi

# Setup auto-renewal cronjob for SSL certificate
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "Setting up automatic SSL certificate renewal..."
  (crontab -l 2>/dev/null; echo "0 3 * * * sudo systemctl stop nginx && sudo certbot renew --quiet && sudo systemctl start nginx") | crontab -
  echo "Automatic renewal configured to run daily at 3:00 AM"
fi
