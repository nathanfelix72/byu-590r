#!/bin/bash

# BYU 590R Monorepo - Server Setup Only
# This script only sets up the EC2 server infrastructure, not the applications
# Applications will be deployed via GitHub Actions

set -e

# Load environment variables if .env file exists
if [ -f "$(dirname "$0")/../.env" ]; then
    source "$(dirname "$0")/../.env"
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
PROJECT_NAME="${PROJECT_NAME:-byu-590r}"
SECURITY_GROUP=""  # Will be set by create_or_get_security_group function

# Clear any old security group variables from environment
unset SECURITY_GROUP_ID
unset SECURITY_GROUP

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

# Create or get security group
create_or_get_security_group() {
    log_info "Setting up security group..."
    
    # Ensure we start with a clean security group variable
    SECURITY_GROUP=""
    
    # Check if security group already exists
    EXISTING_SG=$(aws ec2 describe-security-groups \
        --region "$AWS_REGION" \
        --filters "Name=tag:Project,Values=590r" "Name=tag:Name,Values=byu-590r-sg" \
        --query 'SecurityGroups[0].GroupId' \
        --output text 2>/dev/null)
    
    log_info "Existing security group check result: '$EXISTING_SG'"
    
    if [ "$EXISTING_SG" != "None" ] && [ "$EXISTING_SG" != "" ]; then
        log_info "Found existing security group: $EXISTING_SG"
        SECURITY_GROUP="$EXISTING_SG"
        export SECURITY_GROUP
    else
        log_info "Creating new security group..."
        
        # Get default VPC ID
        VPC_ID=$(aws ec2 describe-vpcs \
            --region "$AWS_REGION" \
            --filters "Name=is-default,Values=true" \
            --query 'Vpcs[0].VpcId' \
            --output text)
        
        log_info "Default VPC ID: $VPC_ID"
        
        if [ "$VPC_ID" = "None" ] || [ "$VPC_ID" = "" ]; then
            log_error "No default VPC found in region $AWS_REGION"
            exit 1
        fi
        
        # Create security group
        log_info "Creating security group with name 'byu-590r-sg' in VPC $VPC_ID..."
        SECURITY_GROUP=$(aws ec2 create-security-group \
            --region "$AWS_REGION" \
            --group-name "byu-590r-sg" \
            --description "Security group for BYU 590R application" \
            --vpc-id "$VPC_ID" \
            --tag-specifications 'ResourceType=security-group,Tags=[{Key=Name,Value=byu-590r-sg},{Key=Project,Value=590r}]' \
            --query 'GroupId' \
            --output text)
        
        log_info "Security group creation result: '$SECURITY_GROUP'"
        
        if [ "$SECURITY_GROUP" = "" ]; then
            log_error "Failed to create security group"
            exit 1
        fi
        
        log_success "Created security group: $SECURITY_GROUP"
        export SECURITY_GROUP
        
        # Add security group rules
        log_info "Adding security group rules..."
        
        # SSH access
        log_info "Adding SSH rule (port 22)..."
        aws ec2 authorize-security-group-ingress \
            --region "$AWS_REGION" \
            --group-id "$SECURITY_GROUP" \
            --protocol tcp \
            --port 22 \
            --cidr 0.0.0.0/0 >/dev/null
        
        # HTTP access
        log_info "Adding HTTP rule (port 80)..."
        aws ec2 authorize-security-group-ingress \
            --region "$AWS_REGION" \
            --group-id "$SECURITY_GROUP" \
            --protocol tcp \
            --port 80 \
            --cidr 0.0.0.0/0 >/dev/null
        
        # HTTPS access
        log_info "Adding HTTPS rule (port 443)..."
        aws ec2 authorize-security-group-ingress \
            --region "$AWS_REGION" \
            --group-id "$SECURITY_GROUP" \
            --protocol tcp \
            --port 443 \
            --cidr 0.0.0.0/0 >/dev/null
        
        # Backend API access
        log_info "Adding Backend API rule (port 4444)..."
        aws ec2 authorize-security-group-ingress \
            --region "$AWS_REGION" \
            --group-id "$SECURITY_GROUP" \
            --protocol tcp \
            --port 4444 \
            --cidr 0.0.0.0/0 >/dev/null
        
        log_success "Security group rules added"
    fi
    
    log_success "Security group ready: $SECURITY_GROUP"
    
    # Final verification that the security group exists
    log_info "Verifying security group exists..."
    VERIFY_SG=$(aws ec2 describe-security-groups \
        --region "$AWS_REGION" \
        --group-ids "$SECURITY_GROUP" \
        --query 'SecurityGroups[0].GroupId' \
        --output text 2>/dev/null)
    
    if [ "$VERIFY_SG" = "$SECURITY_GROUP" ]; then
        log_success "Security group verification passed: $SECURITY_GROUP"
    else
        log_error "Security group verification failed! Expected: $SECURITY_GROUP, Got: $VERIFY_SG"
        exit 1
    fi
}

# Cleanup existing resources using teardown script
cleanup_existing_resources() {
    log_info "Cleaning up any existing resources..."
    
    # Check if teardown script exists
    if [ -f "teardown.sh" ]; then
        log_info "Running teardown script to clean up existing resources..."
        
        # Run teardown script in cleanup mode (skip confirmation)
        echo "yes" | ./teardown.sh
        
        log_success "Existing resources cleaned up"
    else
        log_warning "Teardown script not found, skipping cleanup"
    fi
}

# Create EC2 instance
create_ec2_instance() {
    log_info "Creating EC2 instance..."
    log_info "Using security group: $SECURITY_GROUP"
    
    # Verify security group is set
    if [ -z "$SECURITY_GROUP" ]; then
        log_error "Security group not set! This should not happen."
        exit 1
    fi
    
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
    
    echo "INSTANCE_ID=$INSTANCE_ID" > ../.server-config
    
    log_info "Waiting for instance to be running..."
    aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
    
    # Get instance IP
    INSTANCE_IP=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text)
    
    echo "INSTANCE_IP=$INSTANCE_IP" >> ../.server-config
    
    # Check for existing Elastic IP or create new one
    log_info "Checking for Elastic IP..."
    EXISTING_EIP=$(aws ec2 describe-addresses --filters "Name=tag:Name,Values=$PROJECT_NAME" --query 'Addresses[0].AllocationId' --output text)
    
    if [ "$EXISTING_EIP" != "None" ] && [ -n "$EXISTING_EIP" ]; then
        log_info "Using existing Elastic IP: $EXISTING_EIP"
        ALLOCATION_ID="$EXISTING_EIP"
    else
        log_info "Creating new Elastic IP..."
        ALLOCATION_ID=$(aws ec2 allocate-address \
            --domain vpc \
            --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$PROJECT_NAME},{Key=Project,Value=$PROJECT_NAME}]" \
            --query 'AllocationId' \
            --output text)
        log_success "Created Elastic IP: $ALLOCATION_ID"
    fi
    
    # Associate Elastic IP with instance
    log_info "Associating Elastic IP with instance..."
    ASSOCIATION_ID=$(aws ec2 associate-address \
        --instance-id "$INSTANCE_ID" \
        --allocation-id "$ALLOCATION_ID" \
        --query 'AssociationId' \
        --output text)
    
    # Get the Elastic IP address
    ELASTIC_IP=$(aws ec2 describe-addresses \
        --allocation-ids "$ALLOCATION_ID" \
        --query 'Addresses[0].PublicIp' \
        --output text)
    
    echo "ELASTIC_IP=$ELASTIC_IP" >> ../.server-config
    echo "ALLOCATION_ID=$ALLOCATION_ID" >> ../.server-config
    
    # Use Elastic IP as the primary host (more stable than dynamic IP)
    EC2_HOST="$ELASTIC_IP"
    echo "EC2_HOST=$EC2_HOST" >> ../.server-config
    
    # Configure security group to allow HTTP, HTTPS, SSH, and custom ports
    log_info "Configuring security group..."
    aws ec2 authorize-security-group-ingress \
        --group-id "$SECURITY_GROUP" \
        --protocol tcp \
        --port 22 \
        --cidr 0.0.0.0/0 2>/dev/null || log_info "SSH rule already exists"
    
    aws ec2 authorize-security-group-ingress \
        --group-id "$SECURITY_GROUP" \
        --protocol tcp \
        --port 80 \
        --cidr 0.0.0.0/0 2>/dev/null || log_info "HTTP rule already exists"
    
    aws ec2 authorize-security-group-ingress \
        --group-id "$SECURITY_GROUP" \
        --protocol tcp \
        --port 443 \
        --cidr 0.0.0.0/0 2>/dev/null || log_info "HTTPS rule already exists"
    
    aws ec2 authorize-security-group-ingress \
        --group-id "$SECURITY_GROUP" \
        --protocol tcp \
        --port 4444 \
        --cidr 0.0.0.0/0 2>/dev/null || log_info "Backend port 4444 rule already exists"
    
    log_success "EC2 instance created: $INSTANCE_ID with Elastic IP: $ELASTIC_IP"
}

# Create S3 bucket
create_s3_bucket() {
    log_info "Creating S3 bucket..."
    
    # Generate unique bucket name using project name and timestamp
    BUCKET_NAME="${PROJECT_NAME}-$(date +%s)-$(openssl rand -hex 4)"
    
    log_info "Generated unique bucket name: $BUCKET_NAME"
    
    # Check if bucket already exists (shouldn't happen with unique names, but safety check)
    if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
        log_warning "S3 bucket '$BUCKET_NAME' already exists (unlikely with unique names)"
        log_info "Using existing bucket: $BUCKET_NAME"
    else
        log_info "Creating S3 bucket: $BUCKET_NAME"
        
        # Create bucket with region-specific configuration
        if [ "$AWS_REGION" = "us-east-1" ]; then
            aws s3api create-bucket --bucket "$BUCKET_NAME"
        else
            aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$AWS_REGION" --create-bucket-configuration LocationConstraint="$AWS_REGION"
        fi
        
        # Configure bucket for public access (if needed)
        aws s3api put-public-access-block \
            --bucket "$BUCKET_NAME" \
            --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
        
        # Tag the bucket for proper identification
        aws s3api put-bucket-tagging \
            --bucket "$BUCKET_NAME" \
            --tagging 'TagSet=[{Key=Name,Value=byu-590r},{Key=Project,Value=byu-590r}]'
        
        log_success "S3 bucket '$BUCKET_NAME' created successfully with tags"
    fi
    
    echo "S3_BUCKET=$BUCKET_NAME" >> ../.server-config
    
    # Upload book images to S3
    upload_book_images_to_s3 "$BUCKET_NAME"
}

# Upload book images to S3
upload_book_images_to_s3() {
    local BUCKET_NAME=$1
    
    if [ -z "$BUCKET_NAME" ]; then
        log_warning "S3 bucket name not provided, skipping book image upload"
        return
    fi
    
    log_info "Uploading book images to S3 bucket: $BUCKET_NAME"
    
    # Get the script directory and navigate to project root
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
    BOOKS_DIR="$PROJECT_ROOT/backend/public/assets/books"
    
    if [ ! -d "$BOOKS_DIR" ]; then
        log_warning "Book images directory not found: $BOOKS_DIR"
        log_info "Skipping book image upload - directory will be created during deployment"
        return
    fi
    
    # Files to upload (only the ones used in the seeder)
    FILES_TO_UPLOAD=(
        "hp1.jpeg"
        "hp2.jpeg"
        "hp3.jpeg"
        "hp4.jpeg"
        "hp5.jpeg"
        "hp6.jpeg"
        "hp7.jpeg"
        "mb1.jpg"
        "mb2.jpg"
        "mb3.jpg"
        "bom.jpg"
    )
    
    UPLOADED_COUNT=0
    for local_file in "${FILES_TO_UPLOAD[@]}"; do
        s3_key="images/$local_file"
        local_path="$BOOKS_DIR/$local_file"
        
        if [ -f "$local_path" ]; then
            log_info "Uploading $local_file to s3://$BUCKET_NAME/$s3_key"
            if aws s3 cp "$local_path" "s3://$BUCKET_NAME/$s3_key" --acl public-read 2>/dev/null; then
                ((UPLOADED_COUNT++))
                log_success "Uploaded $local_file successfully"
            else
                log_warning "Failed to upload $local_file"
            fi
        else
            log_warning "File not found: $local_path"
        fi
    done
    
    if [ $UPLOADED_COUNT -gt 0 ]; then
        log_success "Uploaded $UPLOADED_COUNT book images to S3 under /images folder"
    else
        log_warning "No book images were uploaded"
    fi
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
CREATE USER IF NOT EXISTS 'byu_user'@'localhost' IDENTIFIED BY 'trees243';
GRANT ALL PRIVILEGES ON byu_590r_app.* TO 'byu_user'@'localhost';
FLUSH PRIVILEGES;
MYSQL_EOF

# Configure Apache Virtual Hosts

# Enable Apache modules
sudo a2enmod rewrite
sudo a2enmod headers

    # Create virtual hosts with port-based routing
    sudo tee /etc/apache2/sites-available/byu-590r-backend.conf > /dev/null << 'APACHE_BACKEND_EOF'
<VirtualHost *:4444>
    ServerName localhost
    DocumentRoot /var/www/html/api/public
    
    <Directory /var/www/html/api/public>
        AllowOverride All
        Require all granted
        
        # Laravel routing
        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule ^(.*)$ index.php [QSA,L]
        
        # Set index files
        DirectoryIndex index.php index.html
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/byu590r_backend_error.log
    CustomLog ${APACHE_LOG_DIR}/byu590r_backend_access.log combined
</VirtualHost>
APACHE_BACKEND_EOF

    sudo tee /etc/apache2/sites-available/byu-590r-frontend.conf > /dev/null << 'APACHE_FRONTEND_EOF'
<VirtualHost *:80>
    ServerName localhost
    DocumentRoot /var/www/html/app/browser
    
    <Directory /var/www/html/app/browser>
        AllowOverride All
        Require all granted
        
        # Angular routing support
        RewriteEngine On
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
        
        # Set index files
        DirectoryIndex index.html
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/byu590r_frontend_error.log
    CustomLog ${APACHE_LOG_DIR}/byu590r_frontend_access.log combined
</VirtualHost>
APACHE_FRONTEND_EOF

    # Enable sites and disable default
    sudo a2ensite byu-590r-backend.conf
    sudo a2ensite byu-590r-frontend.conf
    sudo a2dissite 000-default
    
    # Add ports to Apache configuration
    echo "Listen 4444" | sudo tee -a /etc/apache2/ports.conf
    
    sudo systemctl reload apache2
    
    # Final Apache restart to ensure all changes take effect
    sudo systemctl restart apache2
    echo "[SUCCESS] Apache configuration complete"

# Set proper permissions for Laravel (if directories exist)
if [ -d "/var/www/html/api" ]; then
    sudo chown -R www-data:www-data /var/www/html/api
    sudo chmod -R 755 /var/www/html/api
    
    # Create Laravel directories if they don't exist
    sudo mkdir -p /var/www/html/api/storage
    sudo mkdir -p /var/www/html/api/bootstrap/cache
    
    # Set permissions for Laravel-specific directories
    sudo chmod -R 775 /var/www/html/api/storage
    sudo chmod -R 775 /var/www/html/api/bootstrap/cache
else
    echo "[INFO] Laravel application directory not found yet - permissions will be set during deployment"
fi

# Ensure Laravel can write to all necessary directories (if they exist)
if [ -d "/var/www/html/api/storage" ]; then
    sudo mkdir -p /var/www/html/api/storage/logs
    sudo mkdir -p /var/www/html/api/storage/framework
    sudo mkdir -p /var/www/html/api/storage/app
    sudo chmod -R 775 /var/www/html/api/storage/logs
    sudo chmod -R 775 /var/www/html/api/storage/framework
    sudo chmod -R 775 /var/www/html/api/storage/app
fi

# Create .env file if it doesn't exist
if [ ! -f /var/www/html/api/.env ]; then
    if [ -f /var/www/html/api/.env.example ]; then
        sudo cp /var/www/html/api/.env.example /var/www/html/api/.env
        sudo chown www-data:www-data /var/www/html/api/.env
        sudo chmod 644 /var/www/html/api/.env
        echo "[SUCCESS] Created .env file from .env.example"
    else
        echo "[INFO] .env.example not found - .env will be created during deployment"
    fi
fi

echo "Server setup complete! Ready for GitHub Actions deployment."
EOF
    
    # Copy and run setup script
    scp -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no setup-server.sh ubuntu@"$EC2_HOST":~/
    ssh -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no ubuntu@"$EC2_HOST" "chmod +x setup-server.sh && ./setup-server.sh"
    
    # Clean up temporary files (both local and remote)
    log_info "Cleaning up temporary files..."
    rm -f setup-server.sh
    ssh -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no ubuntu@"$EC2_HOST" "rm -f setup-server.sh" 2>/dev/null || true
    
    log_success "EC2 server setup complete"
}

# Main setup function
main() {
    log_info "Starting BYU 590R Server Setup..."
    log_info "Initial SECURITY_GROUP value: '$SECURITY_GROUP'"
    
    check_prerequisites
    cleanup_existing_resources
    create_or_get_security_group
    log_info "SECURITY_GROUP after create_or_get_security_group: '$SECURITY_GROUP'"
    create_ec2_instance
    create_s3_bucket
    setup_ec2_dependencies
    
    echo ""
    log_success "🎉 Server setup complete!"
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                                                                              ║"
    echo "║                    🚀 PROD ENVIRONMENT SETUP COMPLETE 🚀                    ║"
    echo "║                                                                              ║"
    echo "║  Your BYU 590R production environment is now ready for deployment!         ║"
    echo "║                                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Load configuration from .server-config
    if [ -f "../.server-config" ]; then
        source ../.server-config
    fi
    
    log_info "Server Details:"
    echo "  Instance ID: $INSTANCE_ID"
    echo "  Elastic IP: $ELASTIC_IP"
    echo "  EC2 Host: $EC2_HOST"
    echo "  S3 Bucket: $S3_BUCKET"
    echo ""
    log_info "📋 Next Steps - Update GitHub Actions Secrets:"
    echo ""
    echo "  1. Go to your GitHub repository settings:"
    echo "     ${GITHUB_REPO_URL:-https://github.com/BYU-IS-590R-Christiansen/byu-590r-monorepo/settings/secrets/actions}"
    echo ""
    echo "  2. Update the EC2_HOST secret with the new Elastic IP:"
    echo ""
    echo "     Secret Name: EC2_HOST"
    echo "     Secret Value: $EC2_HOST"
    echo ""
    echo "  3. Update the S3_BUCKET secret with the generated bucket name:"
    echo ""
    echo "     Secret Name: S3_BUCKET"
    echo "     Secret Value: $S3_BUCKET"
    echo ""
    echo "  4. If you don't have EC2_SSH_PRIVATE_KEY secret yet, add it:"
    echo "     Secret Name: EC2_SSH_PRIVATE_KEY"
    echo "     Secret Value: (Copy the contents of ~/.ssh/$KEY_NAME.pem)"
    echo ""
    echo "  5. To get your SSH private key content, run:"
    echo "     cat ~/.ssh/$KEY_NAME.pem"
    echo ""
    echo "  6. Copy the entire output (including -----BEGIN and -----END lines)"
    echo "     and paste it as the value for EC2_SSH_PRIVATE_KEY"
    echo ""
    echo "  7. Once secrets are updated, push changes to main branch to trigger deployment"
    echo ""
    echo "  🚀 Your application will be available at:"
    echo "     Frontend: http://$EC2_HOST"
    echo "     Backend API: http://$EC2_HOST:4444/api/hello"
    echo ""
    echo "  📝 Generated Values Summary:"
    echo "     EC2_HOST: $EC2_HOST"
    echo "     S3_BUCKET: $S3_BUCKET"
    echo "     INSTANCE_ID: $INSTANCE_ID"
    echo ""
    log_info "Configuration saved to: ../.server-config"
    
    # Final cleanup - ensure no temporary files remain
    log_info "Final cleanup..."
    rm -f setup-server.sh
}

# Run main function
main "$@"
