import os
import html

def validate_file_upload(filename: str, size_bytes: int, max_mb: int = 50) -> tuple[bool, str]:
    """
    Validates if the file matches format and size constraints.
    Returns (is_valid, error_message)
    """
    if size_bytes > max_mb * 1024 * 1024:
        return False, f"File size exceeds the maximum limit of {max_mb}MB."
        
    allowed_exts = {".pdf", ".bib", ".ris", ".xml", ".json", ".txt", ".tex", ".md", ".docx"}
    ext = os.path.splitext(filename.lower())[1]
    if ext not in allowed_exts:
        return False, f"Unsupported file type '{ext}'. Allowed types: {', '.join(allowed_exts)}"
        
    return True, ""

def mask_api_key(api_key: str) -> str:
    """
    Masks sensitive keys for secure UI and logs display.
    """
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "********"
    return api_key[:4] + "..." + api_key[-4:]

def sanitize_text(text: str) -> str:
    """
    Escapes HTML entities to prevent script injection in drafts.
    """
    if not text:
        return ""
    return html.escape(text)
