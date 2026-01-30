#!/bin/bash
# Setup Cloud Build trigger for GitHub -> Cloud Run deployment
#
# PREREQUISITE: Connect your GitHub repository to Cloud Build first:
# 1. Go to: https://console.cloud.google.com/cloud-build/repositories/2nd-gen?project=spp-cgs-mzhu-research-chatgpt
# 2. Click "Link a Repository"
# 3. Select GitHub and authenticate
# 4. Select the cgsai-frontend repository

set -e

PROJECT_ID="spp-cgs-mzhu-research-chatgpt"
TRIGGER_NAME="cgsai-frontend-main-deploy"
REPO_OWNER="IshaanKalra2103"
REPO_NAME="cgsai-frontend"
BRANCH="^main$"
BUILD_CONFIG="cloudbuild.yaml"

echo "Creating Cloud Build trigger for client..."
echo "  Project: $PROJECT_ID"
echo "  Repo: $REPO_OWNER/$REPO_NAME"
echo "  Branch: main"
echo "  Config: $BUILD_CONFIG"
echo ""
echo "NOTE: Make sure you've connected the GitHub repo first via Cloud Console"
echo ""

gcloud builds triggers create github \
  --name="$TRIGGER_NAME" \
  --repo-name="$REPO_NAME" \
  --repo-owner="$REPO_OWNER" \
  --branch-pattern="$BRANCH" \
  --build-config="$BUILD_CONFIG" \
  --project="$PROJECT_ID"

echo ""
echo "Client trigger created successfully!"
echo "Pushes to 'main' branch will now trigger Cloud Build -> Cloud Run deployment."
