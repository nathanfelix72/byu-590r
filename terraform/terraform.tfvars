# BYU 590R Monorepo Terraform Variables
# This file contains non-sensitive infrastructure configuration and is committed to the repository

# AWS Configuration
aws_region   = "us-west-1"
key_name     = "byu-590r"
project_name = "byu-590r"

# Environment
environment = "production" # Can be 'development', 'local', or 'production'

# EC2 Configuration (t3.medium: 2 vCPU / 4 GiB — better for MySQL + Apache + PHP than t2.micro)
instance_type = "t3.medium"
ami_id        = "ami-04f34746e5e1ec0fe"

# Security Group Configuration (HTTP/HTTPS/API — not SSH)
allowed_cidr_blocks = ["0.0.0.0/0"]
# SSH for GitHub Actions deploys; keep 0.0.0.0/0 unless you use another deploy path (e.g. SSM)
ssh_ingress_cidr_blocks = ["0.0.0.0/0"]

# S3: pin names to match existing buckets in AWS / state (avoids replace on apply).
# New deployments: remove these two lines to get stable auto-generated names, or set your own.
s3_dev_bucket_name  = "byu-590r-dev-20260207193209"
s3_prod_bucket_name = "byu-590r-prod-20260207193209-484a"

# Book Images Configuration
book_images_path = "backend/public/assets/books"
book_images = [
  "hp1.jpeg",
  "hp2.jpeg",
  "hp3.jpeg",
  "hp4.jpeg",
  "hp5.jpeg",
  "hp6.jpeg",
  "hp7.jpeg",
  "mb1.jpg",
  "mb2.jpg",
  "mb3.jpg",
  "bom.jpg"
]

# Optional: update GitHub Actions secrets from Terraform (EC2_HOST, S3_BUCKET, etc.)
# Only used when manage_github_secrets = true. Do not commit real tokens.
# github_token       = ""   # GitHub PAT with repo Secrets write
# github_repository  = "BYU-IS-590R-Christiansen/byu-590r-monorepo"
# manage_github_secrets = false
