import os
import sys

# Ensure project path is accessible
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.db import init_db, execute_write

def seed():
    print("Initializing database schema...")
    init_db()
    
    print("Creating Demo Project...")
    p_id = execute_write("INSERT INTO projects (name) VALUES (?);", ("Comparative AI Refactoring Study",))
    
    references = [
        {
            "title": "Refactoring Databases: Evolutionary Database Design",
            "authors": "Ambler, Scott W., Fowler, Martin",
            "year": 2006,
            "doi": "10.1145/3318464.3389700",
            "source_type": "book",
            "container_title": "",
            "publisher": "Addison-Wesley Professional",
            "abstract": "This book describes how database schemas can be evolved iteratively alongside application code changes using refactoring patterns.",
            "quality": 100
        },
        {
            "title": "Refactoring Databases: Evolutionary Database Design",
            "authors": "Ambler, Scott", # Duplicate with fewer details
            "year": 2006,
            "doi": "",
            "source_type": "book",
            "container_title": "",
            "publisher": "Addison-Wesley",
            "abstract": "Database schema refactoring techniques and designs.",
            "quality": 50
        },
        {
            "title": "Attention Is All You Need",
            "authors": "Vaswani, Ashish, Shazeer, Noam, Parmar, Niki, Uszkoreit, Jakob",
            "year": 2017,
            "doi": "10.48550/arXiv.1706.03762",
            "arxiv_id": "1706.03762",
            "source_type": "conference paper",
            "container_title": "NeurIPS",
            "publisher": "Curran Associates",
            "abstract": "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose the Transformer.",
            "quality": 95
        },
        {
            "title": "GPT-4 Technical Report",
            "authors": "OpenAI, Team",
            "year": None, # Missing Year
            "doi": "10.48550/arXiv.2303.08774",
            "arxiv_id": "2303.08774",
            "source_type": "preprint",
            "container_title": "arXiv preprint",
            "publisher": "OpenAI",
            "abstract": "We report on the development of GPT-4, a large-scale multimodal model capable of processing image and text inputs.",
            "quality": 70
        },
        {
            "title": "CiteGuard: An Intelligent Platform for Reference Verification and Metadata Audit",
            "authors": "Kumar, Krishna, Sharma, Amit",
            "year": 2024,
            "doi": "10.1016/j.jss.2021.111000",
            "source_type": "journal article",
            "container_title": "Journal of Systems and Software",
            "publisher": "Elsevier",
            "abstract": "Citation mistakes in scholarly papers are a major problem. We introduce CiteGuard, a tool designed to verify claims.",
            "quality": 90
        }
    ]
    
    print(f"Seeding {len(references)} references into project {p_id}...")
    for r in references:
        execute_write(
            """INSERT INTO "references" (project_id, title, authors, year, doi, arxiv_id, source_type, container_title, publisher, abstract, metadata_quality_score, metadata_source)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Seed Script');""",
            (p_id, r["title"], r["authors"], r["year"], r["doi"], r.get("arxiv_id", ""), r["source_type"], r["container_title"], r["publisher"], r["abstract"], r["quality"])
        )
        
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    seed()
