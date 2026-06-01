FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (e.g. build-essential, portaudio for audio processing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    portaudio19-dev \
    libasound2-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY . .

# Expose API port
EXPOSE 8000

CMD ["python", "-m", "jarvis"]
