import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class Config:
    # DB
    database_url: str = os.getenv('DATABASE_URL', 'postgresql://openats:changeme@localhost:5432/openats')

    # Redis
    redis_host: str = os.getenv('REDIS_HOST', 'localhost')
    redis_port: int = int(os.getenv('REDIS_PORT', '6379'))

    # Queue
    queue_name: str = os.getenv('BULLMQ_QUEUE_NAME', 'resume-processing')
    concurrency: int = int(os.getenv('WORKER_CONCURRENCY', '2'))

    # vLLM / Ollama
    vllm_base_url: str = os.getenv('VLLM_BASE_URL', 'http://localhost:8000')
    vllm_model: str = os.getenv('VLLM_MODEL', 'llama3.2:3b')
    # The trimmed scoring schema (no evidence quotes, no cultural-fit prose,
    # capped list lengths) only needs a couple hundred tokens in practice —
    # keep the ceiling small so a run-on response can't drag out latency.
    vllm_max_tokens: int = int(os.getenv('VLLM_MAX_TOKENS', '800'))
    vllm_temperature: float = float(os.getenv('VLLM_TEMPERATURE', '0.1'))
    # A 3B model on local hardware answers in single-digit seconds even under
    # concurrent load (benchmarked: ~13s worst case at 8 concurrent requests).
    # Keep real margin over that without reviving the old 5-minute wait.
    vllm_timeout_seconds: float = float(os.getenv('VLLM_TIMEOUT_SECONDS', '60'))
    # Small models like llama3.2:3b handle several concurrent requests well
    # (Ollama batches them) — unlike the 8B model this replaced, which serialized
    # and blew past any reasonable timeout under load.
    vllm_max_concurrent_requests: int = int(os.getenv('VLLM_MAX_CONCURRENT_REQUESTS', '4'))

    # Profile extraction (JD-independent MD→JSON step) runs on a smaller model
    # than scoring — it's a mechanical transformation, not a judgment call.
    vllm_profile_model: str = os.getenv('VLLM_PROFILE_MODEL', 'qwen2.5-coder:1.5b')
    # Profiles include experience/education lists, so allow more headroom than
    # the trimmed scoring schema.
    vllm_profile_max_tokens: int = int(os.getenv('VLLM_PROFILE_MAX_TOKENS', '1200'))

    # Embeddings
    embedding_model: str = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
    embedding_dim: int = int(os.getenv('EMBEDDING_DIM', '384'))

    # Uploads
    upload_dir: str = os.getenv('UPLOAD_DIR', './uploads')


config = Config()
