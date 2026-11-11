pipeline {
  agent {
    docker {
      image 'node:24-bookworm'
      args '--shm-size=1g'
    }
  }
  options {
    skipDefaultCheckout(true)
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timestamps()
  }
  environment {
    CI = 'true'
    PLAYWRIGHT_BROWSERS_PATH = '/tmp/playwright-browsers'
  }
  stages {
    stage('Checkout') { steps { checkout scm } }
    stage('Install') { steps { sh 'npm ci' } }
    stage('Audit') { steps { sh 'npm audit --audit-level=high' } }
    stage('Unit tests') { steps { sh 'npm run test -- --reporter=default --reporter=junit --outputFile=test-results/unit.xml' } }
    stage('Lint') { steps { sh 'npm run lint' } }
    stage('Build') { steps { sh 'npm run build' } }
    stage('Browser setup') { steps { sh 'npx playwright install --with-deps chromium' } }
    stage('Desktop and mobile tests') { steps { sh 'npm run test:e2e' } }
  }
  post {
    always {
      junit allowEmptyResults: true, testResults: 'test-results/*.xml'
      archiveArtifacts allowEmptyArchive: true, artifacts: 'dist/**,playwright-report/**,test-results/**'
      deleteDir()
    }
  }
}