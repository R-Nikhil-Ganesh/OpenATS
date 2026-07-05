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

    # Embeddings
    embedding_model: str = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
    embedding_dim: int = int(os.getenv('EMBEDDING_DIM', '384'))

    # Uploads
    upload_dir: str = os.getenv('UPLOAD_DIR', './uploads')


config = Config()
