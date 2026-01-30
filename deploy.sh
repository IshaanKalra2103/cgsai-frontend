#!/usr/bin/env bash

##############################################################################
# CGS AI - Frontend (Cloud Run) Deployment Script
#
# This mirrors the structure of `server/deploy.sh` but for the frontend.
#
# Key behavior:
# - Reads backend API base URL from repo-root `url.txt`
# - Injects it into the build as `VITE_API_URL`
# - Builds + deploys the frontend to Cloud Run via Cloud Build
##############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Repo root + URL input file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
URL_FILE="${ROOT_DIR}/url.txt"

# Configuration
PROJECT_ID="spp-cgs-mzhu-research-chatgpt"
SERVICE_NAME="cgsai-frontend"
REGION="us-central1"

# Functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ $1${NC}"; }

resolve_api_url() {
    if [[ ! -f "${URL_FILE}" ]]; then
        print_error "Missing ${URL_FILE}."
        print_info "Run backend deploy first (server/deploy.sh) or create url.txt with https://<backend>/api/v1"
        exit 1
    fi

    local api_url
    api_url="$(tr -d '\r\n' < "${URL_FILE}" | xargs)"

    if [[ -z "${api_url}" ]]; then
        print_error "${URL_FILE} is empty."
        exit 1
    fi

    # Ensure it points at the API base (frontend expects .../api/v1)
    if [[ "${api_url}" != *"/api/v1" ]]; then
        api_url="${api_url%/}/api/v1"
    fi

    echo "${api_url}"
}

preflight_checks() {
    print_header "Pre-flight Checks"

    if command -v gcloud >/dev/null 2>&1; then
        print_success "gcloud is installed"
    else
        print_error "gcloud is not installed"
        exit 1
    fi

    if [[ -f "${SCRIPT_DIR}/cloudbuild.yaml" ]]; then
        print_success "cloudbuild.yaml found"
    else
        print_error "cloudbuild.yaml not found"
        exit 1
    fi

    local api_url
    api_url="$(resolve_api_url)"
    print_success "Found backend API URL in url.txt"
    print_info "VITE_API_URL=${api_url}"
}

set_project() {
    print_header "Setting GCP Project"
    gcloud config set project "${PROJECT_ID}" >/dev/null
    print_success "Project set to ${PROJECT_ID}"
}

deploy_via_cloud_build() {
    local api_url="$1"

    print_header "Deploying Frontend via Cloud Build"
    print_info "Service: ${SERVICE_NAME}"
    print_info "Region: ${REGION}"
    print_info "Injecting VITE_API_URL=${api_url}"

    gcloud builds submit \
        --config "${SCRIPT_DIR}/cloudbuild.yaml" \
        --substitutions "_VITE_API_URL=${api_url}" \
        "${SCRIPT_DIR}"

    print_success "Cloud Build submitted"
}

get_service_url() {
    print_header "Service Information"

    SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
        --platform managed \
        --region "${REGION}" \
        --format 'value(status.url)')

    if [[ -n "${SERVICE_URL}" ]]; then
        echo -e "${GREEN}Frontend Service URL: ${SERVICE_URL}${NC}"
    else
        print_warning "Unable to fetch service URL (service may not exist yet)."
    fi
}

main() {
    print_header "CGS AI - Frontend Deployment"

    echo "This script will deploy the frontend to Google Cloud Run"
    echo "Project: ${PROJECT_ID}"
    echo "Service: ${SERVICE_NAME}"
    echo "Region: ${REGION}"
    echo ""

    preflight_checks
    set_project

    local api_url
    api_url="$(resolve_api_url)"

    read -p "Proceed with frontend deployment? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Deployment cancelled"
        exit 0
    fi

    deploy_via_cloud_build "${api_url}"
    get_service_url
    print_success "Frontend deploy kicked off."
}

COMMAND="${1:-full}"
case "${COMMAND}" in
    full)
        main
        ;;
    url)
        resolve_api_url
        ;;
    *)
        echo "Usage: $0 {full|url}"
        echo ""
        echo "Commands:"
        echo "  full - Run full frontend deployment (default)"
        echo "  url  - Print the backend API URL being used"
        exit 1
        ;;
esac
