#!/bin/bash

##############################################################################
# CGS AI Frontend - Google Cloud Platform Deployment Script
#
# This script deploys the CGS Frontend application to Google Cloud Run
#
# Features:
# - Builds and pushes Docker image to GCR
# - Deploys to Cloud Run as static nginx container
# - Reads backend API URL from ../url.txt (set by server deploy)
# - Lightweight deployment for serving static React app
#
# Prerequisites:
# - Backend must be deployed first (../server/deploy.sh)
# - Or manually set VITE_API_URL environment variable
##############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
URL_FILE="${ROOT_DIR}/url.txt"

# Configuration
PROJECT_ID="spp-cgs-mzhu-research-chatgpt"
SERVICE_NAME="cgsai-frontend"
REGION="us-central1"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Get API URL from url.txt or environment
get_api_url() {
    if [ -n "${VITE_API_URL:-}" ]; then
        print_success "Using VITE_API_URL from environment: ${VITE_API_URL}"
    elif [ -f "${URL_FILE}" ]; then
        export VITE_API_URL=$(cat "${URL_FILE}" | tr -d '\n')
        print_success "Loaded API URL from ${URL_FILE}: ${VITE_API_URL}"
    else
        print_error "No API URL found!"
        print_info "Either set VITE_API_URL environment variable or deploy the backend first"
        print_info "Backend deploy creates ${URL_FILE} automatically"
        exit 1
    fi
}

# Pre-flight checks
preflight_checks() {
    print_header "Pre-flight Checks"

    # Check for nginx.conf
    if [ -f "${SCRIPT_DIR}/nginx.conf" ]; then
        print_success "nginx.conf found"
    else
        print_error "nginx.conf not found!"
        exit 1
    fi

    # Check for Dockerfile
    if [ -f "${SCRIPT_DIR}/Dockerfile" ]; then
        print_success "Dockerfile found"
    else
        print_error "Dockerfile not found!"
        exit 1
    fi

    # Check for package.json
    if [ -f "${SCRIPT_DIR}/package.json" ]; then
        print_success "package.json found"
    else
        print_error "package.json not found!"
        exit 1
    fi

    # Get API URL
    get_api_url

    echo ""
}

# Set the active project
set_project() {
    print_header "Setting GCP Project"
    gcloud config set project ${PROJECT_ID}
    print_success "Project set to ${PROJECT_ID}"
}

# Build and push Docker image
build_and_push() {
    print_header "Building and Pushing Docker Image"

    echo "Building Docker image: ${IMAGE_NAME}..."
    echo "Using API URL: ${VITE_API_URL}"

    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions _VITE_API_URL="${VITE_API_URL}"

    print_success "Docker image built and pushed successfully"
}

# Deploy to Cloud Run
deploy_to_cloud_run() {
    print_header "Deploying to Cloud Run"

    echo "Deploying ${SERVICE_NAME} to Cloud Run in ${REGION}..."

    gcloud run deploy ${SERVICE_NAME} \
        --image ${IMAGE_NAME} \
        --platform managed \
        --region ${REGION} \
        --allow-unauthenticated \
        --memory=256Mi \
        --cpu=1 \
        --timeout=300 \
        --max-instances=10 \
        --min-instances=0 \
        --port=8080

    print_success "Deployment completed successfully"
}

# Get service URL
get_service_url() {
    print_header "Service Information"

    SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
        --platform managed \
        --region ${REGION} \
        --format 'value(status.url)')

    echo -e "${GREEN}Frontend URL: ${SERVICE_URL}${NC}"
    echo -e "${GREEN}Backend API: ${VITE_API_URL}${NC}"
}

# View logs
view_logs() {
    print_header "Recent Logs"

    echo "Fetching recent logs..."
    gcloud run services logs read ${SERVICE_NAME} \
        --platform managed \
        --region ${REGION} \
        --limit=50
}

# Main deployment flow
main() {
    print_header "CGS AI Frontend - Google Cloud Platform Deployment"

    echo "This script will deploy the CGS Frontend application to Google Cloud Run"
    echo "Project: ${PROJECT_ID}"
    echo "Service: ${SERVICE_NAME}"
    echo "Region: ${REGION}"
    echo ""

    # Run pre-flight checks
    preflight_checks

    read -p "Do you want to proceed with deployment? (y/n) " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Deployment cancelled"
        exit 0
    fi

    # Execute deployment steps
    set_project
    build_and_push
    deploy_to_cloud_run
    get_service_url

    print_header "Deployment Complete!"
    print_success "Your frontend is now running on Google Cloud Run"

    echo ""
    read -p "Do you want to view recent logs? (y/n) " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        view_logs
    fi
}

# Command line options
case "${1:-}" in
    build)
        preflight_checks
        set_project
        build_and_push
        ;;
    deploy)
        preflight_checks
        set_project
        deploy_to_cloud_run
        get_service_url
        ;;
    logs)
        view_logs
        ;;
    url)
        get_service_url
        ;;
    full)
        main
        ;;
    *)
        echo "Usage: $0 {build|deploy|logs|url|full}"
        echo ""
        echo "Commands:"
        echo "  build  - Build and push Docker image only"
        echo "  deploy - Deploy to Cloud Run (assumes image is already built)"
        echo "  logs   - View recent application logs"
        echo "  url    - Get the service URL"
        echo "  full   - Run full deployment (build + deploy)"
        echo ""
        echo "Example: ./deploy.sh full"
        echo ""
        echo "Environment Variables:"
        echo "  VITE_API_URL - Backend API URL (optional if backend is deployed)"
        echo ""
        echo "Note: Backend API URL is automatically loaded from ../url.txt"
        echo "      which is created by the server deploy script."
        exit 1
        ;;
esac
