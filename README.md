# BYU 590R Monorepo

A student-friendly monorepo project with Laravel backend, Angular frontend, and AWS deployment.

## Features

- **Laravel Backend**: RESTful API with MySQL database
- **Angular Frontend**: Modern web application with TypeScript
- **AWS Infrastructure**: EC2 instance with Nginx, PHP, Node.js, MySQL
- **GitHub Actions CI/CD**: Automated testing and deployment
- **Cost Optimized**: ~$0-2/month with free tier usage

## Quick Start

### Local Development

1. **Start all services**:

   ```bash
   make start
   ```

2. **Access the application**:
   - Frontend: http://localhost:4200 (development)
   - Backend API: http://localhost:8000
   - Database: localhost:3306

### AWS Deployment

1. **Setup EC2 server** (one-time setup):

   ```bash
   cd devops
   chmod +x setup-ec2-server.sh
   ./setup-ec2-server.sh
   ```

2. **Configure GitHub Actions**:

   - Add these secrets to your GitHub repository:
     - `EC2_HOST`: Your EC2 public IP address for deployment
     - `EC2_SSH_PRIVATE_KEY`: Contents of your SSH private key for server access
     - `DB_DATABASE`: Database name for the Laravel application
     - `DB_USERNAME`: Database username for MySQL connection
     - `DB_PASSWORD`: Database password for MySQL connection
     - `APP_DEBUG`: Laravel debug mode setting (true/false)
     - `OPENAI_API_KEY`: OpenAI API key for AI features (optional)
     - `AWS_ACCESS_KEY_ID`: AWS access key for AWS services
     - `AWS_SECRET_ACCESS_KEY`: AWS secret key for AWS services
     - `AWS_REGION`: AWS region for AWS services
   - See `.github/README.md` for detailed instructions

3. **Deploy via GitHub Actions**:

   - Push changes to `main` branch
   - GitHub Actions will automatically test and deploy
   - Check the Actions tab for deployment status

4. **Access your application**:

   - Frontend: `http://YOUR_EC2_IP`
   - Backend API: `http://YOUR_EC2_IP/api`

5. **Clean up when done**:
   ```bash
   cd devops
   chmod +x teardown.sh
   ./teardown.sh
   ```

## Available Commands

### Local Development

- `make start` - Start local development environment
- `make build-images` - Build Docker images for deployment
- `make help` - Show all available commands

### AWS Deployment

- `cd devops && ./setup-ec2-server.sh` - Setup EC2 server (one-time)
- `cd devops && ./teardown.sh` - Clean up all AWS resources

## Project Structure

```
├── backend/          # Laravel API
├── web-app/          # Angular frontend
├── .github/workflows/ # GitHub Actions CI/CD
│   └── ci-cd.yml     # Main CI/CD pipeline
├── devops/           # AWS deployment configurations
│   ├── setup-ec2-server.sh # EC2 server setup
│   ├── teardown.sh   # AWS cleanup script
│   └── fix-github-actions-iam.sh # IAM permissions fix
├── ULTRA_CHEAP_SETUP.md # Manual setup guide
└── Makefile         # Development commands
```

## API Endpoints

- `GET /api/hello` - Hello World endpoint
- `GET /api/health` - Health check endpoint

## Documentation

- **[ULTRA_CHEAP_SETUP.md](ULTRA_CHEAP_SETUP.md)** - Complete ultra-cheap setup guide (~$0-2/month)

## Learning Objectives

This project teaches:

- Web application deployment (Laravel + Angular)
- Database management (MySQL installation and configuration)
- AWS managed services (EC2)
- CI/CD with GitHub Actions
- Server configuration and automation
- Infrastructure management

Perfect for learning modern DevOps practices at minimal cost!
