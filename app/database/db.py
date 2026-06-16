import sqlite3
import os
import re
from contextlib import contextmanager

DB_PATH = "citeguard.db"

def get_db_path():
    url = os.getenv("DATABASE_URL", "sqlite:///citeguard.db")
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "")
    return DB_PATH

@contextmanager
def get_db():
    path = get_db_path()
    # Ensure directory exists if path contains directories
    dir_name = os.path.dirname(path)
    if dir_name and not os.path.exists(dir_name):
        os.makedirs(dir_name, exist_ok=True)
        
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def init_db():
    path = get_db_path()
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    
    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()
        
    with get_db() as conn:
        conn.executescript(schema_sql)
        
        # Populate initial default styles if empty
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as cnt FROM citation_styles;")
        if cursor.fetchone()["cnt"] == 0:
            styles = [
                ("APA 7th Edition", "apa", "author-date"),
                ("MLA 9th Edition", "mla", "author-date"),
                ("Chicago Manual of Style (Author-Date)", "chicago-author-date", "author-date"),
                ("Chicago Manual of Style (Notes & Bibliography)", "chicago-notes-bibliography", "note"),
                ("Harvard Style", "harvard", "author-date"),
                ("IEEE Style", "ieee", "numeric"),
                ("Vancouver Style", "vancouver", "numeric"),
                ("AMA (American Medical Association)", "ama", "numeric"),
                ("ACS (American Chemical Society)", "acs", "numeric"),
                ("Nature Journal Style", "nature", "numeric")
            ]
            cursor.executemany(
                "INSERT INTO citation_styles (name, csl_id, category) VALUES (?, ?, ?);",
                styles
            )

# Helpers for common queries
def fetch_all(query, params=()):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

def fetch_one(query, params=()):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        row = cursor.fetchone()
        return dict(row) if row else None

def execute_write(query, params=()):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return cursor.lastrowid
