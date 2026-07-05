FROM python:3.11-slim

# Install build tools required by some Python packages (e.g., numpy, torch wheels)
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        build-essential \
        libffi-dev \
        libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]
