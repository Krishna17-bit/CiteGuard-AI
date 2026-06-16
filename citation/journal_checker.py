import re

def check_journal_compliance(references: list[dict], style_name: str = "ieee", require_doi: bool = True, require_access_date: bool = True) -> list[dict]:
    """
    Audits the entire reference list against style-specific rules and flags compliance errors.
    """
    compliance_issues = []
    
    for idx, ref in enumerate(references):
        ref_id = ref.get("id")
        title = ref.get("title", "Untitled Reference")
        source_type = ref.get("source_type", "unknown")
        
        # 1. Check DOI requirement
        doi = ref.get("doi", "").strip()
        if require_doi and not doi and source_type == "journal article":
            compliance_issues.append({
                "reference_id": ref_id,
                "title": title,
                "severity": "medium",
                "rule": "DOI Required",
                "message": "Missing DOI. Many publisher guidelines (like IEEE/Nature) mandate DOIs for all journal articles.",
                "suggested_fix": "Use Metadata Repair Center to recover the DOI."
            })
            
        # 2. Check title capitalization
        # Warning if title is all-caps or all-lowercase
        if title.isupper() or title.islower():
            compliance_issues.append({
                "reference_id": ref_id,
                "title": title,
                "severity": "low",
                "rule": "Title Capitalization",
                "message": "Title is completely uppercase or lowercase. It should follow Standard Title Case or Sentence Case.",
                "suggested_fix": "Normalize title case manually or with Metadata Repair."
            })
            
        # 3. Check page range consistency
        pages = ref.get("pages", "").strip()
        if source_type in ["journal article", "conference paper"] and not pages:
            compliance_issues.append({
                "reference_id": ref_id,
                "title": title,
                "severity": "low",
                "rule": "Missing Pages",
                "message": "Missing page numbers or article locator identifier.",
                "suggested_fix": "Locate standard page numbers and input them."
            })
            
        # 4. Check journal volume and issue
        if source_type == "journal article" and (not ref.get("volume") or not ref.get("issue")):
            compliance_issues.append({
                "reference_id": ref_id,
                "title": title,
                "severity": "low",
                "rule": "Journal Volume/Issue",
                "message": "Missing volume or issue number for journal publication.",
                "suggested_fix": "Add the missing issue or volume number."
            })
            
        # 5. Check URL Access Date for Web Sources
        if source_type == "website":
            url = ref.get("url", "").strip()
            if not url:
                compliance_issues.append({
                    "reference_id": ref_id,
                    "title": title,
                    "severity": "medium",
                    "rule": "Missing URL",
                    "message": "Website source is missing a URL address.",
                    "suggested_fix": "Add a valid URL path."
                })
            elif require_access_date and "accessed" not in str(ref.get("abstract", "") + ref.get("keywords", "")).lower():
                compliance_issues.append({
                    "reference_id": ref_id,
                    "title": title,
                    "severity": "low",
                    "rule": "Missing Access Date",
                    "message": "Web citations require an 'Accessed Date' or retrieval date annotation.",
                    "suggested_fix": "Add the access date in the format 'Retrieved on Month Day, Year' to the reference notes."
                })
                
    return compliance_issues
