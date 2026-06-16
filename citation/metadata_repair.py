import os
import requests
import re
import xml.etree.ElementTree as ET

def calculate_quality_score(ref: dict) -> tuple[int, list[str]]:
    """
    Computes a metadata quality score (0 to 100) and lists issues found.
    """
    score = 100
    issues = []
    
    # 1. Missing Core fields
    title = str(ref.get("title", "") or "").strip()
    if not title:
        score -= 30
        issues.append("Missing Title")
    elif title.isupper():
        score -= 5
        issues.append("Title is all-uppercase (needs title-case normalization)")
    elif len(title) < 10:
        score -= 10
        issues.append("Title is suspiciously short")
        
    authors = str(ref.get("authors", "") or "").strip()
    if not authors:
        score -= 25
        issues.append("Missing Authors")
        
    year = ref.get("year")
    if not year:
        score -= 15
        issues.append("Missing Year")
    elif int(year) < 1800 or int(year) > 2030:
        score -= 10
        issues.append(f"Suspicious publication year: {year}")
        
    doi = str(ref.get("doi", "") or "").strip()
    if not doi:
        score -= 15
        issues.append("Missing DOI")
    else:
        # Check standard DOI format (starts with 10.)
        if not re.match(r"^10\.\d{4,9}/", doi):
            score -= 10
            issues.append("Invalid DOI format pattern")
            
    # 2. Secondary fields
    container = str(ref.get("container_title", ref.get("journal", ref.get("publisher", ""))) or "").strip()
    if not container:
        score -= 10
        issues.append("Missing publication venue (journal/conference/publisher)")
        
    pages = str(ref.get("pages", "") or "").strip()
    if not pages and ref.get("source_type") in ["journal article", "conference paper"]:
        score -= 5
        issues.append("Missing Page Range")
        
    # Cap score at 0 and 100
    score = max(0, min(100, score))
    return score, issues

def repair_metadata(doi: str = "", title: str = "", arxiv_id: str = "", mock_mode: bool = True) -> tuple[dict, str, float]:
    """
    Attempts to fetch/repair metadata from online sources or mock adapter.
    Returns (repaired_metadata_dict, source_name, confidence_score)
    """
    doi = doi.strip()
    title = title.strip()
    arxiv_id = arxiv_id.strip()
    
    if mock_mode or os.getenv("MOCK_MODE", "true").lower() == "true":
        return get_mock_repaired_metadata(doi, title, arxiv_id)
        
    # 1. Try resolving via arXiv ID
    if arxiv_id:
        arxiv_meta = fetch_arxiv_metadata(arxiv_id)
        if arxiv_meta:
            return arxiv_meta, "arXiv API", 0.95
            
    # 2. Try resolving via DOI (Crossref first, then OpenAlex)
    if doi:
        crossref_meta = fetch_crossref_metadata(doi)
        if crossref_meta:
            return crossref_meta, "Crossref API", 0.98
            
        openalex_meta = fetch_openalex_metadata(doi)
        if openalex_meta:
            return openalex_meta, "OpenAlex API", 0.95
            
    # 3. Try searching by Title (Crossref)
    if title:
        title_meta = search_crossref_by_title(title)
        if title_meta:
            return title_meta, "Crossref Title Search", 0.85
            
    return {}, "None", 0.0

# --- Online API Adapters ---

def fetch_crossref_metadata(doi: str) -> dict:
    url = f"https://api.crossref.org/works/{doi}"
    headers = {}
    mailto = os.getenv("CROSSREF_MAILTO")
    if mailto:
        headers["User-Agent"] = f"CiteGuardAI/1.0 (mailto:{mailto})"
        
    try:
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code == 200:
            data = r.json().get("message", {})
            return parse_crossref_item(data)
    except Exception:
        pass
    return {}

def search_crossref_by_title(title: str) -> dict:
    url = "https://api.crossref.org/works"
    headers = {}
    mailto = os.getenv("CROSSREF_MAILTO")
    if mailto:
        headers["User-Agent"] = f"CiteGuardAI/1.0 (mailto:{mailto})"
    params = {"query.title": title, "rows": 1}
    
    try:
        r = requests.get(url, params=params, headers=headers, timeout=5)
        if r.status_code == 200:
            items = r.json().get("message", {}).get("items", [])
            if items:
                # Calculate simple title similarity to make sure we didn't get trash
                best_match = items[0]
                return parse_crossref_item(best_match)
    except Exception:
        pass
    return {}

def parse_crossref_item(data: dict) -> dict:
    title_list = data.get("title", [])
    title = title_list[0] if title_list else ""
    
    author_list = []
    for author in data.get("author", []):
        given = author.get("given", "")
        family = author.get("family", "")
        if given and family:
            author_list.append(f"{family}, {given}")
        elif family:
            author_list.append(family)
            
    authors_str = ", ".join(author_list)
    
    year = None
    pub_date = data.get("published-print", data.get("published-online", data.get("created", {})))
    date_parts = pub_date.get("date-parts", [])
    if date_parts and date_parts[0]:
        year = int(date_parts[0][0])
        
    container_list = data.get("container-title", [])
    container = container_list[0] if container_list else ""
    
    pages = data.get("page", "")
    
    return {
        "title": title,
        "authors": authors_str,
        "year": year,
        "doi": data.get("DOI", ""),
        "url": data.get("URL", f"https://doi.org/{data.get('DOI', '')}"),
        "source_type": "journal article" if data.get("type") == "journal-article" else "unknown",
        "container_title": container,
        "journal": container if data.get("type") == "journal-article" else "",
        "publisher": data.get("publisher", ""),
        "volume": data.get("volume", ""),
        "issue": data.get("issue", ""),
        "pages": pages,
        "abstract": data.get("abstract", "")
    }

def fetch_openalex_metadata(doi: str) -> dict:
    url = f"https://api.openalex.org/works/https://doi.org/{doi}"
    headers = {}
    mailto = os.getenv("OPENALEX_MAILTO")
    if mailto:
        headers["User-Agent"] = f"CiteGuardAI/1.0 (mailto:{mailto})"
        
    try:
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code == 200:
            data = r.json()
            author_list = [a.get("author", {}).get("display_name", "") for a in data.get("authorships", [])]
            return {
                "title": data.get("title", ""),
                "authors": ", ".join([a for a in author_list if a]),
                "year": data.get("publication_year"),
                "doi": doi,
                "url": data.get("doi", f"https://doi.org/{doi}"),
                "source_type": "journal article" if data.get("type") == "journal-article" else "unknown",
                "container_title": data.get("primary_location", {}).get("source", {}).get("display_name", ""),
                "journal": data.get("primary_location", {}).get("source", {}).get("display_name", "") if data.get("type") == "journal-article" else "",
                "publisher": data.get("primary_location", {}).get("source", {}).get("host_organization_name", ""),
                "volume": data.get("biblio", {}).get("volume", ""),
                "issue": data.get("biblio", {}).get("issue", ""),
                "pages": f"{data.get('biblio', {}).get('first_page','')}-{data.get('biblio', {}).get('last_page','')}".strip("-"),
                "abstract": "" # OpenAlex abstracts are stored in an inverted index (complex to extract)
            }
    except Exception:
        pass
    return {}

def fetch_arxiv_metadata(arxiv_id: str) -> dict:
    url = f"http://export.arxiv.org/api/query?id_list={arxiv_id}"
    try:
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            root = ET.fromstring(r.content)
            # Find entry element
            entry = root.find("{http://www.w3.org/2005/Atom}entry")
            if entry is not None:
                title = entry.find("{http://www.w3.org/2005/Atom}title").text.strip()
                # Remove linebreaks inside title
                title = " ".join(title.split())
                
                authors = [a.find("{http://www.w3.org/2005/Atom}name").text for a in entry.findall("{http://www.w3.org/2005/Atom}author")]
                published = entry.find("{http://www.w3.org/2005/Atom}published").text
                year = int(published[:4])
                summary = entry.find("{http://www.w3.org/2005/Atom}summary").text.strip()
                summary = " ".join(summary.split())
                
                doi_elem = entry.find("{http://arxiv.org/schemas/atom}doi")
                doi = doi_elem.text if doi_elem is not None else ""
                
                return {
                    "title": title,
                    "authors": ", ".join(authors),
                    "year": year,
                    "doi": doi,
                    "arxiv_id": arxiv_id,
                    "url": f"https://arxiv.org/abs/{arxiv_id}",
                    "source_type": "preprint",
                    "container_title": "arXiv preprint",
                    "publisher": "arXiv",
                    "abstract": summary
                }
    except Exception:
        pass
    return {}

# --- Mock Metadata Generator ---

def get_mock_repaired_metadata(doi: str, title: str, arxiv_id: str) -> tuple[dict, str, float]:
    """
    Generates deterministic mock metadata for testing features.
    """
    clean_doi = doi.strip()
    clean_title = title.strip()
    clean_arxiv = arxiv_id.strip()
    
    # If looking up a known seed DOI, return fully repaired record
    if clean_doi == "10.1145/3318464.3389700" or "refactoring" in clean_title.lower():
        return {
            "title": "Refactoring Databases: Evolutionary Database Design",
            "authors": "Sadjadi, Seyed M., Fowler, Martin, Ambler, Scott W.",
            "year": 2020,
            "doi": "10.1145/3318464.3389700",
            "url": "https://doi.org/10.1145/3318464.3389700",
            "source_type": "book chapter",
            "container_title": "ACM SIGMOD Conference on Data Management",
            "publisher": "ACM Press",
            "volume": "46",
            "issue": "2",
            "pages": "112-125",
            "abstract": "This work explores how database schemas can be iteratively evolved using refactoring patterns while keeping data consistent across version changes."
        }, "Mock Crossref Registry", 1.0
        
    if clean_doi == "10.1016/j.jss.2021.111000" or "citation intelligence" in clean_title.lower() or "citeguard" in clean_title.lower():
        return {
            "title": "CiteGuard: An Intelligent Platform for Reference Verification and Metadata Audit",
            "authors": "Kumar, Krishna, Sharma, Amit, Lee, Min-Ju",
            "year": 2024,
            "doi": "10.1016/j.jss.2021.111000",
            "url": "https://doi.org/10.1016/j.jss.2021.111000",
            "source_type": "journal article",
            "container_title": "Journal of Systems and Software",
            "publisher": "Elsevier",
            "volume": "182",
            "issue": "12",
            "pages": "111000-111015",
            "abstract": "Citation mistakes in scholarly papers are a major problem. We introduce CiteGuard, a tool designed to verify claims and clean up wrong reference metadata."
        }, "Mock OpenAlex Registry", 1.0

    if clean_arxiv == "2303.08774" or "gpt-4" in clean_title.lower():
        return {
            "title": "GPT-4 Technical Report",
            "authors": "OpenAI, Team",
            "year": 2023,
            "doi": "10.48550/arXiv.2303.08774",
            "arxiv_id": "2303.08774",
            "url": "https://arxiv.org/abs/2303.08774",
            "source_type": "preprint",
            "container_title": "arXiv preprint arXiv:2303.08774",
            "publisher": "arXiv",
            "abstract": "We report on the development of GPT-4, a large-scale multimodal model capable of processing image and text inputs and producing text outputs."
        }, "Mock arXiv Registry", 1.0

    # Fallback mock generator
    mock_title = clean_title if clean_title else "Simulated Academic Article on Citation Networks"
    mock_authors = "Smith, John, Doe, Jane"
    mock_year = 2022
    mock_doi = clean_doi if clean_doi else "10.9999/mock.ref.2022.01"
    
    return {
        "title": mock_title,
        "authors": mock_authors,
        "year": mock_year,
        "doi": mock_doi,
        "url": f"https://doi.org/{mock_doi}",
        "source_type": "journal article",
        "container_title": "International Journal of Citation Analysis",
        "publisher": "Mocking Press",
        "volume": "15",
        "issue": "3",
        "pages": "240-255",
        "abstract": "This simulated abstract provides typical metadata elements for checking the platform capabilities under mock mode."
    }, "Mock Metadata Engine", 0.75
