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

    # vLLM
    vllm_base_url: str = os.getenv('VLLM_BASE_URL', 'http://localhost:8000')
    vllm_model: str = os.getenv('VLLM_MODEL', 'Qwen/Qwen3-8B')
    vllm_max_tokens: int = int(os.getenv('VLLM_MAX_TOKENS', '2048'))
    vllm_temperature: float = float(os.getenv('VLLM_TEMPERATURE', '0.1'))
    # Local inference (Ollama, single-GPU vLLM, etc.) can take well over a minute
    # per resume, especially for "thinking" models — a short client timeout makes
    # every scoring call fail outright rather than just running slow.
    vllm_timeout_seconds: float = float(os.getenv('VLLM_TIMEOUT_SECONDS', '300'))
    # Most local single-instance LLM servers process one request at a time; firing
    # several scoring calls at once just makes them queue up behind each other
    # until they blow past the timeout above. Cap how many run concurrently.
    vllm_max_concurrent_requests: int = int(os.getenv('VLLM_MAX_CONCURRENT_REQUESTS', '1'))

    # Embeddings
    embedding_model: str = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
    embedding_dim: int = int(os.getenv('EMBEDDING_DIM', '384'))

    # Uploads
    upload_dir: str = os.getenv('UPLOAD_DIR', './uploads')


config = Config()
