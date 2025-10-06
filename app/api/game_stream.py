"""
WealthArena Game WebSocket Streaming API
Real-time game streaming with play/pause/rewind controls
"""

import json
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
import yfinance as yf
import pandas as pd

from .game import game_states, historical_data_cache, _load_historical_data, _get_price_for_date, _save_game_state, DIFFICULTY_LEVELS

router = APIRouter()

# WebSocket connection management
active_connections: Dict[str, WebSocket] = {}
streaming_tasks: Dict[str, asyncio.Task] = {}

class StreamCommand(BaseModel):
    """WebSocket command schema"""
    cmd: str
    speed: Optional[int] = None
    days: Optional[int] = None

class StreamFrame(BaseModel):
    """Streaming frame schema"""
    date: str
    prices: Dict[str, float]
    equity: float
    cash: float
    total_value: float
    pnl: float
    holdings: list

class GameStreamManager:
    """Manages WebSocket streaming for a game"""
    
    def __init__(self, game_id: str, websocket: WebSocket):
        self.game_id = game_id
        self.websocket = websocket
        self.is_playing = False
        self.speed = 1
        self.task: Optional[asyncio.Task] = None
        
    async def start_streaming(self):
        """Start the streaming task"""
        if self.task and not self.task.done():
            return
            
        self.task = asyncio.create_task(self._stream_loop())
        
    async def stop_streaming(self):
        """Stop the streaming task"""
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
                
    async def _stream_loop(self):
        """Main streaming loop"""
        try:
            while True:
                if self.is_playing:
                    await self._send_frame()
                    await asyncio.sleep(1.0 / self.speed)  # Adjust speed
                else:
                    await asyncio.sleep(0.1)  # Small delay when paused
                    
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Streaming error for {self.game_id}: {e}")
            
    async def _send_frame(self):
        """Send a frame with current game state"""
        try:
            if self.game_id not in game_states:
                await self.websocket.send_json({
                    "error": "Game not found"
                })
                return
                
            game_state = game_states[self.game_id]
            
            # Get current prices for all symbols
            current_date = datetime.strptime(game_state["current_date"], "%Y-%m-%d")
            prices = {}
            
            # Get prices for common symbols
            symbols = ["SPY", "QQQ", "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "NFLX"]
            
            if self.game_id in historical_data_cache:
                historical_data = historical_data_cache[self.game_id]
                for symbol in symbols:
                    price = _get_price_for_date(historical_data, symbol, current_date)
                    if price is not None:
                        prices[symbol] = price
            
            # Calculate portfolio metrics
            portfolio = game_state["portfolio"]
            total_pnl = sum((holding["current_price"] - holding["avg_price"]) * holding["shares"] 
                           for holding in portfolio["holdings"])
            
            # Create frame
            frame = StreamFrame(
                date=game_state["current_date"],
                prices=prices,
                equity=portfolio["equity"],
                cash=portfolio["cash"],
                total_value=portfolio["total_value"],
                pnl=total_pnl,
                holdings=portfolio["holdings"]
            )
            
            await self.websocket.send_json(frame.dict())
            
        except Exception as e:
            print(f"Error sending frame for {self.game_id}: {e}")
            
    async def handle_command(self, command: StreamCommand):
        """Handle streaming commands"""
        if command.cmd == "play":
            self.is_playing = True
            self.speed = command.speed or 1
            await self.websocket.send_json({"status": "playing", "speed": self.speed})
            
        elif command.cmd == "pause":
            self.is_playing = False
            await self.websocket.send_json({"status": "paused"})
            
        elif command.cmd == "rewind":
            if self.game_id not in game_states:
                await self.websocket.send_json({"error": "Game not found"})
                return
                
            game_state = game_states[self.game_id]
            current_date = datetime.strptime(game_state["current_date"], "%Y-%m-%d")
            new_date = current_date - timedelta(days=command.days or 1)
            game_state["current_date"] = new_date.strftime("%Y-%m-%d")
            
            # Update portfolio prices
            if self.game_id in historical_data_cache:
                historical_data = historical_data_cache[self.game_id]
                for holding in game_state["portfolio"]["holdings"]:
                    new_price = _get_price_for_date(historical_data, holding["symbol"], new_date)
                    if new_price is not None:
                        holding["current_price"] = new_price
                        holding["value"] = new_price * holding["shares"]
                
                # Recalculate portfolio
                total_holdings_value = sum(holding["value"] for holding in game_state["portfolio"]["holdings"])
                game_state["portfolio"]["equity"] = game_state["portfolio"]["cash"] + total_holdings_value
                game_state["portfolio"]["total_value"] = game_state["portfolio"]["equity"]
            
            # Save state
            await _save_game_state(self.game_id, game_state)
            
            await self.websocket.send_json({
                "status": "rewound", 
                "new_date": game_state["current_date"]
            })

@router.websocket("/game/stream")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for game streaming"""
    await websocket.accept()
    
    try:
        # Get game_id from query params
        game_id = websocket.query_params.get("game_id")
        if not game_id:
            await websocket.send_json({"error": "game_id required"})
            await websocket.close()
            return
            
        if game_id not in game_states:
            await websocket.send_json({"error": "Game not found"})
            await websocket.close()
            return
        
        # Load historical data if not cached
        if game_id not in historical_data_cache:
            await _load_historical_data(game_id, game_states[game_id])
        
        # Create stream manager
        stream_manager = GameStreamManager(game_id, websocket)
        active_connections[game_id] = websocket
        
        # Start streaming
        await stream_manager.start_streaming()
        
        # Handle messages
        while True:
            try:
                data = await websocket.receive_text()
                command_data = json.loads(data)
                command = StreamCommand(**command_data)
                
                await stream_manager.handle_command(command)
                
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON"})
            except Exception as e:
                await websocket.send_json({"error": str(e)})
                
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for game {game_id}")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Cleanup
        if game_id in active_connections:
            del active_connections[game_id]
        if game_id in streaming_tasks:
            task = streaming_tasks[game_id]
            if not task.done():
                task.cancel()
            del streaming_tasks[game_id]

@router.get("/game/stream/status")
async def get_stream_status(game_id: str):
    """Get streaming status for a game"""
    if game_id not in active_connections:
        return {"status": "not_connected"}
    
    return {
        "status": "connected",
        "game_id": game_id,
        "active_connections": len(active_connections)
    }
