FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    cron \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN crawl4ai-setup
RUN python -m playwright install --with-deps chromium

COPY pipeline/ .
COPY pipeline_automation/entrypoint.sh .
RUN chmod +x entrypoint.sh

ENV ORCHESTRATOR_CRON_SCHEDULE="0 0 * * *"
ENV RETENTION_CRON_SCHEDULE="0 0 * * *"

ENTRYPOINT ["./entrypoint.sh"]
