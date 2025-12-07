"""
WealthArena Metrics Middleware
Middleware for metrics and monitoring
"""

import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Dict, Any

class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware for collecting metrics"""
    
    def __init__(self, app):
        super().__init__(app)
        self.metrics: Dict[str, Any] = {
            "requests_total": 0,
            "requests_by_endpoint": {},
            "response_times": [],
            "error_count": 0
        }
    
    async def dispatch(self, request: Request, call_next):
        """Process request and collect metrics"""
        start_time = time.time()
        
        # Increment total requests
        self.metrics["requests_total"] += 1
        
        # Track endpoint
        endpoint = request.url.path
        if endpoint not in self.metrics["requests_by_endpoint"]:
            self.metrics["requests_by_endpoint"][endpoint] = 0
        self.metrics["requests_by_endpoint"][endpoint] += 1
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate response time
            response_time = time.time() - start_time
            self.metrics["response_times"].append(response_time)
            
            # Keep only last 100 response times
            if len(self.metrics["response_times"]) > 100:
                self.metrics["response_times"] = self.metrics["response_times"][-100:]
            
            return response
            
        except Exception as e:
            # Track errors
            self.metrics["error_count"] += 1
            raise e
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics"""
        if self.metrics["response_times"]:
            avg_response_time = sum(self.metrics["response_times"]) / len(self.metrics["response_times"])
        else:
            avg_response_time = 0
        
        return {
            "requests_total": self.metrics["requests_total"],
            "requests_by_endpoint": self.metrics["requests_by_endpoint"],
            "error_count": self.metrics["error_count"],
            "average_response_time": round(avg_response_time, 3),
            "response_times_count": len(self.metrics["response_times"])
        }

