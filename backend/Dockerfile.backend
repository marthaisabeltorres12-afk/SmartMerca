# ── Dockerfile Backend (Flask) ──────────────────────────────────────
FROM python:3.11-slim

# Variables de entorno
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Instalar dependencias del sistema (MySQL client)
RUN apt-get update && apt-get install -y \
    default-libmysqlclient-dev \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Directorio de trabajo
WORKDIR /app

# Copiar e instalar dependencias Python
COPY requirements_docker.txt .
RUN pip install --no-cache-dir -r requirements_docker.txt

# Copiar código del backend
COPY . .

# Puerto que expone el backend
EXPOSE 5000

# Arrancar con gunicorn (producción)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "app:app"]