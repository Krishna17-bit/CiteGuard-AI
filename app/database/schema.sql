-- Schema for CiteGuard AI SQLite Database

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "references" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT,
    authors TEXT, -- String representation of all authors
    year INTEGER,
    doi TEXT,
    arxiv_id TEXT,
    pubmed_id TEXT,
    url TEXT,
    source_type TEXT, -- e.g., 'journal article', 'book', 'preprint', etc.
    container_title TEXT, -- journal or book series name
    journal TEXT,
    conference TEXT,
    publisher TEXT,
    volume TEXT,
    issue TEXT,
    pages TEXT,
    edition TEXT,
    isbn TEXT,
    abstract TEXT,
    keywords TEXT,
    metadata_quality_score INTEGER,
    metadata_source TEXT,
    metadata_confidence REAL,
    raw_bibtex TEXT,
    raw_ris TEXT,
    raw_csl_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reference_authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_id INTEGER NOT NULL,
    given_name TEXT,
    family_name TEXT,
    full_name TEXT,
    order_index INTEGER,
    orcid TEXT,
    FOREIGN KEY(reference_id) REFERENCES "references"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reference_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_id INTEGER NOT NULL,
    file_name TEXT,
    file_path TEXT,
    file_type TEXT,
    page_count INTEGER,
    text_extracted INTEGER DEFAULT 0, -- 0 for False, 1 for True
    scanned_detected INTEGER DEFAULT 0, -- 0 for False, 1 for True
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(reference_id) REFERENCES "references"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reference_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_file_id INTEGER NOT NULL,
    page_number INTEGER,
    text TEXT,
    FOREIGN KEY(reference_file_id) REFERENCES reference_files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS citation_styles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    csl_id TEXT NOT NULL UNIQUE,
    category TEXT,
    enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS citation_audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    manuscript_name TEXT,
    style TEXT,
    health_score INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS citation_audit_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER NOT NULL,
    issue_type TEXT, -- e.g., 'missing_reference', 'uncited_item', 'formatting', 'duplicate'
    severity TEXT, -- 'low', 'medium', 'high', 'critical'
    location TEXT, -- character index or description
    reference_id INTEGER,
    message TEXT,
    suggested_fix TEXT,
    status TEXT DEFAULT 'open',
    FOREIGN KEY(audit_id) REFERENCES citation_audits(id) ON DELETE CASCADE,
    FOREIGN KEY(reference_id) REFERENCES "references"(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS claim_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    manuscript_section TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS claim_check_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_check_id INTEGER NOT NULL,
    claim_text TEXT NOT NULL,
    current_citation TEXT,
    status TEXT, -- 'Supported', 'Partially Supported', 'Unsupported', 'Needs Citation', 'Citation Mismatch', 'Outside available source set'
    suggested_reference_id INTEGER,
    evidence_text TEXT,
    page_number INTEGER,
    confidence_score REAL,
    FOREIGN KEY(claim_check_id) REFERENCES claim_checks(id) ON DELETE CASCADE,
    FOREIGN KEY(suggested_reference_id) REFERENCES "references"(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS duplicate_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    confidence_score REAL,
    reason TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'ignored'
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS duplicate_group_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    reference_id INTEGER NOT NULL,
    FOREIGN KEY(group_id) REFERENCES duplicate_groups(id) ON DELETE CASCADE,
    FOREIGN KEY(reference_id) REFERENCES "references"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    export_type TEXT,
    file_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_id INTEGER NOT NULL,
    note_type TEXT, -- 'summary', 'method', 'result', 'limitation', 'quote', 'research gap', 'manual note', 'citation warning'
    content TEXT,
    tags TEXT, -- Comma-separated tags
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(reference_id) REFERENCES "references"(id) ON DELETE CASCADE
);
