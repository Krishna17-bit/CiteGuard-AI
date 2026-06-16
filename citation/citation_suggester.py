import re
from citation.duplicate_detector import get_words

def suggest_references_for_claim(claim: str, references: list[dict], limit: int = 3) -> list[dict]:
    """
    Scans library references and matches them to a claim text.
    Returns a sorted list of suggested references with similarity details.
    """
    claim = claim.strip()
    if not claim or not references:
        return []
        
    claim_words = get_words(claim)
    stopwords = {"the", "a", "of", "and", "to", "in", "is", "that", "we", "for", "with", "as", "an", "on", "are", "this", "by", "from", "at", "it"}
    keywords = claim_words - stopwords
    
    suggestions = []
    
    for ref in references:
        title = ref.get("title", "") or ""
        abstract = ref.get("abstract", "") or ""
        
        # Calculate matching terms
        title_words = get_words(title)
        abstract_words = get_words(abstract)
        
        title_matches = keywords.intersection(title_words)
        abstract_matches = keywords.intersection(abstract_words)
        
        # Calculate a weighted score
        # Keywords in title are weighted heavier than in abstract
        score = (len(title_matches) * 2.0) + (len(abstract_matches) * 0.5)
        
        if score > 0:
            shared_terms = list(title_matches.union(abstract_matches))[:4]
            reason = f"Shares relevant keywords: {', '.join(shared_terms)}"
            
            suggestions.append({
                "reference": ref,
                "score": score,
                "reason": reason
            })
            
    # Sort suggestions by score descending
    suggestions.sort(key=lambda x: x["score"], reverse=True)
    return suggestions[:limit]
