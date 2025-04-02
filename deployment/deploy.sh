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
# You would need to edit .env.prod with your production values

# Set up SSL for the domain
echo "Setting up SSL certificate..."
sudo certbot --nginx -d swiftboard-api.devharsh.in

# Configure Nginx
echo "Configuring Nginx..."
sudo cp deployment/nginx/swiftboard-api.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/swiftboard-api.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Start the containers
echo "Starting Docker containers..."
docker-compose -f docker-compose.prod.yml up -d

echo "Deployment completed successfully!"
echo "Your API should now be accessible at https://swiftboard-api.devharsh.in"
