#!/bin/bash

# Determine the EC2 instance's public IP
PUBLIC_IP=$(curl -s http://checkip.amazonaws.com)
DOMAIN="swiftboard-api.devharsh.in"

echo "=== SwiftBoard API Connectivity Checker ==="
echo "EC2 Public IP: $PUBLIC_IP"
echo "Domain: $DOMAIN"
echo ""

# Check DNS resolution
echo "Testing DNS resolution..."
RESOLVED_IP=$(dig +short $DOMAIN)
if [ -z "$RESOLVED_IP" ]; then
  echo "❌ DNS resolution failed! The domain doesn't resolve to any IP."
  echo "   Make sure your A record for 'swiftboard-api' points to $PUBLIC_IP"
elif [ "$RESOLVED_IP" != "$PUBLIC_IP" ]; then
  echo "❌ DNS mismatch! The domain resolves to $RESOLVED_IP instead of $PUBLIC_IP"
  echo "   Make sure your A record for 'swiftboard-api' points to $PUBLIC_IP"
else
  echo "✅ DNS resolution successful! Domain resolves to the correct IP."
fi
echo ""

# Check if Nginx is running
echo "Testing Nginx status..."
if sudo systemctl is-active --quiet nginx; then
  echo "✅ Nginx is running."
else
  echo "❌ Nginx is not running!"
  echo "   Try starting it with: sudo systemctl start nginx"
fi
echo ""

# Check ports
echo "Testing port availability..."
# Check port 80
nc -z -w 2 localhost 80
if [ $? -eq 0 ]; then
  echo "✅ Port 80 is open locally."
else
  echo "❌ Port 80 is not open locally!"
  echo "   Check if Nginx is properly configured."
fi

# Check port 443
nc -z -w 2 localhost 443
if [ $? -eq 0 ]; then
  echo "✅ Port 443 is open locally."
else
  echo "❌ Port 443 is not open locally!"
  echo "   This is expected if SSL hasn't been set up yet."
fi
echo ""

# Check external accessibility
echo "Testing external accessibility..."
echo "You can use these commands from your local machine to test connectivity:"
echo ""
echo "HTTP test: curl -I http://swiftboard-api.devharsh.in"
echo "Expected result: HTTP/1.1 200 OK"
echo ""
echo "ACME challenge test:"
echo "curl http://swiftboard-api.devharsh.in/.well-known/acme-challenge/test"
echo "Expected result: 404 Not Found (showing the location exists but no challenge file found)"
echo ""

# Create a test file in the ACME challenge directory to verify it's accessible
sudo mkdir -p /var/www/html/.well-known/acme-challenge
echo "test-file-content" | sudo tee /var/www/html/.well-known/acme-challenge/test > /dev/null

echo "✅ Created a test file at /.well-known/acme-challenge/test"
echo "   You can test it with: curl http://swiftboard-api.devharsh.in/.well-known/acme-challenge/test"
echo "   If you can access this file, Let's Encrypt should be able to verify your domain."
echo ""

echo "Security Group Recommendations:"
echo "Make sure your EC2 security group has these inbound rules:"
echo "- Type: HTTP, Protocol: TCP, Port: 80, Source: 0.0.0.0/0"
echo "- Type: HTTPS, Protocol: TCP, Port: 443, Source: 0.0.0.0/0"
echo "- Type: SSH, Protocol: TCP, Port: 22, Source: Your IP"
echo ""
echo "You can add these rules in AWS Console: EC2 > Security Groups > Your Security Group > Edit inbound rules"
