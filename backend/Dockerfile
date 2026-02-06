# Gunakan image Python resmi
FROM python:3.9

# Buat user baru (Hugging Face mewajibkan user ID 1000)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

# Set working directory ke /app
WORKDIR /app

# Copy requirements dan install dependencies
COPY --chown=user ./requirements.txt requirements.txt
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy semua kodingan backend kita
COPY --chown=user . /app

# Jalankan backend kita (main.py) di port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
