pipeline {
    agent any

    environment {
        IMAGE_BACKEND  = 'cafespot-backend'
        IMAGE_FRONTEND = 'cafespot-frontend'
        PYTHON = '"C:\\Users\\Jazlyn Nicolette\\AppData\\Local\\Programs\\Python\\Python311\\python.exe"'
        PIP    = '"C:\\Users\\Jazlyn Nicolette\\AppData\\Local\\Programs\\Python\\Python311\\Scripts\\pip.exe"'
        REPO_URL = 'https://github.com/jnicolette/cafespot.git'
        BRANCH   = 'main'
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Checking out source code from GitHub...'
                git url: "${REPO_URL}", branch: "${BRANCH}"
            }
        }

        stage('Lint & Validate') {
            steps {
                echo 'Validating Python backend syntax...'
                bat "%PYTHON% -m py_compile backend\\app.py && echo backend/app.py OK"
                echo 'Checking required project files exist...'
                bat '''
                    if exist backend\\app.py (echo backend/app.py OK) else (echo ERROR: backend/app.py missing & exit 1)
                    if exist backend\\requirements.txt (echo backend/requirements.txt OK) else (echo ERROR: requirements.txt missing & exit 1)
                    if exist backend\\Dockerfile (echo backend/Dockerfile OK) else (echo ERROR: backend/Dockerfile missing & exit 1)
                    if exist frontend\\index.html (echo frontend/index.html OK) else (echo ERROR: index.html missing & exit 1)
                    if exist frontend\\dashboard.html (echo frontend/dashboard.html OK) else (echo ERROR: dashboard.html missing & exit 1)
                    if exist frontend\\Dockerfile (echo frontend/Dockerfile OK) else (echo ERROR: frontend/Dockerfile missing & exit 1)
                    if exist docker-compose.yml (echo docker-compose.yml OK) else (echo ERROR: docker-compose.yml missing & exit 1)
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing Python dependencies locally...'
                bat "%PIP% install -r backend\\requirements.txt"
                echo 'Verifying imports...'
                bat "%PYTHON% -c \"import flask, flask_cors, flask_jwt_extended, requests; print('All imports OK')\""
            }
        }

        stage('Build Docker Images') {
            steps {
                echo 'Building backend Docker image...'
                bat "docker build -t %IMAGE_BACKEND%:latest ./backend"
                echo 'Building frontend Docker image...'
                bat "docker build -t %IMAGE_FRONTEND%:latest ./frontend"
                echo 'Building via docker compose...'
                bat "docker compose build"
            }
        }

        stage('Test Backend Health') {
            steps {
                echo 'Removing any previous test container...'
                script {
                    try {
                        bat "docker rm -f test-backend"
                    } catch (err) {
                        echo "No existing test-backend container to remove."
                    }
                }
                echo 'Starting backend container...'
                bat "docker run -d --name test-backend -p 5099:5000 -e SECRET_KEY=test-secret -e DB_PATH=/tmp/test.db %IMAGE_BACKEND%:latest"
                sleep(time: 8, unit: 'SECONDS')
                echo 'Printing container logs for diagnostics...'
                bat "docker logs test-backend"
                echo 'Running health check...'
                bat "curl -f http://localhost:5099/api/health"
                echo 'Health check passed!'
                bat "docker stop test-backend"
                bat "docker rm test-backend"
            }
        }

        stage('Deploy') {
            steps {
                echo 'Stopping existing containers...'
                script {
                    try {
                        bat "docker compose down"
                    } catch (err) {
                        echo "Nothing running to stop."
                    }
                }
                echo 'Starting all containers...'
                bat "docker compose up -d --build"
                echo ''
                echo '========================================='
                echo ' CafeSpot is LIVE!'
                echo ' Frontend:  http://localhost:8081'
                echo ' Backend:   http://localhost:5000'
                echo ' API Docs:  http://localhost:5000/api/health'
                echo '========================================='
            }
        }
    }

    post {
        success {
            echo 'Pipeline succeeded! CafeSpot is live at http://localhost:8081'
        }
        failure {
            echo 'Pipeline failed. Check the stage logs above for details.'
        }
        always {
            echo 'Cleaning up test containers...'
            script {
                try {
                    bat "docker rm -f test-backend"
                } catch (err) {
                    echo "No test-backend to clean up."
                }
            }
        }
    }
}
