import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Optional

# Use shared path helper for consistent path resolution
from ..utils.paths import get_vectorstore_path
DB_DIR = get_vectorstore_path()

# Lazy import and initialization
_client = None
_collection = None
_collections_cache = {}

def _get_client():
    """Lazy initialization of ChromaDB client"""
    global _client, _collection
    if _client is None:
        try:
            import chromadb
            from chromadb.utils import embedding_functions
            # Ensure directory exists (lazy creation - only when ChromaDB is first used)
            os.makedirs(DB_DIR, exist_ok=True)
            _client = chromadb.PersistentClient(path=DB_DIR)
            _collection = _client.get_or_create_collection(
                name="wealtharena_kb",
                embedding_function=embedding_functions.DefaultEmbeddingFunction()
            )
        except ImportError:
            print("[KB] chromadb unavailable; continuing without KB.")
            _client = None
            _collection = None
        except Exception as e:
            print(f"[KB] chromadb unavailable; continuing without KB. Error: {e}")
            _client = None
            _collection = None
    return _client, _collection

def _get_collection(collection_name: str):
    """Get or create a collection by name"""
    global _collections_cache
    if collection_name in _collections_cache:
        return _collections_cache[collection_name]
    
    client, _ = _get_client()
    if client is None:
        return None
    
    try:
        import chromadb
        from chromadb.utils import embedding_functions
        collection = client.get_or_create_collection(
            name=collection_name,
            embedding_function=embedding_functions.DefaultEmbeddingFunction()
        )
        _collections_cache[collection_name] = collection
        return collection
    except Exception as e:
        print(f"[KB] Failed to get collection {collection_name}: {e}")
        return None

def search_kb(query: str, k: int = 3) -> List[Dict]:
    """Search knowledge base with graceful fallback if ChromaDB unavailable"""
    if not query.strip():
        return []
    
    client, collection = _get_client()
    if client is None or collection is None:
        return []
    
    try:
        res = collection.query(query_texts=[query], n_results=k)
        out = []
        for i in range(len(res["ids"][0])):
            distance = float(res.get("distances", [[0]])[0][i]) if "distances" in res else 0.0
            # Convert distance to similarity score (1.0 - distance for cosine)
            score = 1.0 - distance if distance <= 1.0 else 0.0
            meta = res["metadatas"][0][i] if res.get("metadatas") and res["metadatas"][0] else {}
            meta["collection_type"] = "kb"
            out.append({
                "id": res["ids"][0][i],
                "text": res["documents"][0][i],
                "meta": meta,
                "score": score
            })
        return out
    except Exception as e:
        print(f"[KB] chromadb unavailable; continuing without KB. Error: {e}")
        return []

def _search_collection(collection_name: str, query: str, k: int) -> List[Dict]:
    """Search a single collection"""
    collection = _get_collection(collection_name)
    if collection is None:
        return []
    
    try:
        res = collection.query(query_texts=[query], n_results=k)
        out = []
        if res.get("ids") and res["ids"][0]:
            for i in range(len(res["ids"][0])):
                distance = float(res.get("distances", [[0]])[0][i]) if "distances" in res else 0.0
                score = 1.0 - distance if distance <= 1.0 else 0.0
                meta = res["metadatas"][0][i] if res.get("metadatas") and res["metadatas"][0] else {}
                meta["collection_type"] = collection_name
                out.append({
                    "id": res["ids"][0][i],
                    "text": res["documents"][0][i],
                    "meta": meta,
                    "score": score
                })
        return out
    except Exception as e:
        print(f"[KB] Error searching collection {collection_name}: {e}")
        return []

def _merge_results(all_results: List[List[Dict]], k: int) -> List[Dict]:
    """Merge and deduplicate results from multiple collections"""
    # Flatten all results
    flat_results = []
    seen_ids = set()
    
    for results in all_results:
        for result in results:
            result_id = result.get("id")
            if result_id and result_id not in seen_ids:
                seen_ids.add(result_id)
                flat_results.append(result)
    
    # Sort by score (descending)
    flat_results.sort(key=lambda x: x.get("score", 0.0), reverse=True)
    
    # Return top k
    return flat_results[:k]

async def search_all_collections(
    query: str,
    k: int = 3,
    collections: Optional[List[str]] = None
) -> List[Dict]:
    """
    Search across multiple collections in parallel
    
    Args:
        query: Search query
        k: Number of results to return per collection (total may be less after merging)
        collections: List of collection names to search. If None, searches all collections.
    
    Returns:
        List of results merged from all collections, sorted by relevance
    """
    if not query.strip():
        return []
    
    # Default collections if not specified - only PDF documents
    if collections is None:
        collections = ["pdf_documents"]
    
    # Search all collections in parallel using ThreadPoolExecutor
    # ChromaDB operations are blocking, so we run them in threads
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor(max_workers=len(collections)) as executor:
        tasks = [
            loop.run_in_executor(executor, _search_collection, collection_name, query, k)
            for collection_name in collections
        ]
        all_results = await asyncio.gather(*tasks)
    
    # Merge and return top k results
    merged = _merge_results(all_results, k)
    return merged