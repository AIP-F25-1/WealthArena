"""
Path utility functions for consistent path resolution across modules
"""

import os
from pathlib import Path


def get_vectorstore_path() -> str:
    """
    Get the default vectorstore path relative to project root.
    This function normalizes the path computation across all modules.
    
    Returns:
        Absolute path to the vectorstore directory
    """
    # Get project root (assuming this file is in app/utils/)
    # Go up from app/utils/ to project root
    project_root = Path(__file__).parent.parent.parent
    default_path = project_root / "data" / "vectorstore"
    
    # Use environment variable if set, otherwise use default
    db_dir = os.getenv("CHROMA_PERSIST_DIR", str(default_path))
    
    # Return absolute path
    return os.path.abspath(db_dir)

