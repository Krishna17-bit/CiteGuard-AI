import os
import requests
import json
import re

def verify_claim_against_reference(claim: str, reference: dict, pdf_text: str = "", provider: str = "mock") -> dict:
    """
    Checks if the given reference abstract or PDF text supports the claim.
    Returns:
    {
      "status": 'Supported' | 'Partially Supported' | 'Unsupported' | 'Citation Mismatch',
      "evidence_text": str,
      "confidence_score": float,
      "explanation": str
    }
    """
    claim = claim.strip()
    ref_title = reference.get("title", "")
    ref_abstract = reference.get("abstract", "")
    
    # Combined context for verification
    source_context = f"Title: {ref_title}\nAbstract: {ref_abstract}"
    if pdf_text:
        source_context += f"\nFull PDF Context:\n{pdf_text[:4000]}" # Cap at 4k chars to avoid LLM tokens limit
        
    mock_mode = os.getenv("MOCK_MODE", "true").lower() == "true" or provider == "mock"
    
    if mock_mode:
        return get_mock_verification_result(claim, reference)
        
    # Real LLM call
    llm_provider = os.getenv("LLM_PROVIDER", "gemini").lower()
    
    prompt = f"""
    You are an academic citation auditing assistant.
    Determine whether the reference text supports the written claim.
    
    CLAIM:
    "{claim}"
    
    REFERENCE INFORMATION:
    {source_context}
    
    Classify the support status into one of these exact values:
    - "Supported" (the reference text directly proves or states the claim)
    - "Partially Supported" (the reference text is related and supports aspects of the claim, but not fully or is weaker evidence)
    - "Unsupported" (the reference text does not support the claim or contradicts it)
    - "Citation Mismatch" (the reference is completely unrelated to the claim topic)
    
    Format your response as a valid JSON object with the following fields:
    - "status": The exact status string (one of the four above)
    - "evidence": A direct, short quote or snippet from the reference text that supports/refutes the claim (leave blank if unsupported/mismatched)
    - "confidence": A float score between 0.0 and 1.0 representing your classification confidence
    - "explanation": A 1-2 sentence academic explanation for this classification
    """
    
    try:
        if llm_provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY")
            model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            if not api_key:
                return {"status": "Unsupported", "evidence_text": "", "confidence_score": 0.0, "explanation": "Gemini API key is missing. Reverted to Mock."}
                
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json"}
            }
            r = requests.post(url, headers=headers, json=payload, timeout=10)
            if r.status_code == 200:
                res_data = r.json()
                text_response = res_data["candidates"][0]["content"]["parts"][0]["text"]
                # Parse JSON
                parsed = json.loads(text_response)
                return {
                    "status": parsed.get("status", "Unsupported"),
                    "evidence_text": parsed.get("evidence", ""),
                    "confidence_score": float(parsed.get("confidence", 0.5)),
                    "explanation": parsed.get("explanation", "")
                }
                
        elif llm_provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            if not api_key:
                return {"status": "Unsupported", "evidence_text": "", "confidence_score": 0.0, "explanation": "OpenAI API key is missing."}
                
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": model,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "response_format": {"type": "json_object"}
            }
            r = requests.post(url, headers=headers, json=payload, timeout=10)
            if r.status_code == 200:
                res_data = r.json()
                text_response = res_data["choices"][0]["message"]["content"]
                parsed = json.loads(text_response)
                return {
                    "status": parsed.get("status", "Unsupported"),
                    "evidence_text": parsed.get("evidence", ""),
                    "confidence_score": float(parsed.get("confidence", 0.5)),
                    "explanation": parsed.get("explanation", "")
                }
                
        # Other LLM providers can fall back to standard OpenAI chat endpoint formats
        # Ollama / custom OpenAI etc
        elif llm_provider in ["anthropic", "groq", "mistral", "ollama", "custom_openai"]:
            # Standard custom OpenAI compatible or fallback mock
            base_url = os.getenv("CUSTOM_OPENAI_BASE_URL", "http://localhost:11434/v1" if llm_provider == "ollama" else "")
            api_key = os.getenv("CUSTOM_OPENAI_API_KEY", "")
            model = os.getenv("OLLAMA_MODEL", "llama3.1") if llm_provider == "ollama" else os.getenv("CUSTOM_OPENAI_MODEL", "")
            
            if base_url:
                url = f"{base_url}/chat/completions"
                headers = {"Content-Type": "application/json"}
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"
                payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}]
                }
                r = requests.post(url, headers=headers, json=payload, timeout=10)
                if r.status_code == 200:
                    res_data = r.json()
                    text_response = res_data["choices"][0]["message"]["content"]
                    parsed = json.loads(text_response)
                    return {
                        "status": parsed.get("status", "Unsupported"),
                        "evidence_text": parsed.get("evidence", ""),
                        "confidence_score": float(parsed.get("confidence", 0.5)),
                        "explanation": parsed.get("explanation", "")
                    }
                    
    except Exception as e:
        # Graceful fallback on network/parsing failure
        return {
            "status": "Partially Supported",
            "evidence_text": f"Fallback verification triggered. Error in API call: {str(e)}",
            "confidence_score": 0.4,
            "explanation": "Could not complete LLM provider network call, returned safe fallback rating."
        }
        
    # Ultimate fallback to mock
    return get_mock_verification_result(claim, reference)

# --- Mock Verification Engine ---

def get_mock_verification_result(claim: str, reference: dict) -> dict:
    """
    Computes a mock verification status based on simple keyword matches between the claim and the reference.
    """
    claim_lower = claim.lower()
    title = (reference.get("title", "") or "").lower()
    abstract = (reference.get("abstract", "") or "").lower()
    
    # 1. Check if the reference matches the topic
    # e.g., if database refactoring matches refactoring claim
    if "refactor" in claim_lower and "refactor" in title:
        return {
            "status": "Supported",
            "evidence_text": "This work explores how database schemas can be iteratively evolved using refactoring patterns while keeping data consistent.",
            "confidence_score": 0.95,
            "explanation": "The reference directly focuses on database refactoring, supporting evolutionary schema design claims."
        }
        
    if ("citeguard" in claim_lower or "citation" in claim_lower) and "citeguard" in title:
        return {
            "status": "Supported",
            "evidence_text": "We introduce CiteGuard, a tool designed to verify claims and clean up wrong reference metadata.",
            "confidence_score": 0.98,
            "explanation": "The reference is the core system design paper introducing CiteGuard citation intelligence platforms."
        }

    if "gpt-4" in claim_lower and "gpt-4" in title:
        return {
            "status": "Supported",
            "evidence_text": "We report on the development of GPT-4, a large-scale multimodal model capable of processing image and text inputs.",
            "confidence_score": 0.92,
            "explanation": "The technical report outlines GPT-4's parameters, training, and multimodal outputs."
        }
        
    # Check for keywords overlap
    claim_words = set(re.findall(r'\w+', claim_lower))
    abstract_words = set(re.findall(r'\w+', abstract))
    overlap = claim_words.intersection(abstract_words)
    
    # Clean out very common stopwords
    stopwords = {"the", "a", "of", "and", "to", "in", "is", "that", "we", "for", "with", "as", "an", "on", "are"}
    overlap_cleaned = overlap - stopwords
    
    if len(overlap_cleaned) >= 4:
        # Find a matching sentence in the abstract if possible
        matched_snippet = ""
        sentences = abstract.split(". ")
        for s in sentences:
            s_words = set(re.findall(r'\w+', s))
            if len(s_words.intersection(overlap_cleaned)) >= 2:
                matched_snippet = s.strip().capitalize()
                if not matched_snippet.endswith("."):
                    matched_snippet += "."
                break
        if not matched_snippet:
            matched_snippet = (reference.get("abstract", "")[:150] + "...") if reference.get("abstract") else "Abstract context matches title terms."
            
        return {
            "status": "Partially Supported",
            "evidence_text": matched_snippet,
            "confidence_score": 0.70,
            "explanation": f"The reference text mentions related terms: {', '.join(list(overlap_cleaned)[:4])}, but does not explicitly confirm all factual metrics of the claim."
        }
        
    # Unrelated
    return {
        "status": "Citation Mismatch",
        "evidence_text": "",
        "confidence_score": 0.85,
        "explanation": "The reference does not share relevant keywords with this claim and appears to cover an unrelated research topic."
    }
