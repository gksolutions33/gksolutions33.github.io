import os
import re

# Base directory for tutorials
BASE_DIR = r"c:\Users\Hello\Desktop\vivek\web\gksolutions33.github.io\tutorials"

# Files to ignore
IGNORE_FILES = ["lesson-1.html", "index.html"]

def generate_toc(content):
    # Check if TOC already exists
    if "gfg-article-toc" in content:
        return content

    # Find all h3 tags and extract their text to build TOC
    # Regex looks for <h3>Title</h3> or <h3 id="...">Title</h3>
    h3_pattern = re.compile(r'<h3[^>]*>(.*?)</h3>', re.IGNORECASE | re.DOTALL)
    
    matches = h3_pattern.findall(content)
    if not matches:
        return content

    toc_html = '\n  <!-- GFG Style Table of Contents -->\n'
    toc_html += '  <div class="gfg-article-toc">\n    <h4>Table of Contents</h4>\n    <ul>\n'
    
    # We will also add id="" to h3 tags if they don't have one to link properly
    new_content = content
    
    for i, title in enumerate(matches):
        clean_title = re.sub(r'<[^>]+>', '', title).strip() # Remove any inner tags like icons
        # create a safe id
        safe_id = re.sub(r'[^a-zA-Z0-9]', '-', clean_title.lower())
        safe_id = re.sub(r'-+', '-', safe_id).strip('-')
        if not safe_id:
            safe_id = f"section-{i}"
            
        toc_html += f'      <li><a href="#{safe_id}">{clean_title}</a></li>\n'
        
        # Add id to the H3 tag if missing
        original_h3 = re.search(r'<h3[^>]*>' + re.escape(title) + r'</h3>', new_content, flags=re.IGNORECASE|re.DOTALL)
        if original_h3:
            match_str = original_h3.group(0)
            if 'id=' not in match_str:
                new_h3 = match_str.replace('<h3', f'<h3 id="{safe_id}"', 1)
                new_content = new_content.replace(match_str, new_h3, 1)

    toc_html += '    </ul>\n  </div>\n'
    
    # Inject TOC right before the FIRST h3
    first_h3_match = re.search(r'<h3[^>]*>', new_content, flags=re.IGNORECASE)
    if first_h3_match:
        insertion_point = first_h3_match.start()
        new_content = new_content[:insertion_point] + toc_html + '\n  ' + new_content[insertion_point:]
        
    return new_content

def clean_pre_tags(content):
    # Replace complicated <pre style="..."> with clean <pre>
    content = re.sub(r'<pre\s+style="[^"]*">', '<pre>', content, flags=re.IGNORECASE)
    return content

def add_try_it_button(content):
    # Only add if it doesn't already have one
    if "gfg-tryIt" in content:
        return content
        
    # Find the first closing </pre> and inject the Try It button and empty output box after it
    # Just a simple injection for the first code block to act as a placeholder
    try_it_html = '\n  <a href="#" class="gfg-tryIt"><i class="fas fa-play"></i> Try It Yourself</a>\n  <div class="gfg-output-box">Output...</div>\n'
    content = re.sub(r'(</pre>)', r'\1' + try_it_html, content, count=1, flags=re.IGNORECASE)
    return content

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    original = content
    content = generate_toc(content)
    content = clean_pre_tags(content)
    content = add_try_it_button(content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    modified_count = 0
    total_count = 0
    
    for root, dirs, files in os.walk(BASE_DIR):
        for file in files:
            if file.endswith(".html") and file not in IGNORE_FILES:
                filepath = os.path.join(root, file)
                total_count += 1
                if process_file(filepath):
                    modified_count += 1
                    print(f"Modified: {filepath}")
                    
    print(f"\nMigration Complete! Modified {modified_count} out of {total_count} files.")

if __name__ == "__main__":
    main()
