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

# Set up SSL for the domain
echo "Setting up SSL certificate..."
sudo certbot --nginx -d swiftboard-api.devharsh.in || {
  echo "SSL certificate generation failed!"
  echo "This could be due to:"
  echo "  1. AWS security group not allowing inbound HTTP traffic (port 80)"
  echo "  2. DNS propagation not complete yet (can take up to 24 hours)"
  echo "  3. Nginx configuration issues"
  echo ""
  echo "Continuing without SSL for now. You can run the following command later to retry:"
  echo "sudo certbot --nginx -d swiftboard-api.devharsh.in"
  echo ""
  read -p "Continue deployment without SSL? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
}

# Start the containers
echo "Starting Docker containers..."
docker-compose -f docker-compose.prod.yml up -d

echo "Deployment completed!"
if [ $? -eq 0 ]; then
  echo "Your API should be accessible at http://swiftboard-api.devharsh.in"
  echo "Once SSL is working, it will be available at https://swiftboard-api.devharsh.in"
else
  echo "There was an issue with starting the containers. Please check the logs."
fi
