# UniVote: University-wide Student Council Election Management System (UPSCEMS)
A web-based voting system for UP Tacloban students.

# Installation and Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed on your Windows machine:

1. **Node.js** (v16 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version` and `npm --version`

2. **Python** (v3.8 or higher)
   - Download from: https://www.python.org/downloads/
   - Verify installation: `python --version`
   - Make sure to check "Add Python to PATH" during installation

3. **pip** (Python package manager, usually comes with Python)
   - Verify installation: `pip --version`

4. **pipenv** (Python virtual environment manager)
   - Install globally: `pip install pipenv`
   - Verify installation: `pipenv --version`

---

## Backend Setup (Django)

### 1. Navigate to Backend Directory

cd backend


### 2. Install Python Dependencies

pipenv install

This will install all dependencies from the Pipfile, including:
- Django
- djangorestframework
- djangorestframework-simplejwt
- django-cors-headers
- And other backend dependencies

### 3. Activate Virtual Environment

pipenv shell

### 4. Run Database Migrations

python manage.py migrate


### 5. (Optional) Seed Database with Sample Data

python manage.py seed

This creates:
- Sample users (admin, voters, candidates, auditor)
- Sample election data
- Initial voting positions

### 6. Start Django Development Server

python manage.py runserver


The backend API will be available at: http://127.0.0.1:8000/

**Keep this terminal window open while running the application.**

---

## Frontend Setup (React)

### 1. Open a NEW Terminal Window

### 2. Navigate to Frontend Directory

cd frontend


### 3. Install Node.js Dependencies

npm install


This will install all dependencies from package.json, including:
- react (v19.2.0)
- react-dom (v19.2.0)
- react-router-dom (v7.9.4)
- recharts (v3.5.1) - for pie charts
- Testing libraries (@testing-library/react, @testing-library/jest-dom, etc.)

**Note:** axios has been removed and replaced with native fetch API.

### 4. Start React Development Server

npm start


The frontend will automatically open in your browser at: http://localhost:3000/

**Keep this terminal window open while running the application.**

---

## Running the Complete Application

### Step-by-Step Launch Process:

1. **Terminal 1 - Backend:**

cd backend
python manage.py runserver

Wait for message: "Starting development server at http://127.0.0.1:8000/"

2. **Terminal 2 - Frontend:**

cd frontend
npm start

Browser will automatically open to http://localhost:3000/

3. **Access the Application:**
- Landing Page: http://localhost:3000/
- API Endpoints: http://127.0.0.1:8000/api/

---

## Default Login Credentials (After Seeding)

### Admin Account:
- Email: `admin@up.edu.ph`
- Password: `admin123`

### Voter Accounts:
- Email: `voter1@up.edu.ph`
- Password: `password123`
- (voter2, voter3, etc. also available)

### Candidate Accounts:
- Email: `chair1@up.edu.ph`
- Password: `password123`
- (chair2, vicechair1, councilor1, etc. also available)

### Auditor Account:
- Email: `auditor@up.edu.ph`
- Password: `auditor123`

---
