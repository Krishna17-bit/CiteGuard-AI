import re

def parse_bibtex(bib_content: str) -> list[dict]:
    """
    Parses BibTeX string content and returns a list of reference dictionaries.
    """
    entries = []
    # Split content by '@' to separate potential entries
    raw_blocks = bib_content.split("@")
    
    for block in raw_blocks:
        block = block.strip()
        if not block:
            continue
            
        # Match type, cite key, and body
        # Format: entry_type{cite_key, body}
        match = re.match(r"^([a-zA-Z0-9_-]+)\s*\{\s*([a-zA-Z0-9_:.-]+)\s*,\s*(.*)$", block, re.DOTALL)
        if not match:
            continue
            
        entry_type = match.group(1).lower()
        cite_key = match.group(2)
        body = match.group(3)
        
        # We need to parse key-value pairs inside body
        # Simple stack-based parser to read till matching closing brace
        brace_count = 1
        closing_idx = -1
        for i, char in enumerate(body):
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    closing_idx = i
                    break
                    
        if closing_idx == -1:
            # Try parsing with quote count or take entire block if braces are slightly off
            closing_idx = len(body)
            
        entry_body = body[:closing_idx]
        
        # Parse fields from entry_body
        # Format: key = {value} or key = "value" or key = 2020
        fields = {}
        fields["source_type"] = map_bibtex_type(entry_type)
        fields["bibtex_key"] = cite_key
        
        # Find all field assignments
        # Regex looking for word_key followed by = and then either braced, quoted, or simple value
        field_matches = re.finditer(r"([a-zA-Z0-9_-]+)\s*=\s*(.*)", entry_body)
        
        # Let's parse fields sequentially
        # A simpler way is to split by commas that are outside braces/quotes
        # But a regex can find field boundaries
        # We can scan the string character by character to extract key-value assignments
        current_key = None
        current_val = []
        in_braces = 0
        in_quotes = False
        i = 0
        n = len(entry_body)
        
        while i < n:
            char = entry_body[i]
            if current_key is None:
                # Look for a key
                key_match = re.match(r"\s*([a-zA-Z0-9_-]+)\s*=", entry_body[i:])
                if key_match:
                    current_key = key_match.group(1).strip().lower()
                    i += key_match.end()
                    current_val = []
                    in_braces = 0
                    in_quotes = False
                    continue
                else:
                    i += 1
            else:
                # We are reading the value
                if char == '{' and not in_quotes:
                    in_braces += 1
                    current_val.append(char)
                elif char == '}' and not in_quotes:
                    in_braces -= 1
                    current_val.append(char)
                elif char == '"' and in_braces == 0:
                    in_quotes = not in_quotes
                    # we can keep quotes or skip them. Let's keep for cleanup later.
                    current_val.append(char)
                elif char == ',' and in_braces == 0 and not in_quotes:
                    # End of value
                    fields[current_key] = clean_field_value("".join(current_val))
                    current_key = None
                else:
                    current_val.append(char)
                i += 1
                
        if current_key:
            fields[current_key] = clean_field_value("".join(current_val))
            
        # Standardize field names for database schema
        std_ref = map_standard_fields(fields)
        # Store raw bibtex for restoration
        std_ref["raw_bibtex"] = f"@{entry_type}{{{cite_key},\n" + ",\n".join(f"  {k} = {{{v}}}" for k, v in fields.items() if k not in ["source_type", "bibtex_key"]) + "\n}"
        entries.append(std_ref)
        
    return entries

def clean_field_value(val: str) -> str:
    val = val.strip()
    # Remove surrounding braces or quotes
    if (val.startswith('{') and val.endswith('}')) or (val.startswith('"') and val.endswith('"')):
        val = val[1:-1].strip()
    # Remove any escaped braces inside like {T}he -> The
    val = val.replace("{", "").replace("}", "")
    # Clean double spaces or double dashes in page ranges
    val = re.sub(r'\s+', ' ', val)
    return val

def map_bibtex_type(btype: str) -> str:
    mapping = {
        "article": "journal article",
        "inproceedings": "conference paper",
        "conference": "conference paper",
        "book": "book",
        "incollection": "book chapter",
        "phdthesis": "thesis",
        "mastersthesis": "thesis",
        "thesis": "thesis",
        "techreport": "report",
        "report": "report",
        "misc": "unknown",
        "online": "website",
        "webpage": "website",
        "unpublished": "preprint",
        "dataset": "dataset",
        "software": "software"
    }
    return mapping.get(btype.lower(), "unknown")

def map_standard_fields(fields: dict) -> dict:
    # We map common BibTeX fields to our schema fields
    authors = fields.get("author", fields.get("editor", ""))
    # Format author list: strip braces, replace "and" with comma for standard author lists
    if authors:
        authors = authors.replace(" and ", ", ").strip()
        
    year_str = fields.get("year", "")
    year = None
    if year_str:
        # Extract digits
        digit_match = re.search(r"\d{4}", year_str)
        if digit_match:
            year = int(digit_match.group(0))
            
    pages = fields.get("pages", "")
    if pages:
        # standard pages notation: 45--67 -> 45-67
        pages = pages.replace("--", "-")
        
    return {
        "title": fields.get("title", ""),
        "authors": authors,
        "year": year,
        "doi": fields.get("doi", ""),
        "arxiv_id": fields.get("arxiv", fields.get("eprint", "")),
        "pubmed_id": fields.get("pmid", ""),
        "url": fields.get("url", ""),
        "source_type": fields.get("source_type", "unknown"),
        "container_title": fields.get("journal", fields.get("booktitle", fields.get("series", ""))),
        "journal": fields.get("journal", ""),
        "conference": fields.get("booktitle", "") if fields.get("source_type") == "conference paper" else "",
        "publisher": fields.get("publisher", fields.get("institution", fields.get("school", ""))),
        "volume": fields.get("volume", ""),
        "issue": fields.get("number", fields.get("issue", "")),
        "pages": pages,
        "edition": fields.get("edition", ""),
        "isbn": fields.get("isbn", ""),
        "abstract": fields.get("abstract", ""),
        "keywords": fields.get("keywords", ""),
        "metadata_source": "BibTeX Import",
        "raw_bibtex": ""
    }
