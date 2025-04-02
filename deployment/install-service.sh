#!/bin/bash
set -e

# Copy the service file to systemd
echo "Installing systemd service..."
sudo cp deployment/swiftboard-api.service /etc/systemd/system/
sudo systemctl daemon-reload

# Enable and start the service
echo "Enabling and starting SwiftBoard API service..."
sudo systemctl enable swiftboard-api.service
sudo systemctl start swiftboard-api.service

echo "Service installed and started successfully!"
echo "You can check the status with: sudo systemctl status swiftboard-api.service"
