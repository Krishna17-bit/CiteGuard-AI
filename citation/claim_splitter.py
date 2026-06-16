import re

def split_text_into_claims(text: str) -> list[str]:
    """
    Splits input text into atomic sentences/claims.
    Handles academic abbreviations like 'e.g.', 'i.e.', 'et al.' gracefully.
    """
    if not text:
        return []
        
    # Standardize spaces
    text = re.sub(r'\s+', ' ', text).strip()
    
    # Simple regex splitting on punctuation followed by space
    # Lookbehind ensures we don't split on abbreviations
    # We define abbreviations that usually shouldn't end a sentence
    abbreviations = r"(?:e\.g\.|i\.e\.|et\s+al\.|vs\.|fig\.|tab\.|dr\.|prof\.|vol\.|no\.)"
    
    # Split sentences
    sentences = []
    # Split by periods, question marks, or exclamation marks that are followed by spaces
    raw_sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z0-9])', text)
    
    current_sentence = ""
    for s in raw_sentences:
        s = s.strip()
        if not s:
            continue
            
        # Re-attach if the split happened immediately after a known abbreviation
        check_text = (current_sentence + " " + s).strip() if current_sentence else s
        
        # Check if current sentence ends with an abbreviation
        ends_with_abbr = False
        for abbr in ["e.g.", "i.e.", "et al.", "vs.", "fig.", "tab.", "dr.", "prof.", "vol.", "no."]:
            if check_text.lower().endswith(abbr):
                ends_with_abbr = True
                break
                
        if ends_with_abbr:
            current_sentence = check_text
        else:
            if current_sentence:
                sentences.append(current_sentence)
                current_sentence = s
            else:
                current_sentence = s
                
    if current_sentence:
        sentences.append(current_sentence)
        
    # Further clean up and filter empty or extremely short sentences
    cleaned_claims = []
    for s in sentences:
        s = s.strip()
        if len(s) > 10:
            cleaned_claims.append(s)
            
    return cleaned_claims
