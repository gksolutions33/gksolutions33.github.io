#!/usr/bin/env python3
"""
Fetch all repositories from Universal-college-projects GitHub organization
and generate structured JSON data for the project showcase website.
"""

import requests
import json
import re
import os
from datetime import datetime
from typing import List, Dict, Optional

# Configuration
ORG_NAME = "Universal-college-projects"
OUTPUT_FILE = "_data/projects.json"
GITHUB_API_BASE = "https://api.github.com"

# Optional: Set your GitHub token for higher rate limits and private repo access
# Get token from: https://github.com/settings/tokens
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")


def get_headers() -> Dict[str, str]:
    """Get headers for GitHub API requests."""
    headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    return headers


def fetch_organization_repos(org_name: str) -> List[Dict]:
    """Fetch all repositories from a GitHub organization."""
    url = f"{GITHUB_API_BASE}/orgs/{org_name}/repos"
    # type="all" ensures we get public and private repos (if token has access)
    params = {"per_page": 100, "sort": "updated", "direction": "desc", "type": "all"}
    
    print(f"Fetching repositories from {org_name}...")
    response = requests.get(url, headers=get_headers(), params=params)
    
    if response.status_code != 200:
        print(f"Error: {response.status_code} - {response.text}")
        return []
    
    repos = response.json()
    print(f"Found {len(repos)} repositories")
    return repos


def fetch_readme(repo_full_name: str) -> Optional[str]:
    """Fetch README content from a repository."""
    url = f"{GITHUB_API_BASE}/repos/{repo_full_name}/readme"
    response = requests.get(url, headers=get_headers())
    
    if response.status_code == 200:
        readme_data = response.json()
        # Get the raw content URL
        download_url = readme_data.get("download_url")
        if download_url:
            readme_response = requests.get(download_url)
            if readme_response.status_code == 200:
                return readme_response.text
    return None


def extract_difficulty(readme: str) -> str:
    """Extract difficulty level from README content."""
    if not readme:
        return "intermediate"
    
    readme_lower = readme.lower()
    if "beginner" in readme_lower or "easy" in readme_lower:
        return "beginner"
    elif "advanced" in readme_lower or "expert" in readme_lower:
        return "advanced"
    else:
        return "intermediate"


def extract_estimated_time(readme: str) -> str:
    """Extract estimated time from README content."""
    if not readme:
        return "Unknown"
    
    # Look for patterns like "2 hours", "30 minutes", "1-2 hours"
    time_pattern = r'(\d+[-–]\d+|\d+)\s*(hour|hr|minute|min)s?'
    match = re.search(time_pattern, readme, re.IGNORECASE)
    
    if match:
        return match.group(0)
    return "Varies"


def extract_setup_steps(readme: str) -> List[str]:
    """Extract setup/installation steps from README."""
    if not readme:
        return []
    
    steps = []
    
    # Look for installation or setup sections
    sections = re.split(r'##\s+', readme, flags=re.IGNORECASE)
    
    for section in sections:
        if re.match(r'(installation|setup|getting started|how to run)', section, re.IGNORECASE):
            # Extract numbered or bulleted lists
            lines = section.split('\n')
            for line in lines:
                line = line.strip()
                # Match numbered lists (1. , 2. ) or bullet points (- , * )
                if re.match(r'^(\d+\.|-|\*)\s+', line):
                    step = re.sub(r'^(\d+\.|-|\*)\s+', '', line)
                    if step and len(step) > 5:  # Avoid empty or very short lines
                        steps.append(step)
    
    return steps[:10]  # Limit to first 10 steps


def extract_technologies(readme: str, languages: List[str]) -> List[str]:
    """Extract technologies/frameworks from README and languages."""
    technologies = set(languages)
    
    if not readme:
        return list(technologies)
    
    # Common technologies to look for
    tech_keywords = [
        'React', 'Vue', 'Angular', 'Flask', 'Django', 'FastAPI', 'Express',
        'Node.js', 'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Docker',
        'TensorFlow', 'PyTorch', 'Keras', 'scikit-learn', 'pandas', 'NumPy',
        'Bootstrap', 'Tailwind', 'Material-UI', 'jQuery', 'TypeScript',
        'Arduino', 'Raspberry Pi', 'ESP32', 'IoT', 'MQTT'
    ]
    
    readme_lower = readme.lower()
    for tech in tech_keywords:
        if tech.lower() in readme_lower:
            technologies.add(tech)
    
    return list(technologies)


def process_repository(repo: Dict) -> Dict:
    """Process a single repository and extract all relevant information."""
    repo_name = repo["name"]
    repo_full_name = repo["full_name"]
    
    print(f"Processing: {repo_name}")
    
    # Fetch README
    readme = fetch_readme(repo_full_name)
    
    # Extract languages
    languages = []
    if repo.get("language"):
        languages.append(repo["language"])
    
    # Get additional languages from API
    languages_url = repo.get("languages_url")
    if languages_url:
        lang_response = requests.get(languages_url, headers=get_headers())
        if lang_response.status_code == 200:
            lang_data = lang_response.json()
            languages.extend([lang for lang in lang_data.keys() if lang not in languages])
    
    # Extract topics (tags)
    topics = repo.get("topics", [])
    
    # Process README content
    setup_steps = extract_setup_steps(readme) if readme else []
    technologies = extract_technologies(readme, languages)
    difficulty = extract_difficulty(readme)
    estimated_time = extract_estimated_time(readme)
    
    # Build project data
    project_data = {
        "name": repo_name,
        "title": repo_name.replace('-', ' ').replace('_', ' ').title(),
        "description": repo.get("description") or "No description available",
        "repo_url": repo["html_url"],
        "demo_url": repo.get("homepage") or None,
        "languages": languages[:5],  # Limit to top 5 languages
        "topics": topics,
        "difficulty": difficulty,
        "estimated_time": estimated_time,
        "readme_content": readme or "No README available",
        "setup_steps": setup_steps,
        "technologies": technologies[:10],  # Limit to 10 technologies
        "stars": repo.get("stargazers_count", 0),
        "forks": repo.get("forks_count", 0),
        "last_updated": repo.get("updated_at", ""),
        "created_at": repo.get("created_at", ""),
        "default_branch": repo.get("default_branch", "main")
    }
    
    return project_data


def main():
    """Main function to fetch and process all repositories."""
    print(f"\n{'='*60}")
    print(f"GitHub Organization Project Fetcher")
    print(f"Organization: {ORG_NAME}")
    print(f"{'='*60}\n")
    
    # Fetch repositories
    repos = fetch_organization_repos(ORG_NAME)
    
    if not repos:
        print("No repositories found or error occurred.")
        return
    
    # Process each repository
    projects = []
    for repo in repos:
        try:
            project_data = process_repository(repo)
            projects.append(project_data)
        except Exception as e:
            print(f"Error processing {repo['name']}: {e}")
            continue
    
    # Create output data structure
    output_data = {
        "generated_at": datetime.now().isoformat(),
        "organization": ORG_NAME,
        "total_projects": len(projects),
        "projects": projects
    }
    
    # Ensure _data directory exists
    import os
    os.makedirs("_data", exist_ok=True)
    
    # Write to JSON file
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n{'='*60}")
    print(f"✅ Successfully processed {len(projects)} projects")
    print(f"📁 Output saved to: {OUTPUT_FILE}")
    print(f"{'='*60}\n")
    
    # Print summary
    print("Summary by Language:")
    lang_count = {}
    for project in projects:
        for lang in project["languages"]:
            lang_count[lang] = lang_count.get(lang, 0) + 1
    
    for lang, count in sorted(lang_count.items(), key=lambda x: x[1], reverse=True):
        print(f"  {lang}: {count}")


if __name__ == "__main__":
    main()