#!/bin/bash
set -e

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
