# Auto-Transcriber

This project consists of a **FastAPI** backend for real-time speech-to-text processing and a **Dockerized** frontend.

## Starting the Webapp

### 1. Backend Setup

Navigate to the backend directory and set up your Python virtual environment.

```bash
cd backend
python -m venv venv

```

#### Activate the Environment

* **Windows:**
```bash
.\venv\Scripts\activate

```


* **Mac/Linux:**
```bash
source venv/bin/activate

```

#### Install Dependencies

Depending on your OS and hardware, run the installation commands:

* **Windows/Linux (with NVIDIA GPU - CUDA 12.1):**
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

```


* **Mac / Generic:**
```bash
pip install torch torchvision torchaudio

```


* **Other Requirements:**
```bash
pip install fastapi uvicorn websockets RealtimeSTT

```



#### Run the Server

```bash
python main.py

```

---

### 2. Frontend Setup

The frontend is containerized for easy deployment. Ensure you have **Docker** and **Docker Compose** installed.

```bash
# Build and start the frontend container
docker-compose up --build

```