#!/bin/sh
set -e

printenv | grep -v "^HOSTNAME=" > /etc/environment

{
    echo "${ORCHESTRATOR_CRON_SCHEDULE} root . /etc/environment; cd /app && python orchestrator.py >> /proc/1/fd/1 2>> /proc/1/fd/2"
    echo "${RETENTION_CRON_SCHEDULE} root . /etc/environment; cd /app && python delete_old_articles.py >> /proc/1/fd/1 2>> /proc/1/fd/2"
} > /etc/cron.d/pipeline-cron

chmod 0644 /etc/cron.d/pipeline-cron
crontab /etc/cron.d/pipeline-cron

exec cron -f
