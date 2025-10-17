# DevOps Scripts

This directory contains scripts for setting up and managing the BYU 590R application infrastructure.

## Current Setup

The project now uses **GitHub Actions for CI/CD** instead of manual deployment scripts.

## Scripts

### `setup-ec2-server.sh`

**Purpose**: Sets up a fresh EC2 instance with all necessary dependencies
**Usage**:

```bash
chmod +x setup-ec2-server.sh
./setup-ec2-server.sh
```

**What it does**:

- Creates a new EC2 instance
- Installs Node.js, PHP, MySQL, Nginx, Composer
- Sets up database and user
- Configures Nginx for the application
- Creates systemd service for Laravel (but doesn't start it)
- Prepares directories for GitHub Actions deployment

### `teardown.sh`

**Purpose**: Cleanup script to terminate EC2 resources
**Usage**:

```bash
chmod +x teardown.sh
./teardown.sh
```

## GitHub Actions Workflows

The actual deployment is handled by GitHub Actions workflows in `.github/workflows/`:

- **`ci-cd.yml`**: Main CI/CD pipeline that tests and deploys both backend and frontend to EC2

## Workflow

1. **Initial Setup**: Run `setup-ec2-server.sh` once to create the server
2. **Add GitHub Secrets**: Add `EC2_HOST` and `EC2_SSH_PRIVATE_KEY` to repository secrets
3. **Deploy**: Push to main branch to trigger automatic deployment
4. **Cleanup**: Run `teardown.sh` when done to terminate resources

## Configuration Files

- **`.server-config`**: Created by setup script, contains EC2 instance details
- **`.aws-config`**: Legacy config file (can be removed)

## Scripts

- **`setup-ec2-server.sh`**: Sets up a fresh EC2 instance with all dependencies
- **`teardown.sh`**: Cleans up EC2 resources when done

## Security

- EC2 security group allows SSH (22), HTTP (80), HTTPS (443), Backend API (4444), and Frontend (8888)
- All outbound traffic allowed for dependency downloads
- Database only accessible from localhost
- SSH key authentication used
- Port-based routing eliminates Apache path conflicts
