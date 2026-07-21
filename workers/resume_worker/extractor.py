import hashlib
import logging
from pathlib import Path
from typing import Any

import pymupdf
import pymupdf4llm

logger = logging.getLogger(__name__)


def extract_pdf_to_markdown(pdf_path: str) -> dict[str, Any]:
    """
    Extract a PDF file to Markdown using PyMuPDF4LLM.

    Returns a dict with:
        - ``markdown``            – full document as a single Markdown string
        - ``content_hash``        – SHA-256 hex digest of the raw PDF bytes
        - ``extraction_metadata`` – page/word counts and PDF metadata fields
    """
    path = Path(pdf_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    # Extract with page_chunks=True to get per-page metadata
    chunks: list[dict] = pymupdf4llm.to_markdown(
        str(path),
        page_chunks=True,
        show_toc=False,
        margins=(0, 0, 0, 0),
    )

    # Combine all chunks into one Markdown document
    full_markdown: str = "\n\n".join(
        chunk["text"] for chunk in chunks if chunk.get("text", "").strip()
    )

    # SHA-256 of the raw PDF bytes (used for de-duplication)
    with open(pdf_path, "rb") as fh:
        content_hash = hashlib.sha256(fh.read()).hexdigest()

    # Pull standard PDF metadata, plus hyperlink annotations.
    #
    # pymupdf4llm only turns a hyperlink into `[text](url)` markdown when the
    # visible text sufficiently overlaps the link's clickable area — an
    # icon-only "GitHub"/"LinkedIn" link, or a loosely-placed label, gets
    # silently dropped and the URL never appears anywhere in the extracted
    # text. Walk the PDF's link annotations directly so those URLs are never
    # lost, appending them as bare URLs (not `[text](url)`) so they also
    # survive normalizer.py's markdown-link stripping and reach the profiler.
    doc = pymupdf.open(pdf_path)
    pdf_metadata = doc.metadata or {}
    seen_links: set[str] = set()
    hyperlinks: list[str] = []
    for page in doc:
        for link in page.get_links():
            uri = link.get("uri")
            if link.get("kind") == pymupdf.LINK_URI and uri and uri not in seen_links:
                seen_links.add(uri)
                hyperlinks.append(uri)
    doc.close()

    if hyperlinks:
        full_markdown += "\n\n## Linked URLs\n" + "\n".join(hyperlinks)

    extraction_metadata: dict[str, Any] = {
        "page_count": len(chunks),
        "chunk_count": len(chunks),
        "pdf_title": pdf_metadata.get("title", ""),
        "pdf_author": pdf_metadata.get("author", ""),
        "word_count": len(full_markdown.split()),
        "char_count": len(full_markdown),
    }

    logger.info(
        "Extracted %d pages from %s (%d chars)",
        len(chunks),
        path.name,
        len(full_markdown),
    )

    return {
        "markdown": full_markdown,
        "content_hash": content_hash,
        "extraction_metadata": extraction_metadata,
    }
