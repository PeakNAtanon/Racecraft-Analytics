FROM python:3.13-slim
WORKDIR /app
COPY pyproject.toml ./
COPY racecraft_ingest ./racecraft_ingest
RUN pip install --no-cache-dir .
ENV FASTF1_CACHE=/data/fastf1-cache
ENV FASTF1_ENABLED=true
VOLUME ["/data"]
CMD ["racecraft-ingest", "--once"]
