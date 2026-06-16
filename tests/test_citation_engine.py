import pytest
from citation.bibtex_parser import parse_bibtex, map_bibtex_type
from citation.ris_parser import parse_ris
from citation.bibtex_cleaner import clean_bibtex_content
from citation.duplicate_detector import normalize_doi, calculate_jaccard, find_duplicates
from citation.citation_formatter import format_reference, format_in_text
from citation.claim_splitter import split_text_into_claims
from citation.citation_auditor import audit_manuscript
from citation.export_service import export_references

# 1. DOI Validation & Normalization Tests
def test_doi_normalization():
    assert normalize_doi("https://doi.org/10.1145/3318464.3389700") == "10.1145/3318464.3389700"
    assert normalize_doi("10.1016/j.jss.2021.111000") == "10.1016/j.jss.2021.111000"
    assert normalize_doi("") == ""

# 2. BibTeX Parser Tests
def test_bibtex_parser():
    bib_text = """
    @article{smith2020,
      author = {Smith, John and Doe, Jane},
      title = {A study on AI},
      journal = {Journal of Tools},
      year = {2020},
      doi = {10.1234/jt.2020.1}
    }
    """
    entries = parse_bibtex(bib_text)
    assert len(entries) == 1
    assert entries[0]["title"] == "A study on AI"
    assert entries[0]["authors"] == "Smith, John, Doe, Jane"
    assert entries[0]["year"] == 2020
    assert entries[0]["doi"] == "10.1234/jt.2020.1"
    assert entries[0]["source_type"] == "journal article"

# 3. BibTeX Cleaner Tests
def test_bibtex_cleaner():
    raw_bib = """
    @article{smith2020,
      author = {Smith, John},
      title = {A study on AI and DNA},
      journal = {Journal of Tools},
      year = {2020}
    }
    """
    cleaned, warnings = clean_bibtex_content(raw_bib)
    # Check if acronyms are wrapped in braces
    assert "{AI}" in cleaned
    assert "{DNA}" in cleaned
    # Ensure warnings list exists
    assert isinstance(warnings, list)

# 4. RIS Parser Tests
def test_ris_parser():
    ris_text = """
    TY  - JOUR
    TI  - A study on AI
    AU  - Smith, John
    JO  - Journal of Tools
    PY  - 2020
    DO  - 10.1234/jt.2020.1
    ER  - 
    """
    entries = parse_ris(ris_text)
    assert len(entries) == 1
    assert entries[0]["title"] == "A study on AI"
    assert entries[0]["authors"] == "Smith, John"
    assert entries[0]["year"] == 2020
    assert entries[0]["doi"] == "10.1234/jt.2020.1"

# 5. Duplicate Detector Tests
def test_duplicate_detector():
    refs = [
        {"id": 1, "title": "Refactoring Databases", "authors": "Smith, J.", "year": 2020, "doi": "10.1111/abc.123"},
        {"id": 2, "title": "Refactoring Databases", "authors": "Smith, John", "year": 2020, "doi": ""}, # Missing DOI, high title sim
        {"id": 3, "title": "Attention Is All You Need", "authors": "Vaswani, A.", "year": 2017, "doi": "10.2222/xyz.789"}
    ]
    dupes = find_duplicates(refs)
    assert len(dupes) == 1
    assert dupes[0]["confidence_score"] >= 0.8
    assert len(dupes[0]["references"]) == 2

# 6. Formatters Tests
def test_formatters():
    ref = {
        "title": "Attention Is All You Need",
        "authors": "Vaswani, Ashish, Shazeer, Noam",
        "year": 2017,
        "doi": "10.48550/arXiv.1706.03762",
        "journal": "NeurIPS"
    }
    apa = format_reference(ref, "apa", "text")
    assert "Vaswani, A., & Shazeer, N. (2017)" in apa
    assert "Attention Is All You Need." in apa
    
    ieee_in_text = format_in_text(ref, "ieee", 3)
    assert ieee_in_text == "[3]"
    
    apa_in_text = format_in_text(ref, "apa", 1)
    assert "Vaswani & Shazeer, 2017" in apa_in_text

# 7. Claim Splitting Tests
def test_claim_splitting():
    text = "We audit citations e.g. using CiteGuard. We split sentences accurately."
    claims = split_text_into_claims(text)
    assert len(claims) == 2
    assert "e.g." in claims[0]
    assert "We split sentences accurately." in claims[1]

# 8. Manuscript Auditing Tests
def test_manuscript_auditor():
    refs = [
        {"id": 1, "title": "Refactoring Databases", "authors": "Ambler, S.", "year": 2006, "doi": "10.1111/xyz"},
        {"id": 2, "title": "Attention Is All You Need", "authors": "Vaswani, A.", "year": 2017, "doi": ""}
    ]
    text = "We use database refactoring [1] and neural self-attention [2] and some missing citation [3]."
    audit = audit_manuscript(text, refs, "numeric")
    
    assert audit["health_score"] < 100
    # Cites [3] which is missing from refs
    missing_issues = [i for i in audit["issues"] if i["issue_type"] == "missing_reference"]
    assert len(missing_issues) == 1
    assert "[3]" in missing_issues[0]["message"]

# 9. Export Compilation Tests
def test_export_compilation():
    refs = [
        {"title": "Refactoring Databases", "authors": "Ambler, S.", "year": 2006, "doi": "10.1111/xyz"}
    ]
    ris = export_references(refs, "ris")
    assert "TY  - JOUR" in ris
    assert "TI  - Refactoring Databases" in ris
    assert "ER  - " in ris

# 10. Advanced Features Tests
def test_advanced_features():
    from citation.claim_citation_verifier import verify_claim_against_reference
    
    # Check fake reference warning in audit
    fake_ref = {
        "id": 4,
        "title": "A Totally Made Up Academic Paper Title That Does Not Exist",
        "authors": "Ghost, Writer",
        "year": 2025,
        "doi": "",
        "arxiv_id": "",
        "pubmed_id": "",
        "url": "",
        "metadata_quality_score": 30
    }
    
    audit = audit_manuscript("We reference the ghost writer paper [1].", [fake_ref], "numeric")
    fake_warnings = [i for i in audit["issues"] if i["issue_type"] == "fake_reference_warning"]
    assert len(fake_warnings) == 1
    assert fake_warnings[0]["severity"] == "critical"
    
    # Check verify_claim_against_reference: citation_intent Methodology and Critique
    res_method = verify_claim_against_reference("We describe our method approach here.", fake_ref)
    assert res_method["citation_intent"] == "Methodology"
    
    res_critique = verify_claim_against_reference("Our study fails to outline these limits.", fake_ref)
    assert res_critique["citation_intent"] == "Critique"
