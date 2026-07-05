import logging
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


def get_model() -> SentenceTransformer:
    """Return (and lazily load) the global SentenceTransformer instance."""
    global _model
    if _model is None:
        logger.info("Loading embedding model: %s", config.embedding_model)
        _model = SentenceTransformer(config.embedding_model, device="cpu")
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
