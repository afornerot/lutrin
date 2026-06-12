FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY lutrin_api/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire API code
COPY lutrin_api/ .

# Create data directory (will be mounted as volume)
RUN mkdir -p /data

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV FLASK_PORT=5000
ENV UPLOAD_FOLDER=/data
ENV DATABASE_PATH=/data/database.db

# Expose port
EXPOSE 5000

# Run with gunicorn
CMD ["gunicorn", "--workers", "4", "--threads", "4", "--bind", "0.0.0.0:5000", "--timeout", "300", "app:app"]