import logging
import os
from pathlib import Path
from typing import Optional

import numpy as np
from sentence_transformers import SentenceTransformer

from config import config

logger = logging.getLogger(__name__)

# Module-level singleton – loaded once per process
_model: Optional[SentenceTransformer] = None

# Maximum characters sent to the encoder to avoid token overflow.
# all-MiniLM-L6-v2 has a 256-token limit; ~8 000 chars is a safe upper bound.
_MAX_CHARS = 8_000


def _candidate_hf_cache_roots() -> list[Path]:
    roots: list[Path] = []
    hf_home = os.getenv("HF_HOME")
    if hf_home:
        roots.append(Path(hf_home))

    roots.append(Path.home() / ".cache" / "huggingface")
    roots.append(Path.home() / "AppData" / "Local" / "huggingface")

    deduped: list[Path] = []
    for root in roots:
        if root not in deduped:
            deduped.append(root)
    return deduped


def _resolve_local_model_source(model_name: str) -> Path | None:
    explicit_path = os.getenv("EMBEDDING_MODEL_PATH")
    if explicit_path:
        path = Path(explicit_path)
        if path.exists():
            return path

    candidate_names = [model_name]
    if "/" not in model_name:
        candidate_names.append(f"sentence-transformers/{model_name}")

    for candidate_name in candidate_names:
        model_dir_name = candidate_name.replace("/", "--")
        for cache_root in _candidate_hf_cache_roots():
            snapshot_root = cache_root / "hub" / f"models--{model_dir_name}" / "snapshots"
            if not snapshot_root.is_dir():
                continue

            snapshots = sorted(
                (entry for entry in snapshot_root.iterdir() if entry.is_dir()),
                key=lambda entry: entry.stat().st_mtime,
                reverse=True,
            )
            if snapshots:
                return snapshots[0]

    local_path = Path(model_name)
    if local_path.is_dir():
        return local_path

    return None


def get_model() -> SentenceTransformer:
    """Return (and lazily load) the global SentenceTransformer instance."""
    global _model
    if _model is None:
        model_source = _resolve_local_model_source(config.embedding_model)
        if model_source is None:
            raise RuntimeError(
                "No cached embedding model found for "
                f"{config.embedding_model}. Set EMBEDDING_MODEL_PATH to a local "
                "snapshot directory or pre-populate the Hugging Face cache."
            )

        logger.info("Loading embedding model from local cache: %s", model_source)
        _model = SentenceTransformer(str(model_source), device="cpu")
        logger.info(
            "Embedding model loaded (dim=%d)", config.embedding_dim
        )
    return _model


def embed_text(text: str) -> list[float]:
    """
    Generate a normalised 384-dimensional embedding for a single string.

    Returns a plain Python list of floats suitable for JSON serialisation
    or direct insertion into pgvector.
    """
    model = get_model()
    truncated = text[:_MAX_CHARS]
    embedding: np.ndarray = model.encode(
        truncated, normalize_embeddings=True, show_progress_bar=False
    )
    return embedding.tolist()


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Batch-encode multiple strings and return a list of embedding vectors.

    More efficient than calling :func:`embed_text` in a loop when you have
    more than one document to encode.
    """
    model = get_model()
    truncated = [t[:_MAX_CHARS] for t in texts]
    embeddings: np.ndarray = model.encode(
        truncated, normalize_embeddings=True, show_progress_bar=False
    )
    return [e.tolist() for e in embeddings]
