import re

def normalize_doi(doi: str) -> str:
    if not doi:
        return ""
    doi = doi.strip().lower()
    # Strip URL prefixes
    doi = doi.replace("https://doi.org/", "").replace("http://doi.org/", "")
    doi = doi.replace("doi.org/", "")
    return doi

def get_words(text: str) -> set[str]:
    if not text:
        return set()
    text = text.lower()
    # Strip punctuation
    text = re.sub(r'[^\w\s]', '', text)
    return set(text.split())

def calculate_jaccard(str1: str, str2: str) -> float:
    words1 = get_words(str1)
    words2 = get_words(str2)
    if not words1 or not words2:
        return 0.0
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    return len(intersection) / len(union)

def extract_last_names(authors: str) -> list[str]:
    if not authors:
        return []
    # Split by comma or "and"
    authors = authors.replace(" and ", ", ")
    parts = authors.split(",")
    last_names = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        # Standard BibTeX "Last, First" or "First Last"
        sub_parts = part.split()
        if not sub_parts:
            continue
        # If there is a comma, the last name is usually the first item: "Smith, John" -> "Smith"
        if "," in part:
            last_names.append(sub_parts[0].lower().replace(",", ""))
        else:
            # Otherwise, the last name is the last item: "John Smith" -> "smith"
            last_names.append(sub_parts[-1].lower())
    return last_names

def find_duplicates(references: list[dict]) -> list[dict]:
    """
    Scans a list of reference dictionaries and groups potential duplicates.
    Returns a list of duplicate group records:
    [
      {
        "confidence_score": 0.95,
        "reason": "Exact DOI match",
        "references": [ref1, ref2],
        "metadata_diffs": ["pages", "volume"] # Fields that differ
      }
    ]
    """
    duplicates_groups = []
    seen_ids = set()
    
    n = len(references)
    for i in range(n):
        ref1 = references[i]
        ref1_id = ref1.get("id")
        if ref1_id in seen_ids:
            continue
            
        group = []
        best_score = 0.0
        best_reason = ""
        
        for j in range(i + 1, n):
            ref2 = references[j]
            ref2_id = ref2.get("id")
            if ref2_id in seen_ids:
                continue
                
            is_dupe = False
            score = 0.0
            reason = ""
            
            # 1. DOI Exact match
            doi1 = normalize_doi(ref1.get("doi", ""))
            doi2 = normalize_doi(ref2.get("doi", ""))
            if doi1 and doi2 and doi1 == doi2:
                is_dupe = True
                score = 1.0
                reason = "Exact DOI match"
                
            # 2. arXiv ID Exact match
            arxiv1 = ref1.get("arxiv_id", "").strip().lower() if ref1.get("arxiv_id") else ""
            arxiv2 = ref2.get("arxiv_id", "").strip().lower() if ref2.get("arxiv_id") else ""
            if not is_dupe and arxiv1 and arxiv2 and arxiv1 == arxiv2:
                is_dupe = True
                score = 1.0
                reason = "Exact arXiv ID match"
                
            # 3. URL match
            url1 = ref1.get("url", "").strip().lower() if ref1.get("url") else ""
            url2 = ref2.get("url", "").strip().lower() if ref2.get("url") else ""
            if not is_dupe and url1 and url2 and url1 == url2:
                is_dupe = True
                score = 0.95
                reason = "Exact URL match"
                
            # 4. Title Fuzzy + Year + Author Overlap match
            title1 = ref1.get("title", "") or ""
            title2 = ref2.get("title", "") or ""
            title_sim = calculate_jaccard(title1, title2)
            
            if not is_dupe:
                if title_sim > 0.80:
                    is_dupe = True
                    score = title_sim
                    reason = f"High title similarity ({title_sim:.0%})"
                elif title_sim > 0.55:
                    # Check year and author last name overlap
                    year1 = ref1.get("year")
                    year2 = ref2.get("year")
                    
                    if year1 and year2 and year1 == year2:
                        ln1 = extract_last_names(ref1.get("authors", ""))
                        ln2 = extract_last_names(ref2.get("authors", ""))
                        
                        # Check if they share at least one author last name
                        shared = set(ln1).intersection(set(ln2))
                        if shared:
                            is_dupe = True
                            score = max(0.85, title_sim)
                            reason = f"Similar title ({title_sim:.0%}), matching year ({year1}), and author overlap"
                            
            if is_dupe:
                if not group:
                    group.append(ref1)
                    seen_ids.add(ref1_id)
                group.append(ref2)
                seen_ids.add(ref2_id)
                if score > best_score:
                    best_score = score
                    best_reason = reason
                    
        if group:
            # Identify metadata differences between duplicates
            diffs = []
            keys_to_compare = ["title", "authors", "year", "doi", "journal", "volume", "issue", "pages", "publisher"]
            first_ref = group[0]
            for key in keys_to_compare:
                val1 = str(first_ref.get(key, "") or "").strip().lower()
                for other_ref in group[1:]:
                    val2 = str(other_ref.get(key, "") or "").strip().lower()
                    if val1 != val2:
                        diffs.append(key)
                        break
                        
            duplicates_groups.append({
                "confidence_score": best_score,
                "reason": best_reason,
                "references": group,
                "metadata_diffs": list(set(diffs))
            })
            
    return duplicates_groups
