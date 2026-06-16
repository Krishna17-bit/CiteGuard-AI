import re
from citation.duplicate_detector import calculate_jaccard, extract_last_names

def audit_manuscript(text: str, library_references: list[dict], style_category: str = "author-date") -> dict:
    """
    Audits a manuscript text against a list of references in the project library.
    Returns:
    {
      "health_score": int,
      "issues": [
        {
          "issue_type": str,
          "severity": str,
          "message": str,
          "location": str,
          "suggested_fix": str
        }
      ],
      "in_text_citations": list[str],
      "detected_style": str
    }
    """
    issues = []
    
    # 1. Parse in-text citations
    # Look for numbered citations [1], [2, 3], [4-6]
    numbered_citations = re.findall(r"\[\d+(?:\s*,\s*\d+)*\]|\[\d+\s*-\s*\d+\]", text)
    # Look for author-year citations e.g. (Smith, 2020), (Smith & Doe, 2021), (Smith et al., 2022)
    # We look for: (CapitalizedWord, 4digits) or (CapitalizedWord & CapitalizedWord, 4digits) etc.
    author_year_citations = re.findall(r"\([A-Z][a-zA-Z\s]+(?:et\s+al\.)?\s*,\s*\d{4}\)|\([A-Z][a-zA-Z\s]+&\s+[A-Z][a-zA-Z\s]+,\s*\d{4}\)", text)
    
    # Detect style consistency
    num_count = len(numbered_citations)
    ay_count = len(author_year_citations)
    detected_style = "unknown"
    
    if num_count > 0 and ay_count > 0:
        detected_style = "mixed"
        issues.append({
            "issue_type": "mixed_styles",
            "severity": "high",
            "message": f"Mixed citation styles detected: {num_count} numbered citation(s) and {ay_count} author-year citation(s). Use a single, consistent style.",
            "location": "Global",
            "suggested_fix": "Choose either a numbered style (e.g. IEEE) or an author-year style (e.g. APA) and convert all citation brackets."
        })
    elif num_count > 0:
        detected_style = "numeric"
    elif ay_count > 0:
        detected_style = "author-date"
        
    # Match citations to library
    # Let's extract all numbers from numbered citations
    cited_indices = set()
    for citation in numbered_citations:
        # Extract digits
        digits = [int(d) for d in re.findall(r"\d+", citation)]
        # Handle ranges e.g. [4-6] -> 4, 5, 6
        if "-" in citation:
            sub_matches = re.findall(r"(\d+)\s*-\s*(\d+)", citation)
            for start, end in sub_matches:
                for i in range(int(start), int(end) + 1):
                    cited_indices.add(i)
        for d in digits:
            cited_indices.add(d)
            
    # Let's map in-text author-year citations
    # (Smith, 2020) -> author: Smith, year: 2020
    cited_author_years = []
    for citation in author_year_citations:
        match = re.search(r"\(([^,]+),\s*(\d{4})\)", citation)
        if match:
            author_part = match.group(1).replace("et al.", "").replace("&", ",").strip()
            year = int(match.group(2))
            # Get last names
            last_names = [n.strip().lower() for n in author_part.split(",") if n.strip()]
            cited_author_years.append({
                "raw": citation,
                "authors": last_names,
                "year": year
            })
            
    # Check library items matching citations
    # For author-year matching
    unmatched_in_text = []
    matched_library_ids = set()
    
    if detected_style == "author-date":
        for cay in cited_author_years:
            found = False
            for ref in library_references:
                ref_year = ref.get("year")
                if ref_year and int(ref_year) == cay["year"]:
                    ref_last_names = extract_last_names(ref.get("authors", ""))
                    # Check if any cited last name is in reference last names
                    overlap = set(cay["authors"]).intersection(set(ref_last_names))
                    if overlap:
                        found = True
                        matched_library_ids.add(ref.get("id"))
                        break
            if not found:
                unmatched_in_text.append(cay["raw"])
                
    elif detected_style == "numeric":
        # In numeric, we assume library references are indexed 1-based matching order
        # Wait, if library has 5 items, and user cited [6], it is missing.
        lib_len = len(library_references)
        for idx in cited_indices:
            if idx <= lib_len:
                matched_library_ids.add(library_references[idx - 1].get("id"))
            else:
                unmatched_in_text.append(f"[{idx}]")
                
    # 2. Identify missing references (cited in-text but not in library/bibliography)
    for unmatched in unmatched_in_text:
        issues.append({
            "issue_type": "missing_reference",
            "severity": "critical",
            "message": f"In-text citation '{unmatched}' was not found in the bibliography library.",
            "location": f"Manuscript text matches: '{unmatched}'",
            "suggested_fix": f"Add the corresponding reference for '{unmatched}' to the library."
        })
        
    # 3. Identify uncited bibliography items (in library but not cited in text)
    # Don't flag in mock/empty runs
    if text.strip() and (num_count > 0 or ay_count > 0):
        for ref in library_references:
            ref_id = ref.get("id")
            if ref_id not in matched_library_ids:
                issues.append({
                    "issue_type": "uncited_item",
                    "severity": "medium",
                    "reference_id": ref_id,
                    "message": f"Bibliography item '{ref.get('title')}' ({ref.get('year')}) is in the library but is never cited in the manuscript.",
                    "location": "Bibliography Library",
                    "suggested_fix": "Remove this item from the reference list or add an in-text citation marker where appropriate."
                })
                
    # 4. Check metadata quality of references
    for ref in library_references:
        ref_id = ref.get("id")
        title = ref.get("title", "")
        year = ref.get("year")
        doi = ref.get("doi")
        
        # Check basic properties
        missing_fields = []
        if not title: missing_fields.append("title")
        if not ref.get("authors"): missing_fields.append("authors")
        if not year: missing_fields.append("year")
        if not doi: missing_fields.append("DOI")
        
        if missing_fields:
            issues.append({
                "issue_type": "incomplete_reference",
                "severity": "low",
                "reference_id": ref_id,
                "message": f"Reference '{title[:40]}...' has incomplete metadata. Missing fields: {', '.join(missing_fields)}.",
                "location": f"Reference ID {ref_id}",
                "suggested_fix": "Use the Metadata Repair Center to look up and populate missing fields."
            })
            
        # Check suspicious year format
        if year and (int(year) < 1800 or int(year) > 2030):
            issues.append({
                "issue_type": "invalid_year",
                "severity": "medium",
                "reference_id": ref_id,
                "message": f"Reference '{title[:40]}...' has an invalid or suspicious publication year: '{year}'.",
                "location": f"Reference ID {ref_id}",
                "suggested_fix": "Manually correct the year field to a standard 4-digit academic calendar year."
            })
            
    # Calculate health score
    score = 100
    for issue in issues:
        severity = issue.get("severity")
        if severity == "critical":
            score -= 15
        elif severity == "high":
            score -= 10
        elif severity == "medium":
            score -= 5
        elif severity == "low":
            score -= 2
            
    score = max(0, min(100, score))
    
    # Return formatted results
    return {
        "health_score": score,
        "issues": issues,
        "in_text_citations": list(set(numbered_citations + author_year_citations)),
        "detected_style": detected_style
    }
