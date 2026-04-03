FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY lutrin_client/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire client code
COPY lutrin_client/ .

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV API_PORT=5000
ENV CLIENT_PORT=8000

# Expose port
EXPOSE 8000

# Run with gunicorn (HTTPS)
CMD ["gunicorn", "--workers", "4", "--timeout", "300", "--bind", "0.0.0.0:8000", "--certfile", "/certs/cert.pem", "--keyfile", "/certs/key.pem", "--access-logfile", "-", "--error-logfile", "-", "app:app"]