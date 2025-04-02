#!/bin/bash
set -e

# Update and install dependencies
echo "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js, Docker, Docker Compose, and other utilities
echo "Installing Node.js, Docker, Docker Compose, and other utilities..."
sudo apt-get install -y curl wget git nginx certbot python3-certbot-nginx dnsutils

# Install Docker
echo "Installing Docker..."
sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
echo "Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add the current user to the docker group to avoid having to use sudo
sudo usermod -aG docker ${USER}

# Configure and restart Nginx
echo "Configuring Nginx..."
sudo systemctl stop nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Create application directory
echo "Creating application directory..."
mkdir -p ~/swiftboard-backend

echo "Setup complete!"
echo "Please log out and log back in for the Docker group changes to take effect."
echo "Make sure to configure the subdomain 'swiftboard-api' with A record pointing to $(curl -s http://checkip.amazonaws.com)"
