#!/bin/bash
# Stop all DockLite services

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Stopping DockLite services...${NC}"

# Kill by PID files if they exist
if [ -f ".docklite-gui.pid" ]; then
    GUI_PID=$(cat .docklite-gui.pid)
    if kill -0 $GUI_PID 2>/dev/null; then
        echo "Stopping GUI (PID: $GUI_PID)"
        kill $GUI_PID
    fi
    rm -f .docklite-gui.pid
fi

if [ -f ".docklite-agent.pid" ]; then
    AGENT_PID=$(cat .docklite-agent.pid)
    if kill -0 $AGENT_PID 2>/dev/null; then
        echo "Stopping Agent (PID: $AGENT_PID)"
        kill $AGENT_PID
    fi
    rm -f .docklite-agent.pid
fi

# Also kill by process name as backup
pkill -f "docklite-agent" 2>/dev/null && echo "Killed docklite-agent processes"
pkill -f "next.*webapp" 2>/dev/null && echo "Killed Next.js processes"

echo -e "${GREEN}All services stopped${NC}"
