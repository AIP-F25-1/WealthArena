import os
import glob
import hashlib
import sys

try:
    import chromadb
    from chromadb.utils import embedding_functions
except ImportError:
    print("[ERROR] chromadb not installed. Install with: pip install chromadb")
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(__file__))
KB_DIR = os.path.join(ROOT, "docs", "kb")
_default_db_dir = os.path.join(ROOT, "data", "vectorstore")
DB_DIR = os.getenv("CHROMA_PERSIST_DIR", _default_db_dir)
DB_DIR = os.path.abspath(DB_DIR)

os.makedirs(DB_DIR, exist_ok=True)

print(f"[INFO] KB Directory: {KB_DIR}")
print(f"[INFO] Vector Store Directory: {DB_DIR}")

try:
    client = chromadb.PersistentClient(path=DB_DIR)
    # Try to get existing collection first
    try:
        collection = client.get_collection(name="wealtharena_kb")
        print(f"[OK] Found existing KB collection")
    except Exception:
        # Collection doesn't exist, create it
        collection = client.create_collection(
            name="wealtharena_kb",
            embedding_function=embedding_functions.DefaultEmbeddingFunction()
        )
        print(f"[OK] Created new KB collection")
    print(f"[OK] ChromaDB client initialized")
except Exception as e:
    print(f"[ERROR] Failed to initialize ChromaDB: {e}")
    sys.exit(1)

docs, ids, metas = [], [], []
for path in sorted(glob.glob(os.path.join(KB_DIR, "*.md"))):
    with open(path, "r", encoding="utf-8") as f:
        text = f.read().strip()
    if not text:
        continue
    doc_id = hashlib.sha1(path.encode()).hexdigest()
    docs.append(text)
    ids.append(doc_id)
    metas.append({"path": os.path.relpath(path, ROOT)})

# Upsert
if docs:
    print(f"[INFO] Found {len(docs)} KB documents to process")
    # Remove duplicates by id first
    existing = set()
    try:
        existing_result = collection.get(ids=ids)
        if existing_result and "ids" in existing_result:
            existing = set(existing_result["ids"])
            print(f"[INFO] Found {len(existing)} existing documents in vector store")
        else:
            print("[INFO] No existing documents found, will add all")
    except Exception as check_err:
        # Collection might be corrupted, but we'll try to add anyway
        # The recovery logic will handle it if add() fails
        print(f"[WARN] Could not check existing documents: {check_err}")
        print("[INFO] Will attempt to add all documents (recovery will handle if needed)")
        existing = set()
    
    new_docs, new_ids, new_metas = [], [], []
    for d, i, m in zip(docs, ids, metas):
        if i not in existing:
            new_docs.append(d)
            new_ids.append(i)
            new_metas.append(m)
    
    if new_docs:
        try:
            collection.add(documents=new_docs, ids=new_ids, metadatas=new_metas)
            print(f"[OK] Ingested {len(new_docs)} new docs into vector DB.")
        except Exception as e:
            error_msg = str(e)
            print(f"[WARN] Failed to add documents to ChromaDB: {error_msg}")
            print(f"[INFO] Attempting to recover by recreating collection...")
            
            # Try to delete and recreate the collection
            try:
                # Delete the corrupted collection
                try:
                    client.delete_collection(name="wealtharena_kb")
                    print(f"[INFO] Deleted corrupted KB collection")
                except Exception as delete_err:
                    print(f"[WARN] Could not delete collection via API: {delete_err}")
                    print(f"[INFO] The collection may be locked or the database corrupted.")
                    print(f"[INFO] Attempting manual recovery...")
                    # Note: We don't delete the entire SQLite file as it contains other collections (PDF documents)
                    # Instead, we'll try to create a new collection with a different approach
                    print(f"[INFO] Trying to create collection with fresh client connection...")
                    # Close and recreate client
                    try:
                        del client
                        import gc
                        gc.collect()
                        # Small delay to ensure cleanup
                        import time
                        time.sleep(0.5)
                        client = chromadb.PersistentClient(path=DB_DIR)
                        # Try to delete again with fresh client
                        try:
                            client.delete_collection(name="wealtharena_kb")
                            print(f"[INFO] Successfully deleted collection with fresh client")
                        except Exception:
                            # If still can't delete, we'll try to create anyway (might overwrite)
                            print(f"[WARN] Could not delete collection, will attempt to create new one")
                    except Exception as client_err:
                        print(f"[ERROR] Could not recreate client: {client_err}")
                        raise
                
                # Recreate collection (use get_or_create in case it still exists)
                try:
                    collection = client.create_collection(
                        name="wealtharena_kb",
                        embedding_function=embedding_functions.DefaultEmbeddingFunction()
                    )
                    print(f"[OK] Created new KB collection")
                except Exception as create_err:
                    # Collection might still exist, try to get it
                    if "already exists" in str(create_err).lower() or "duplicate" in str(create_err).lower():
                        print(f"[INFO] Collection still exists, attempting to use it...")
                        try:
                            collection = client.get_collection(name="wealtharena_kb")
                            print(f"[OK] Retrieved existing KB collection")
                        except Exception as get_err:
                            print(f"[ERROR] Could not get or create collection: {get_err}")
                            raise
                    else:
                        raise
                
                # Retry adding documents
                try:
                    collection.add(documents=new_docs, ids=new_ids, metadatas=new_metas)
                    print(f"[OK] Successfully ingested {len(new_docs)} new docs after recovery.")
                except Exception as retry_err:
                    print(f"[ERROR] Failed to add documents after recovery: {retry_err}")
                    print(f"[INFO] This may indicate a deeper ChromaDB issue.")
                    print(f"[INFO] Try updating ChromaDB: pip install --upgrade chromadb")
                    sys.exit(1)
                    
            except Exception as recovery_err:
                print(f"[ERROR] Recovery failed: {recovery_err}")
                print(f"[INFO] Manual recovery steps:")
                print(f"[INFO]   1. Stop any running processes using the database")
                print(f"[INFO]   2. Delete: {DB_DIR}/chroma.sqlite3")
                print(f"[INFO]   3. Re-run this script")
                sys.exit(1)
    else:
        print("[OK] KB already up to date.")
    
    # Verify ingestion
    try:
        count = collection.count()
        print(f"[OK] Vector store now contains {count} documents")
    except Exception as e:
        print(f"[WARN] Could not verify document count: {e}")
else:
    print("[WARN] No KB docs found in docs/kb/ directory.")
    print(f"[INFO] Expected KB files in: {KB_DIR}")
