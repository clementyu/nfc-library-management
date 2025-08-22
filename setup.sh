#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Starting NFC Library Management System Setup ---"

# Update package list
sudo apt-get update

# Install curl to download nvm
echo "--- Installing curl ---"
sudo apt-get install curl -y

# --- NVM (Node Version Manager) Installation ---
echo "--- Installing NVM (Node Version Manager) ---"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Source nvm script to make it available in the current shell session
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# --- Node.js Installation ---
echo "--- Installing Node.js v22 ---"
nvm install 22

echo "--- Setting Node.js v22 as the default version ---"
nvm alias default 22
nvm use default

# --- Project Dependency Installation ---
# Assumes the script is run from the root of the git repository
if [ -d "nfc-library-management" ]; then
    echo "--- Navigating into the project directory ---"
    cd nfc-library-management

    echo "--- Installing required npm modules ---"
    npm install

    echo "--- Setup Complete! ---"
    echo "You can now run the application with: node index.js"
else
    echo "Error: 'nfc-library-management' directory not found."
    echo "Please run this script from the root directory of your git repository."
    exit 1
fi
