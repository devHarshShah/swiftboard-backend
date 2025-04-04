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

# Configure Nginx
echo "Configuring Nginx..."
sudo cp deployment/nginx/swiftboard-api.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/swiftboard-api.conf /etc/nginx/sites-enabled/
# Remove default site to avoid conflicts
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Check security group setup
echo "IMPORTANT: Ensure your AWS EC2 security group allows:"
echo "  - HTTP (port 80) from anywhere (0.0.0.0/0)"
echo "  - HTTPS (port 443) from anywhere (0.0.0.0/0)"
echo "  - SSH (port 22) from your IP for management"
echo ""
read -p "Have you confirmed the security group configuration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Please configure the security group before continuing"
  exit 1
fi

# Start the containers
echo "Starting Docker containers..."
docker-compose -f docker-compose.yml up -d

echo "Deployment completed!"
if [ $? -eq 0 ]; then
  echo "Your API should be accessible at https://$DOMAIN"
else
  echo "There was an issue with starting the containers. Please check the logs."
fi

# Remind about SSL certificate renewal
echo "SSL is already configured. Remember the automatic renewal should be already set up via cron."
echo "You can check the current renewal schedule with: crontab -l"
