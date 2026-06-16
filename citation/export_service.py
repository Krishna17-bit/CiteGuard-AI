import csv
import io
import re
import json
import xml.etree.ElementTree as ET
from citation.citation_formatter import format_reference, parse_authors_list

def export_references(references: list[dict], export_type: str, style: str = "apa") -> str:
    """
    Compiles reference list into the requested export file format string.
    """
    export_type = export_type.lower()
    
    if export_type == "bibtex":
        return compile_bibtex(references)
    elif export_type == "ris":
        return compile_ris(references)
    elif export_type == "endnote":
        return compile_endnote_xml(references)
    elif export_type == "csl-json":
        return compile_csl_json(references)
    elif export_type == "csv":
        return compile_csv(references)
    elif export_type == "markdown":
        lines = []
        for i, ref in enumerate(references):
            lines.append(f"{i+1}. {format_reference(ref, style, 'markdown')}")
        return "\n\n".join(lines)
    elif export_type == "html":
        lines = []
        for i, ref in enumerate(references):
            lines.append(f"<p>{i+1}. {format_reference(ref, style, 'html')}</p>")
        return "\n".join(lines)
    
    # Default Plain Text
    lines = []
    for i, ref in enumerate(references):
        lines.append(f"{i+1}. {format_reference(ref, style, 'text')}")
    return "\n".join(lines)

def compile_bibtex(references: list[dict]) -> str:
    entries = []
    for ref in references:
        # Determine cite key
        authors = parse_authors_list(ref.get("authors", ""))
        lastname = "anon"
        if authors:
            lastname = authors[0].get("family", "anon").replace(" ", "").lower()
        year = ref.get("year") or 2024
        
        # Clean special chars from key
        lastname = re.sub(r'[^a-zA-Z0-9]', '', lastname)
        cite_key = f"{lastname}{year}"
        
        source_type = ref.get("source_type", "journal article")
        btype = "article"
        if "book" in source_type: btype = "book"
        elif "conference" in source_type: btype = "inproceedings"
        elif "thesis" in source_type: btype = "thesis"
        elif "report" in source_type: btype = "techreport"
        elif "website" in source_type: btype = "online"
        
        lines = [f"@{btype}{{{cite_key},"]
        
        fields = {
            "title": ref.get("title"),
            "author": ref.get("authors"),
            "year": str(year),
            "doi": ref.get("doi"),
            "url": ref.get("url"),
            "volume": ref.get("volume"),
            "number": ref.get("issue"),
            "pages": ref.get("pages"),
            "publisher": ref.get("publisher"),
            "abstract": ref.get("abstract")
        }
        
        # In IEEE/BibTeX journal is for article and booktitle is for inproceedings
        if btype == "article":
            fields["journal"] = ref.get("journal", ref.get("container_title"))
        else:
            fields["booktitle"] = ref.get("container_title")
            
        for k, v in fields.items():
            if v:
                # escape simple quotes/slashes
                val = str(v).replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")
                lines.append(f"  {k} = {{{val}}},")
                
        # Strip trailing comma from last field line
        if len(lines) > 1:
            lines[-1] = lines[-1].rstrip(",")
            
        lines.append("}")
        entries.append("\n".join(lines))
        
    return "\n\n".join(entries)

def compile_ris(references: list[dict]) -> str:
    entries = []
    for ref in references:
        st = ref.get("source_type", "journal article")
        ty = "JOUR"
        if "book" in st: ty = "BOOK"
        elif "conference" in st: ty = "CONF"
        elif "thesis" in st: ty = "THES"
        elif "report" in st: ty = "RPRT"
        elif "website" in st: ty = "ELEC"
        
        lines = [f"TY  - {ty}"]
        
        # Add core tags
        if ref.get("title"): lines.append(f"TI  - {ref.get('title')}")
        
        # Authors list split
        authors = parse_authors_list(ref.get("authors", ""))
        for a in authors:
            lines.append(f"AU  - {a.get('family')}, {a.get('given')}")
            
        if ref.get("year"): lines.append(f"PY  - {ref.get('year')}")
        
        container = ref.get("container_title", ref.get("journal", ""))
        if container:
            lines.append(f"JO  - {container}")
            
        if ref.get("volume"): lines.append(f"VL  - {ref.get('volume')}")
        if ref.get("issue"): lines.append(f"IS  - {ref.get('issue')}")
        
        pages = ref.get("pages", "")
        if pages and "-" in pages:
            sp, ep = pages.split("-", 1)
            lines.append(f"SP  - {sp.strip()}")
            lines.append(f"EP  - {ep.strip()}")
        elif pages:
            lines.append(f"SP  - {pages}")
            
        if ref.get("doi"): lines.append(f"DO  - {ref.get('doi')}")
        if ref.get("url"): lines.append(f"UR  - {ref.get('url')}")
        if ref.get("publisher"): lines.append(f"PB  - {ref.get('publisher')}")
        if ref.get("abstract"): lines.append(f"AB  - {ref.get('abstract')}")
        
        lines.append("ER  - ")
        entries.append("\n".join(lines))
        
    return "\n\n".join(entries)

def compile_endnote_xml(references: list[dict]) -> str:
    root = ET.Element("xml")
    records = ET.SubElement(root, "records")
    
    for ref in references:
        record = ET.SubElement(records, "record")
        
        # Ref-type
        ref_type = ET.SubElement(record, "ref-type")
        st = ref.get("source_type", "journal article")
        if "book" in st:
            ref_type.set("name", "Book")
            ref_type.text = "6"
        elif "conference" in st:
            ref_type.set("name", "Conference Paper")
            ref_type.text = "47"
        else:
            ref_type.set("name", "Journal Article")
            ref_type.text = "17"
            
        # Title
        titles = ET.SubElement(record, "titles")
        title = ET.SubElement(titles, "title")
        style = ET.SubElement(title, "style")
        style.text = ref.get("title")
        
        # Authors
        contributors = ET.SubElement(record, "contributors")
        authors = ET.SubElement(contributors, "authors")
        authors_parsed = parse_authors_list(ref.get("authors", ""))
        for a in authors_parsed:
            author = ET.SubElement(authors, "author")
            style = ET.SubElement(author, "style")
            style.text = f"{a.get('family')}, {a.get('given')}"
            
        # Journal/Container
        container = ref.get("container_title", ref.get("journal", ""))
        if container:
            periodical = ET.SubElement(record, "periodical")
            full_title = ET.SubElement(periodical, "full-title")
            style = ET.SubElement(full_title, "style")
            style.text = container
            
        # Volume, Issue, Pages, Year, DOI
        if ref.get("volume"):
            vol = ET.SubElement(record, "volume")
            style = ET.SubElement(vol, "style")
            style.text = ref.get("volume")
            
        if ref.get("issue"):
            num = ET.SubElement(record, "number")
            style = ET.SubElement(num, "style")
            style.text = ref.get("issue")
            
        if ref.get("pages"):
            pages = ET.SubElement(record, "pages")
            style = ET.SubElement(pages, "style")
            style.text = ref.get("pages")
            
        if ref.get("year"):
            dates = ET.SubElement(record, "dates")
            year = ET.SubElement(dates, "year")
            style = ET.SubElement(year, "style")
            style.text = str(ref.get("year"))
            
        if ref.get("doi"):
            electronic_resource_num = ET.SubElement(record, "electronic-resource-num")
            style = ET.SubElement(electronic_resource_num, "style")
            style.text = ref.get("doi")
            
    # Serialize XML
    xml_str = ET.tostring(root, encoding="utf-8")
    # Pretty print format
    import xml.dom.minidom
    dom = xml.dom.minidom.parseString(xml_str)
    return dom.toprettyxml(indent="  ")

def compile_csl_json(references: list[dict]) -> str:
    csl_list = []
    for ref in references:
        authors_parsed = parse_authors_list(ref.get("authors", ""))
        csl_authors = [{"family": a.get("family", ""), "given": a.get("given", "")} for a in authors_parsed]
        
        csl_item = {
            "id": str(ref.get("id")),
            "type": "article-journal" if ref.get("source_type") == "journal article" else "book",
            "title": ref.get("title"),
            "author": csl_authors,
            "container-title": ref.get("container_title", ref.get("journal", "")),
            "volume": ref.get("volume"),
            "issue": ref.get("issue"),
            "page": ref.get("pages"),
            "publisher": ref.get("publisher"),
            "DOI": ref.get("doi"),
            "URL": ref.get("url")
        }
        if ref.get("year"):
            csl_item["issued"] = {"date-parts": [[int(ref.get("year"))]]}
            
        csl_list.append(csl_item)
    return json.dumps(csl_list, indent=2)

def compile_csv(references: list[dict]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header columns
    writer.writerow(["ID", "Title", "Authors", "Year", "DOI", "arXiv ID", "Source Type", "Container Title", "Volume", "Issue", "Pages", "Publisher", "URL"])
    
    for ref in references:
        writer.writerow([
            ref.get("id"),
            ref.get("title"),
            ref.get("authors"),
            ref.get("year"),
            ref.get("doi"),
            ref.get("arxiv_id"),
            ref.get("source_type"),
            ref.get("container_title"),
            ref.get("volume"),
            ref.get("issue"),
            ref.get("pages"),
            ref.get("publisher"),
            ref.get("url")
        ])
        
    return output.getvalue()
