#!/bin/bash

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Load .env
set -a
source /opt/alerts/.env
set +a

# Fallbacks
STATE_DIR=${STATE_DIR:-/opt/alerts}
HOSTNAME=${ALERT_HOSTNAME:-$(hostname)}

SERVICES_TO_CHECK=$(echo "$SERVICES" | tr ',' ' ')
AUTO_RESTART_LIST=$(echo "$AUTO_RESTART_SERVICES" | tr ',' ' ')

mkdir -p "$STATE_DIR"

send_slack_alert() {
    local alert_type="$1"
    local service_name="$2"
    local host_name="$3"
    local status_msg="$4"

    local title=""
    local color=""

    if [ "$alert_type" == "DOWN" ]; then
        title="SERVICE DOWN"
        color="danger"
    elif [ "$alert_type" == "UP" ]; then
        title="SERVICE UP"
        color="good"
    else
        title="SERVICE INFO"
        color="#439FE0"
    fi

    payload=$(cat <<EOF
{
  "attachments": [
    {
      "color": "$color",
      "blocks": [
        {
          "type": "header",
          "text": {
            "type": "plain_text",
            "text": "$title"
          }
        },
        {
          "type": "section",
          "fields": [
            { "type": "mrkdwn", "text": "*Service:*\n\`$service_name\`" },
            { "type": "mrkdwn", "text": "*Host:*\n\`$host_name\`" }
          ]
        },
        {
          "type": "section",
          "text": { "type": "mrkdwn", "text": "*Status:*\n$status_msg" }
        }
      ]
    }
  ]
}
EOF
)

    curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" "$SLACK_WEBHOOK_URL" > /dev/null
}

is_in_autorestart_list() {
    for s in $AUTO_RESTART_LIST; do
        if [ "$s" == "$1" ]; then
            return 0
        fi
    done
    return 1
}

for service in $SERVICES_TO_CHECK; do
    STATE_FILE="$STATE_DIR/${service}.down"

    if systemctl is-active --quiet "$service"; then
        # --- SERVICE OK ---
        if [ -f "$STATE_FILE" ]; then
            echo "INFO: $service recovered"
            send_slack_alert "UP" "$service" "$HOSTNAME" "is back online"
            rm "$STATE_FILE"
        fi

    else
        # --- SERVICE DOWN ---
        if [ ! -f "$STATE_FILE" ]; then
            status=$(systemctl is-failed "$service" 2>/dev/null)

            if is_in_autorestart_list "$service"; then
                echo "CRITICAL: $service is $status, attempting restart..."

                systemctl restart "$service"
                sleep 3

                if systemctl is-active --quiet "$service"; then
                    echo "RECOVERED: $service restarted successfully"

                    send_slack_alert "UP" "$service" "$HOSTNAME" \
                        "was down (*${status}*) but restarted successfully"

                    continue
                else
                    echo "FAILED: $service restart failed"

                    send_slack_alert "DOWN" "$service" "$HOSTNAME" \
                        "is in state *${status}* and restart failed"

                    touch "$STATE_FILE"
                fi
            else
                echo "CRITICAL: $service is $status"

                send_slack_alert "DOWN" "$service" "$HOSTNAME" \
                    "is in state *${status}*"

                touch "$STATE_FILE"
            fi
        fi
    fi
done