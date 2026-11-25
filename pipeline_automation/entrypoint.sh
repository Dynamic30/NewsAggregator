#!/bin/sh
set -e

: > /etc/environment
chmod 600 /etc/environment
for name in PATH DATABASE_PIPELINE OLLAMA_EMBED_URL LLM_URL LLM_API_KEY LLM_MODEL RETENTION_DAYS; do
    eval "value=\${$name-}"
    escaped=$(printf '%s' "$value" | sed "s/'/&\\\\&&/g")
    printf "export %s='%s'\n" "$name" "$escaped" >> /etc/environment
done

{
    echo "${ORCHESTRATOR_CRON_SCHEDULE} root . /etc/environment; cd /app && python orchestrator.py >> /proc/1/fd/1 2>> /proc/1/fd/2"
    echo "${RETENTION_CRON_SCHEDULE} root . /etc/environment; cd /app && python delete_old_articles.py >> /proc/1/fd/1 2>> /proc/1/fd/2"
} > /etc/cron.d/pipeline-cron

chmod 0644 /etc/cron.d/pipeline-cron

exec cron -f
