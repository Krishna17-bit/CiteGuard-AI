import re

def parse_ris(ris_content: str) -> list[dict]:
    """
    Parses RIS string content and returns a list of reference dictionaries.
    """
    entries = []
    current_entry = {}
    authors = []
    keywords = []
    
    # Split content by line and process
    lines = ris_content.splitlines()
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Match 'TAG  - VALUE' format (must have 2 spaces, dash, space or similar)
        match = re.match(r"^([A-Z0-9]{2})\s*-\s*(.*)$", line)
        if not match:
            continue
            
        tag = match.group(1)
        val = match.group(2).strip()
        
        if tag == "TY":
            # Start of a new reference
            current_entry = {"TY": val}
            authors = []
            keywords = []
        elif tag == "ER":
            # End of current reference
            if current_entry:
                current_entry["AU"] = authors
                current_entry["KW"] = keywords
                entries.append(map_ris_to_ref(current_entry))
                current_entry = {}
        else:
            if tag == "AU" or tag == "A1" or tag == "A2":
                authors.append(val)
            elif tag == "KW":
                keywords.append(val)
            elif tag in current_entry:
                # Append or override
                current_entry[tag] = val
            else:
                current_entry[tag] = val
                
    # If file did not end with ER but has content, parse last entry
    if current_entry:
        current_entry["AU"] = authors
        current_entry["KW"] = keywords
        entries.append(map_ris_to_ref(current_entry))
        
    return entries

def map_ris_to_ref(ris_dict: dict) -> dict:
    ty = ris_dict.get("TY", "GEN").upper()
    
    # Map types
    type_mapping = {
        "JOUR": "journal article",
        "CONF": "conference paper",
        "CHAP": "book chapter",
        "BOOK": "book",
        "THES": "thesis",
        "RPRT": "report",
        "ELEC": "website",
        "UNPB": "preprint",
        "DATA": "dataset",
        "COMP": "software",
        "GEN": "unknown"
    }
    source_type = type_mapping.get(ty, "unknown")
    
    # Parse authors
    author_list = ris_dict.get("AU", [])
    authors_str = ", ".join(author_list)
    
    # Parse year
    py = ris_dict.get("PY", ris_dict.get("Y1", ""))
    year = None
    if py:
        year_match = re.search(r"\d{4}", py)
        if year_match:
            year = int(year_match.group(0))
            
    # Parse pages
    sp = ris_dict.get("SP", "")
    ep = ris_dict.get("EP", "")
    pages = ""
    if sp and ep:
        pages = f"{sp}-{ep}"
    elif sp:
        pages = sp
        
    container = ris_dict.get("JO", ris_dict.get("JF", ris_dict.get("T2", "")))
    
    # Raw RIS reconstructed
    raw_lines = [f"TY  - {ty}"]
    for k, v in ris_dict.items():
        if k == "TY" or k == "AU" or k == "KW":
            continue
        raw_lines.append(f"{k}  - {v}")
    for au in author_list:
        raw_lines.append(f"AU  - {au}")
    for kw in ris_dict.get("KW", []):
        raw_lines.append(f"KW  - {kw}")
    raw_lines.append("ER  - ")
    raw_ris = "\n".join(raw_lines)
    
    return {
        "title": ris_dict.get("TI", ris_dict.get("T1", "")),
        "authors": authors_str,
        "year": year,
        "doi": ris_dict.get("DO", ""),
        "arxiv_id": "", # RIS rarely has specific arXiv tag, mapped to URL or note if needed
        "pubmed_id": ris_dict.get("AN", "") if ris_dict.get("DB", "") == "PubMed" else "",
        "url": ris_dict.get("UR", ris_dict.get("LK", "")),
        "source_type": source_type,
        "container_title": container,
        "journal": container if source_type == "journal article" else "",
        "conference": container if source_type == "conference paper" else "",
        "publisher": ris_dict.get("PB", ""),
        "volume": ris_dict.get("VL", ""),
        "issue": ris_dict.get("IS", ris_dict.get("CP", "")),
        "pages": pages,
        "edition": ris_dict.get("ET", ""),
        "isbn": ris_dict.get("SN", ""),
        "abstract": ris_dict.get("AB", ris_dict.get("N2", "")),
        "keywords": ", ".join(ris_dict.get("KW", [])),
        "metadata_source": "RIS Import",
        "raw_ris": raw_ris
    }
