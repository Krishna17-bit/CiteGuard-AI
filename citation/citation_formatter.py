import re
import json

def parse_authors_list(authors_str: str) -> list[dict]:
    """
    Parses comma-separated author list into structured dicts:
    [{'family': 'Smith', 'given': 'John A.'}]
    """
    if not authors_str:
        return []
        
    authors_str = authors_str.replace(" and ", ", ")
    parts = [p.strip() for p in authors_str.split(",") if p.strip()]
    parsed = []
    
    for part in parts:
        # Check if "Family, Given" format
        if " " not in part:
            parsed.append({"family": part, "given": ""})
            continue
            
        # If there's a comma inside the author name part, we split on it
        # Wait, since we split on commas earlier, this shouldn't happen unless "Smith, John, Doe, Jane"
        # Let's check if the individual part was "Smith John" or similar.
        sub_parts = part.split()
        if len(sub_parts) == 1:
            parsed.append({"family": sub_parts[0], "given": ""})
        elif len(sub_parts) >= 2:
            # If the original author string was "Smith, J." it was split into parts = ["Smith", "J."]
            # Let's write a more robust parser.
            # Typical BibTeX author string: "Smith, John A. and Doe, Jane"
            # After replacing " and " with ", " it is "Smith, John A., Doe, Jane"
            # It's better to split by " and " first!
            pass
            
    # Let's implement a clean split by " and " first:
    authors_clean = authors_str.replace(" AND ", " and ").replace(" And ", " and ")
    individual_authors = [a.strip() for a in authors_clean.split(" and ") if a.strip()]
    if len(individual_authors) <= 1:
        # Fallback to comma splitting if " and " was not found, but watch out for "Smith, J., Doe, J."
        # If there are commas, check if it's "Last, First" or "Last, First, Last, First"
        # A simple check: if we split by comma and get odd/even parts, or if comma separates individual authors.
        individual_authors = [a.strip() for a in authors_clean.split(",") if a.strip()]
        # If authors were "Smith, J. A." then splitting by comma yields ["Smith", "J. A."] which is one author!
        # Let's check if the second item is just initials or first names.
        # To make it simple and extremely robust, let's parse standard structures:
        # If there's a comma in the item, it might be "Last, First".
        # Let's rebuild the individual author list.
        pass
        
    # Standard parser:
    parsed_authors = []
    # Let's split the raw string on " and " to get individual names
    raw_names = [n.strip() for n in re.split(r'\s+and\s+', authors_str, flags=re.IGNORECASE) if n.strip()]
    if len(raw_names) <= 1 and "," in authors_str:
        delimiter = ";" if ";" in authors_str else ","
        temp_names = [n.strip() for n in authors_str.split(delimiter) if n.strip()]
        if delimiter == "," and len(temp_names) % 2 == 0:
            raw_names = []
            for idx in range(0, len(temp_names), 2):
                raw_names.append(f"{temp_names[idx]}, {temp_names[idx+1]}")
        else:
            raw_names = temp_names

    for name in raw_names:
        if "," in name:
            parts = name.split(",", 1)
            family = parts[0].strip()
            given = parts[1].strip()
        else:
            parts = name.split()
            if len(parts) == 1:
                family = parts[0]
                given = ""
            else:
                family = parts[-1]
                given = " ".join(parts[:-1])
        parsed_authors.append({"family": family, "given": given})
        
    return parsed_authors

def format_author_name(author: dict, style: str) -> str:
    family = author.get("family", "")
    given = author.get("given", "")
    
    if not given:
        return family
        
    initials = "".join([w[0] + "." for w in given.split() if w]).strip()
    # initials without dots for Vancouver
    vanc_initials = initials.replace(".", "")
    
    if style in ["apa", "harvard", "nature"]:
        return f"{family}, {initials}"
    elif style in ["mla", "chicago"]:
        return f"{family}, {given}"
    elif style in ["ieee"]:
        return f"{initials} {family}"
    elif style in ["vancouver", "ama"]:
        return f"{family} {vanc_initials}"
    elif style in ["acs"]:
        return f"{family}, {initials}"
    return f"{family}, {given}"

def format_authors_list(authors: list[dict], style: str) -> str:
    n = len(authors)
    if n == 0:
        return ""
    if n == 1:
        return format_author_name(authors[0], style)
        
    formatted = [format_author_name(a, style) for a in authors]
    
    if style == "apa":
        if n > 20:
            return ", ".join(formatted[:19]) + ", ... " + formatted[-1]
        return ", ".join(formatted[:-1]) + ", & " + formatted[-1]
    elif style == "mla":
        if n > 2:
            return formatted[0] + ", et al."
        return formatted[0] + ", and " + formatted[1]
    elif style in ["chicago", "harvard", "nature", "acs"]:
        if n > 3:
            return formatted[0] + " et al."
        if style == "nature" or style == "harvard":
            return ", ".join(formatted[:-1]) + " & " + formatted[-1]
        return ", ".join(formatted[:-1]) + ", and " + formatted[-1]
    elif style == "ieee":
        if n > 3:
            return formatted[0] + " et al."
        return ", ".join(formatted[:-1]) + " and " + formatted[-1]
    elif style in ["vancouver", "ama"]:
        if n > 6:
            return ", ".join(formatted[:6]) + ", et al."
        return ", ".join(formatted)
        
    return ", ".join(formatted)

def format_reference(ref: dict, style: str = "apa", fmt_type: str = "text") -> str:
    """
    Formats a single reference dictionary into the chosen style and format.
    fmt_type: 'text' (plain text), 'markdown', or 'html'
    """
    style = style.lower()
    authors_parsed = parse_authors_list(ref.get("authors", ""))
    authors_str = format_authors_list(authors_parsed, style)
    
    title = ref.get("title", "") or ""
    # Ensure title ends with period if it doesn't already
    if title and not title.endswith(".") and not title.endswith("?") and not title.endswith("!"):
        title_dot = title + "."
    else:
        title_dot = title
        
    year = ref.get("year", "")
    doi = ref.get("doi", "")
    url = ref.get("url", "")
    journal = ref.get("journal", ref.get("container_title", ""))
    volume = ref.get("volume", "")
    issue = ref.get("issue", "")
    pages = ref.get("pages", "")
    publisher = ref.get("publisher", "")
    
    # Format components based on fmt_type
    def italics(txt):
        if not txt: return ""
        if fmt_type == "html": return f"<i>{txt}</i>"
        if fmt_type == "markdown": return f"*{txt}*"
        return txt
        
    def bold(txt):
        if not txt: return ""
        if fmt_type == "html": return f"<b>{txt}</b>"
        if fmt_type == "markdown": return f"**{txt}**"
        return txt
        
    def link(txt, href):
        if not txt or not href: return txt
        if fmt_type == "html": return f'<a href="{href}" target="_blank">{txt}</a>'
        if fmt_type == "markdown": return f"[{txt}]({href})"
        return f"{txt} ({href})"
        
    # Styles formatting
    if style == "apa":
        # APA: Author, A. A. (Year). Title. Journal, Vol(Issue), Pages. DOI
        parts = []
        if authors_str: parts.append(authors_str)
        if year: parts.append(f"({year})")
        if title_dot: parts.append(title_dot)
        
        venue_parts = []
        if journal:
            venue_parts.append(italics(journal))
        if volume:
            vol_str = volume
            if issue: vol_str += f"({issue})"
            # Vol is italicized in APA
            venue_parts.append(italics(vol_str))
        if pages:
            venue_parts.append(pages)
            
        if venue_parts:
            parts.append(", ".join(venue_parts) + ".")
            
        if doi:
            doi_url = doi if doi.startswith("http") else f"https://doi.org/{doi}"
            parts.append(link(doi_url, doi_url))
        elif url:
            parts.append(link(url, url))
            
        return " ".join(parts)
        
    elif style == "mla":
        # MLA: Author. "Title." Journal, vol. Vol, no. Issue, Year, pp. Pages. DOI
        parts = []
        if authors_str: parts.append(authors_str + ".")
        if title: parts.append(f'"{title_dot}"')
        
        venue_parts = []
        if journal: venue_parts.append(italics(journal))
        if volume: venue_parts.append(f"vol. {volume}")
        if issue: venue_parts.append(f"no. {issue}")
        if year: venue_parts.append(str(year))
        if pages: venue_parts.append(f"pp. {pages}")
        
        if venue_parts:
            parts.append(", ".join(venue_parts) + ".")
            
        if doi:
            doi_url = doi if doi.startswith("http") else f"https://doi.org/{doi}"
            parts.append(link(doi_url, doi_url))
        elif url:
            parts.append(link(url, url))
            
        return " ".join(parts)
        
    elif style == "ieee":
        # IEEE: [N] A. Author, "Title," Journal, vol. Vol, no. Issue, pp. Pages, Year.
        parts = []
        if authors_str: parts.append(authors_str)
        if title: parts.append(f'"{title_dot.rstrip(".")},"')
        if journal: parts.append(italics(journal))
        
        details = []
        if volume: details.append(f"vol. {volume}")
        if issue: details.append(f"no. {issue}")
        if pages: details.append(f"pp. {pages}")
        if year: details.append(str(year))
        
        if details:
            parts.append(", ".join(details) + ".")
            
        if doi:
            parts.append(f"doi: {doi}.")
        elif url:
            parts.append(link("Online", url))
            
        return ", ".join(parts)
        
    elif style in ["vancouver", "ama"]:
        # Vancouver: Author AA. Title. Journal. Year;Volume(Issue):Pages. doi
        parts = []
        if authors_str: parts.append(authors_str + ".")
        if title_dot: parts.append(title_dot)
        if journal: parts.append(journal + ".")
        
        date_venue = ""
        if year: date_venue += str(year)
        if volume:
            vol_str = f";{volume}"
            if issue: vol_str += f"({issue})"
            date_venue += vol_str
        if pages:
            date_venue += f":{pages}"
        if date_venue:
            parts.append(date_venue + ".")
            
        if doi:
            parts.append(f"doi: {doi}.")
        return " ".join(parts)
        
    elif style == "nature":
        # Nature: Author, A. A. Title. Journal Volume, Pages (Year).
        parts = []
        if authors_str: parts.append(authors_str)
        if title_dot: parts.append(title_dot)
        
        venue = ""
        if journal: venue += italics(journal) + " "
        if volume: venue += bold(volume)
        if pages: venue += f", {pages}"
        if year: venue += f" ({year})"
        
        if venue: parts.append(venue + ".")
        return " ".join(parts)
        
    # Chicago Author-Date fallback
    parts = []
    if authors_str: parts.append(authors_str + ".")
    if year: parts.append(f"{year}.")
    if title: parts.append(f'"{title_dot}"')
    if journal: parts.append(italics(journal))
    
    details = ""
    if volume:
        details += f" {volume}"
        if issue: details += f" ({issue})"
    if pages:
        details += f": {pages}"
    if details:
        parts.append(details + ".")
        
    if doi:
        parts.append(f"https://doi.org/{doi}")
    elif url:
        parts.append(url)
        
    return " ".join(parts)

def format_in_text(ref: dict, style: str = "apa", index: int = 1) -> str:
    """
    Generates in-text citation e.g. [1] or (Smith, 2020).
    """
    style = style.lower()
    authors_parsed = parse_authors_list(ref.get("authors", ""))
    year = ref.get("year", "n.d.")
    
    if style in ["ieee", "vancouver", "ama", "nature"]:
        return f"[{index}]"
        
    if not authors_parsed:
        title = ref.get("title", "Anon")
        title_snippet = title[:20] + "..." if len(title) > 20 else title
        return f"({title_snippet}, {year})"
        
    last_names = [a.get("family", "") for a in authors_parsed]
    n = len(last_names)
    
    if style == "apa":
        if n == 1:
            return f"({last_names[0]}, {year})"
        elif n == 2:
            return f"({last_names[0]} & {last_names[1]}, {year})"
        else:
            return f"({last_names[0]} et al., {year})"
            
    # Default Chicago/Harvard
    if n == 1:
        return f"({last_names[0]} {year})"
    elif n == 2:
        return f"({last_names[0]} and {last_names[1]} {year})"
    return f"({last_names[0]} et al. {year})"

def format_csl_json(references: list[dict]) -> str:
    """
    Converts list of references to standard CSL-JSON list.
    """
    csl_list = []
    for r in references:
        authors_parsed = parse_authors_list(r.get("authors", ""))
        csl_authors = [{"family": a.get("family", ""), "given": a.get("given", "")} for a in authors_parsed]
        
        csl_item = {
            "id": str(r.get("id")),
            "type": "article-journal" if r.get("source_type") == "journal article" else "book",
            "title": r.get("title"),
            "author": csl_authors,
            "issued": {"date-parts": [[int(r.get("year"))]]} if r.get("year") else None,
            "container-title": r.get("container_title", r.get("journal", "")),
            "volume": r.get("volume"),
            "issue": r.get("issue"),
            "page": r.get("pages"),
            "publisher": r.get("publisher"),
            "DOI": r.get("doi"),
            "URL": r.get("url")
        }
        csl_list.append(csl_item)
    return json.dumps(csl_list, indent=2)
