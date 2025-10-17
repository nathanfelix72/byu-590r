#!/bin/bash

# BYU 590R Monorepo - Server Setup Only
# This script only sets up the EC2 server infrastructure, not the applications
# Applications will be deployed via GitHub Actions

set -e

# Load environment variables if .env file exists
if [ -f "$(dirname "$0")/.env" ]; then
    source "$(dirname "$0")/.env"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration (can be overridden by .env file)
AWS_REGION="${AWS_REGION:-us-west-1}"
KEY_NAME="${KEY_NAME:-byu-590r}"
SECURITY_GROUP="${SECURITY_GROUP_ID:-sg-07cb07cc76067db76}"
PROJECT_NAME="${PROJECT_NAME:-byu-590r}"

log_info "Starting EC2 server setup (applications will be deployed via GitHub Actions)..."

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install AWS CLI first."
        exit 1
    fi
    
    # Check if AWS credentials work
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Cleanup existing instances
cleanup_existing_instances() {
    log_info "Checking for existing EC2 instances..."
    
    # Get all running instances with the project name tag
    EXISTING_INSTANCES=$(aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=$PROJECT_NAME-server" "Name=instance-state-name,Values=running,pending" \
        --query 'Reservations[*].Instances[*].InstanceId' \
        --output text)
    
    if [ -n "$EXISTING_INSTANCES" ]; then
        log_warning "Found existing instances: $EXISTING_INSTANCES"
        log_info "Terminating existing instances to prevent duplicates..."
        
        # Terminate existing instances
        aws ec2 terminate-instances --instance-ids $EXISTING_INSTANCES
        
        # Wait for termination to complete
        log_info "Waiting for instances to terminate..."
        aws ec2 wait instance-terminated --instance-ids $EXISTING_INSTANCES
        
        log_success "Existing instances terminated"
    else
        log_info "No existing instances found"
    fi
}

# Create EC2 instance
create_ec2_instance() {
    log_info "Creating EC2 instance..."
    
    # Get account ID
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    # Create EC2 instance
    INSTANCE_ID=$(aws ec2 run-instances \
        --image-id ami-04f34746e5e1ec0fe \
        --instance-type t2.micro \
        --key-name "$KEY_NAME" \
        --security-group-ids "$SECURITY_GROUP" \
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$PROJECT_NAME-server}]" \
        --query 'Instances[0].InstanceId' \
        --output text)
    
    echo "INSTANCE_ID=$INSTANCE_ID" > .server-config
    
    log_info "Waiting for instance to be running..."
    aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
    
    # Get instance IP
    INSTANCE_IP=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text)
    
    echo "INSTANCE_IP=$INSTANCE_IP" >> .server-config
    
    log_success "EC2 instance created: $INSTANCE_ID ($INSTANCE_IP)"
}

# Setup EC2 instance with dependencies only
setup_ec2_dependencies() {
    log_info "Setting up EC2 instance with dependencies only..."
    
    # Create setup script
    cat > setup-server.sh << 'EOF'
#!/bin/bash
set -e

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PHP 8.3 and extensions
sudo apt install -y software-properties-common
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update
sudo apt install -y php8.3 php8.3-mysql php8.3-xml php8.3-mbstring php8.3-curl php8.3-zip php8.3-gd php8.3-cli php8.3-common libapache2-mod-php8.3

# Install Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
sudo chmod +x /usr/local/bin/composer

# Install MySQL
sudo apt install -y mysql-server
sudo systemctl enable mysql
sudo systemctl start mysql

# Install Apache
sudo apt install -y apache2
sudo systemctl enable apache2
sudo systemctl start apache2

# Install Git
sudo apt install -y git

# Create application directories
sudo mkdir -p /var/www/html/app
sudo mkdir -p /var/www/html/api
sudo chown -R ubuntu:ubuntu /var/www/html/app
sudo chown -R ubuntu:ubuntu /var/www/html/api

# Create database and user
sudo mysql -u root << 'MYSQL_EOF'
CREATE DATABASE IF NOT EXISTS byu_590r_app;
CREATE USER IF NOT EXISTS 'byu_user'@'localhost' IDENTIFIED BY 'byu590r123!';
GRANT ALL PRIVILEGES ON byu_590r_app.* TO 'byu_user'@'localhost';
FLUSH PRIVILEGES;
MYSQL_EOF

# Configure Apache Virtual Hosts

# Enable Apache modules
sudo a2enmod rewrite
sudo a2enmod headers

# Create main virtual host with path-based routing
sudo tee /etc/apache2/sites-available/byu-590r.conf > /dev/null << 'APACHE_MAIN_EOF'
<VirtualHost *:80>
    ServerName localhost
    DocumentRoot /var/www/html
    
    # API routing - Laravel backend
    Alias /api /var/www/html/api/public
    
    <Directory /var/www/html/api/public>
        AllowOverride All
        Require all granted
        
        # Laravel routing
        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule ^(.*)$ index.php [QSA,L]
    </Directory>
    
    # App routing - Angular frontend
    Alias /app /var/www/html/app
    
    <Directory /var/www/html/app>
        AllowOverride All
        Require all granted
        
        # Angular routing support
        RewriteEngine On
        RewriteBase /app
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /app/index.html [L]
    </Directory>
    
    # Default root - redirect to app
    <Directory /var/www/html>
        AllowOverride All
        Require all granted
        
        RewriteEngine On
        RewriteRule ^$ /app/ [R=301,L]
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/byu590r_error.log
    CustomLog ${APACHE_LOG_DIR}/byu590r_access.log combined
</VirtualHost>
APACHE_MAIN_EOF

# Enable site and disable default
sudo a2ensite byu-590r.conf
sudo a2dissite 000-default
sudo systemctl reload apache2

# Set proper permissions for Laravel
sudo chown -R www-data:www-data /var/www/html/api
sudo chmod -R 755 /var/www/html/api
sudo chmod -R 775 /var/www/html/api/storage
sudo chmod -R 775 /var/www/html/api/bootstrap/cache

echo "Server setup complete! Ready for GitHub Actions deployment."
EOF
    
    # Copy and run setup script
    scp -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no setup-server.sh ubuntu@"$INSTANCE_IP":~/
    ssh -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no ubuntu@"$INSTANCE_IP" "chmod +x setup-server.sh && ./setup-server.sh"
    
    # Clean up
    rm setup-server.sh
    
    log_success "EC2 server setup complete"
}

# Main setup function
main() {
    log_info "Starting BYU 590R Server Setup..."
    
    check_prerequisites
    cleanup_existing_instances
    create_ec2_instance
    setup_ec2_dependencies
    
    echo ""
    log_success "🎉 Server setup complete!"
    echo ""
    log_info "Server Details:"
    echo "  Instance ID: $INSTANCE_ID"
    echo "  Public IP: $INSTANCE_IP"
    echo ""
    log_info "📋 Next Steps - Add GitHub Secrets:"
    echo ""
    echo "  1. Go to your GitHub repository settings:"
    echo "     ${GITHUB_REPO_URL:-https://github.com/BYU-IS-590R-Christiansen/byu-590r-monorepo/settings/secrets/actions}"
    echo ""
    echo "  2. Click 'New repository secret' and add these two secrets:"
    echo ""
    echo "     Secret Name: EC2_HOST"
    echo "     Secret Value: $INSTANCE_IP"
    echo ""
    echo "     Secret Name: EC2_SSH_PRIVATE_KEY"
    echo "     Secret Value: (Copy the contents of ~/.ssh/$KEY_NAME.pem)"
    echo ""
    echo "  3. To get your SSH private key content, run:"
    echo "     cat ~/.ssh/$KEY_NAME.pem"
    echo ""
    echo "  4. Copy the entire output (including -----BEGIN and -----END lines)"
    echo "     and paste it as the value for EC2_SSH_PRIVATE_KEY"
    echo ""
    echo "  5. Once secrets are added, push changes to main branch to trigger deployment"
    echo ""
    log_info "Configuration saved to: .server-config"
}

# Run main function
main "$@"
