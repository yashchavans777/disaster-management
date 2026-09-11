FROM python:3.11-slim

WORKDIR /app

COPY fastapi-server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY fastapi-server ./fastapi-server

EXPOSE 8000

CMD ["uvicorn", "fastapi-server.main:app", "--host", "0.0.0.0", "--port", "8000"]