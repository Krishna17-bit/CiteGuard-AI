import re
import os
from pypdf import PdfReader

def extract_pdf_info(file_path: str) -> dict:
    """
    Reads a PDF file and returns its metadata, page count, and text.
    Also detects if it is image-only/scanned.
    """
    result = {
        "title": "",
        "authors": "",
        "year": None,
        "doi": "",
        "arxiv_id": "",
        "page_count": 0,
        "scanned_detected": False,
        "text_pages": [],
        "text_extracted": False
    }
    
    if not os.path.exists(file_path):
        return result
        
    try:
        reader = PdfReader(file_path)
        result["page_count"] = len(reader.pages)
        
        # Read standard PDF metadata
        meta = reader.metadata
        if meta:
            result["title"] = meta.title if meta.title else ""
            result["authors"] = meta.author if meta.author else ""
            
        # Extract text page by page
        text_pages = []
        total_text_len = 0
        for page in reader.pages:
            try:
                page_text = page.extract_text() or ""
                text_pages.append(page_text)
                total_text_len += len(page_text.strip())
            except Exception:
                text_pages.append("")
                
        result["text_pages"] = text_pages
        result["text_extracted"] = len(text_pages) > 0 and total_text_len > 0
        
        # Detect if it appears scanned
        # If page count is > 0 and average text length per page is very low (< 120 chars)
        if result["page_count"] > 0:
            avg_len = total_text_len / result["page_count"]
            if avg_len < 120:
                result["scanned_detected"] = True
                
        # Attempt to find DOI and arXiv ID inside text pages (specifically first 2 pages)
        first_pages_text = "\n".join(text_pages[:2])
        
        # Extract DOI pattern: 10.\d{4,9}/[-._;()/:A-Z0-9]+
        doi_match = re.search(r"\b(10\.\d{4,9}/[-._;()/:a-zA-Z0-9]+)", first_pages_text)
        if doi_match:
            result["doi"] = doi_match.group(1).rstrip('.')
            
        # Extract arXiv pattern: arXiv:\d{4}\.\d{4,5} or eprint arXiv:arXiv:\d{4}\.\d{4,5}
        arxiv_match = re.search(r"\barXiv:\s*(\d{4}\.\d{4,5}(?:v\d+)?)", first_pages_text, re.IGNORECASE)
        if arxiv_match:
            result["arxiv_id"] = arxiv_match.group(1)
            
        # If PDF title is empty, guess it from the first few lines of the text (ignoring short lines/numbers)
        if not result["title"] and len(text_pages) > 0:
            first_page = text_pages[0].strip()
            lines = [l.strip() for l in first_page.split("\n") if l.strip()]
            for line in lines[:5]:
                if len(line) > 15 and not line.lower().startswith("issn") and not line.lower().startswith("doi"):
                    result["title"] = line
                    break
                    
    except Exception as e:
        print(f"Error parsing PDF file: {e}")
        result["scanned_detected"] = True
        
    return result
