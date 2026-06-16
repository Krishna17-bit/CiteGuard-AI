import re
from citation.bibtex_parser import parse_bibtex, map_bibtex_type

def clean_bibtex_content(bib_content: str) -> tuple[str, list[dict]]:
    """
    Cleans BibTeX content, normalizes fields, and detects syntax/data issues.
    Returns (cleaned_bibtex_string, list_of_warnings)
    """
    warnings = []
    
    # 1. Check brace mismatch across the whole file
    open_braces = bib_content.count('{')
    close_braces = bib_content.count('}')
    if open_braces != close_braces:
        warnings.append({
            "severity": "critical",
            "type": "braces_mismatch",
            "message": f"Mismatched braces detected: {open_braces} open braces and {close_braces} closing braces. This may break compilers."
        })
        
    # 2. Parse entries using our parser
    # We will also parse keys manually to detect duplicates
    raw_blocks = bib_content.split("@")
    seen_keys = {}
    cleaned_entries = []
    
    for block in raw_blocks:
        block = block.strip()
        if not block:
            continue
            
        # Match entry type and key
        match = re.match(r"^([a-zA-Z0-9_-]+)\s*\{\s*([a-zA-Z0-9_:.-]+)\s*,\s*(.*)$", block, re.DOTALL)
        if not match:
            # Check if it was a comment or preamble
            if block.lower().startswith("comment") or block.lower().startswith("preamble"):
                continue
            warnings.append({
                "severity": "low",
                "type": "unparsed_block",
                "message": f"Unable to parse block: '@{block[:50]}...'"
            })
            continue
            
        entry_type = match.group(1).lower()
        cite_key = match.group(2)
        body = match.group(3)
        
        # Check duplicate keys
        if cite_key in seen_keys:
            seen_keys[cite_key] += 1
            warnings.append({
                "severity": "high",
                "type": "duplicate_key",
                "key": cite_key,
                "message": f"Duplicate citation key found: '{cite_key}'. Latex will only resolve the first one."
            })
        else:
            seen_keys[cite_key] = 1
            
        # Parse fields manually for cleaning
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
            closing_idx = len(body)
            
        entry_body = body[:closing_idx]
        
        # Parse fields character-by-character
        fields = {}
        current_key = None
        current_val = []
        in_braces = 0
        in_quotes = False
        i = 0
        n = len(entry_body)
        
        while i < n:
            char = entry_body[i]
            if current_key is None:
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
                if char == '{' and not in_quotes:
                    in_braces += 1
                    current_val.append(char)
                elif char == '}' and not in_quotes:
                    in_braces -= 1
                    current_val.append(char)
                elif char == '"' and in_braces == 0:
                    in_quotes = not in_quotes
                    current_val.append(char)
                elif char == ',' and in_braces == 0 and not in_quotes:
                    fields[current_key] = "".join(current_val).strip()
                    current_key = None
                else:
                    current_val.append(char)
                i += 1
                
        if current_key:
            fields[current_key] = "".join(current_val).strip()
            
        # Clean and validate fields
        cleaned_fields = {}
        required_fields = get_required_fields(entry_type)
        missing_fields = []
        
        for k, v in fields.items():
            val = v
            # Strip outer brackets / quotes
            if (val.startswith('{') and val.endswith('}')) or (val.startswith('"') and val.endswith('"')):
                val = val[1:-1].strip()
                
            # Perform capitalization cleaning on title
            if k == "title":
                # Check for acronyms that should be wrapped in braces (AI, DNA, CNN)
                # But don't double wrap
                acronyms = ["AI", "DNA", "RNA", "CNN", "RNN", "NLP", "LLM", "GPT", "REST", "API", "HTML", "CSS", "JSON", "XML", "DOI", "RIS", "BibTeX", "FastAPI"]
                for acr in acronyms:
                    # Wrap acronym if it is a whole word and not already braced
                    val = re.sub(rf'\b({acr})\b', r'{\1}', val)
                    # Deduplicate double braces
                    val = val.replace(f"{{{acr}}}", f"{{{acr}}}")
                    val = val.replace(f"{{{{{acr}}}}}", f"{{{acr}}}")
                    
            if k == "author":
                # Normalize spaces and standard separators
                val = val.replace(" AND ", " and ").replace(" And ", " and ")
                
            cleaned_fields[k] = val
            
        # Check missing fields
        for rf in required_fields:
            if rf not in cleaned_fields or not cleaned_fields[rf]:
                missing_fields.append(rf)
                
        if missing_fields:
            warnings.append({
                "severity": "medium",
                "type": "missing_required_fields",
                "key": cite_key,
                "message": f"Reference '{cite_key}' ({entry_type}) is missing required field(s): {', '.join(missing_fields)}"
            })
            
        # Reconstruct clean BibTeX entry
        cleaned_block = f"@{entry_type}{{{cite_key},\n"
        field_lines = []
        for k, v in cleaned_fields.items():
            # Standard formatting: key = {Value}
            field_lines.append(f"  {k} = {{{v}}}")
        cleaned_block += ",\n".join(field_lines) + "\n}"
        cleaned_entries.append(cleaned_block)
        
    cleaned_bib = "\n\n".join(cleaned_entries)
    return cleaned_bib, warnings

def get_required_fields(entry_type: str) -> list[str]:
    entry_type = entry_type.lower()
    if entry_type == "article":
        return ["author", "title", "journal", "year"]
    elif entry_type in ["book", "inbook"]:
        return ["author", "title", "publisher", "year"]
    elif entry_type in ["inproceedings", "conference"]:
        return ["author", "title", "booktitle", "year"]
    elif entry_type in ["phdthesis", "mastersthesis"]:
        return ["author", "title", "school", "year"]
    elif entry_type in ["techreport", "report"]:
        return ["author", "title", "institution", "year"]
    elif entry_type in ["online", "webpage"]:
        return ["title", "url"]
    return ["title", "year"]
