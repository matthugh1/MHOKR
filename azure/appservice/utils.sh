#!/bin/bash
# Utility commands for managing App Service deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/.env" 2>/dev/null || true

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

APP_NAME_PREFIX="${APP_NAME_PREFIX:-okr-nexus}"
RESOURCE_GROUP="${RESOURCE_GROUP:-vibe-code-test}"

SERVICES=("core-api" "ai-service" "integration-service" "api-gateway" "web")

show_help() {
    echo -e "${CYAN}Azure App Service Utility Commands${NC}"
    echo ""
    echo "Usage: $0 <command> [service]"
    echo ""
    echo "Commands:"
    echo "  status              Show status of all services"
    echo "  logs <service>      Stream logs for a service"
    echo "  ssh <service>       SSH into a service"
    echo "  restart <service>   Restart a service (or 'all')"
    echo "  stop <service>      Stop a service"
    echo "  start <service>     Start a service"
    echo "  urls                Show all service URLs"
    echo "  scale <service> <count>  Scale a service"
    echo ""
    echo "Services: ${SERVICES[*]}"
    echo ""
    echo "Examples:"
    echo "  $0 logs core-api"
    echo "  $0 restart all"
    echo "  $0 ssh web"
}

get_app_name() {
    echo "${APP_NAME_PREFIX}-$1"
}

cmd_status() {
    echo -e "${CYAN}Service Status:${NC}"
    echo ""
    printf "%-30s %-12s %-50s\n" "SERVICE" "STATE" "URL"
    echo "─────────────────────────────────────────────────────────────────────────────────────────"
    
    for service in "${SERVICES[@]}"; do
        local app_name=$(get_app_name "$service")
        local state=$(az webapp show --name "$app_name" --resource-group "$RESOURCE_GROUP" --query state -o tsv 2>/dev/null || echo "Not Found")
        local url=$(az webapp show --name "$app_name" --resource-group "$RESOURCE_GROUP" --query defaultHostName -o tsv 2>/dev/null || echo "-")
        
        if [ "$state" = "Running" ]; then
            state="${GREEN}Running${NC}"
        elif [ "$state" = "Stopped" ]; then
            state="${RED}Stopped${NC}"
        else
            state="${YELLOW}$state${NC}"
        fi
        
        printf "%-30s %-22b %-50s\n" "$app_name" "$state" "https://$url"
    done
}

cmd_logs() {
    local service=$1
    if [ -z "$service" ]; then
        echo -e "${RED}Error: Please specify a service${NC}"
        echo "Usage: $0 logs <service>"
        exit 1
    fi
    
    local app_name=$(get_app_name "$service")
    echo -e "${YELLOW}Streaming logs for $app_name (Ctrl+C to stop)...${NC}"
    az webapp log tail --name "$app_name" --resource-group "$RESOURCE_GROUP"
}

cmd_ssh() {
    local service=$1
    if [ -z "$service" ]; then
        echo -e "${RED}Error: Please specify a service${NC}"
        echo "Usage: $0 ssh <service>"
        exit 1
    fi
    
    local app_name=$(get_app_name "$service")
    echo -e "${YELLOW}Connecting to $app_name via SSH...${NC}"
    az webapp ssh --name "$app_name" --resource-group "$RESOURCE_GROUP"
}

cmd_restart() {
    local service=$1
    if [ -z "$service" ]; then
        echo -e "${RED}Error: Please specify a service or 'all'${NC}"
        exit 1
    fi
    
    if [ "$service" = "all" ]; then
        echo -e "${YELLOW}Restarting all services...${NC}"
        for s in "${SERVICES[@]}"; do
            local app_name=$(get_app_name "$s")
            echo "  Restarting $app_name..."
            az webapp restart --name "$app_name" --resource-group "$RESOURCE_GROUP" --output none 2>/dev/null || echo "  (skipped - not found)"
        done
        echo -e "${GREEN}✓ All services restarted${NC}"
    else
        local app_name=$(get_app_name "$service")
        echo -e "${YELLOW}Restarting $app_name...${NC}"
        az webapp restart --name "$app_name" --resource-group "$RESOURCE_GROUP"
        echo -e "${GREEN}✓ Restarted${NC}"
    fi
}

cmd_stop() {
    local service=$1
    local app_name=$(get_app_name "$service")
    echo -e "${YELLOW}Stopping $app_name...${NC}"
    az webapp stop --name "$app_name" --resource-group "$RESOURCE_GROUP"
    echo -e "${GREEN}✓ Stopped${NC}"
}

cmd_start() {
    local service=$1
    local app_name=$(get_app_name "$service")
    echo -e "${YELLOW}Starting $app_name...${NC}"
    az webapp start --name "$app_name" --resource-group "$RESOURCE_GROUP"
    echo -e "${GREEN}✓ Started${NC}"
}

cmd_urls() {
    echo -e "${CYAN}Service URLs:${NC}"
    echo ""
    for service in "${SERVICES[@]}"; do
        local app_name=$(get_app_name "$service")
        local url=$(az webapp show --name "$app_name" --resource-group "$RESOURCE_GROUP" --query defaultHostName -o tsv 2>/dev/null)
        if [ -n "$url" ]; then
            echo -e "  ${YELLOW}$service:${NC} https://$url"
        fi
    done
}

cmd_scale() {
    local service=$1
    local count=$2
    
    if [ -z "$service" ] || [ -z "$count" ]; then
        echo -e "${RED}Error: Please specify service and instance count${NC}"
        echo "Usage: $0 scale <service> <count>"
        exit 1
    fi
    
    local app_name=$(get_app_name "$service")
    echo -e "${YELLOW}Scaling $app_name to $count instances...${NC}"
    az webapp scale --name "$app_name" --resource-group "$RESOURCE_GROUP" --instance-count "$count"
    echo -e "${GREEN}✓ Scaled to $count instances${NC}"
}

# Main command handler
case "${1:-help}" in
    status)
        cmd_status
        ;;
    logs)
        cmd_logs "$2"
        ;;
    ssh)
        cmd_ssh "$2"
        ;;
    restart)
        cmd_restart "$2"
        ;;
    stop)
        cmd_stop "$2"
        ;;
    start)
        cmd_start "$2"
        ;;
    urls)
        cmd_urls
        ;;
    scale)
        cmd_scale "$2" "$3"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac




