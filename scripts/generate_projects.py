import json
import os

# Paths
base_dir = r"c:\Users\Hello\Desktop\web\gksolutions33.github.io"
json_path = os.path.join(base_dir, "_data", "projects.json")
output_dir = os.path.join(base_dir, "projects")

def generate_project_pages():
    try:
        # Create projects directory if it doesn't exist
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            print(f"Created directory: {output_dir}")

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            projects = data.get("projects", [])

        print(f"Found {len(projects)} projects.")

        for i, project in enumerate(projects, 1):
            filename = f"project-{i}.html"
            filepath = os.path.join(output_dir, filename)
            
            # Prepare front matter fields
            title = project.get("title", "").replace('"', '\\"')
            desc = project.get("description", "").replace('"', '\\"')
            repo = project.get("repo_url", "")
            diff = project.get("difficulty", "intermediate")
            time = project.get("estimated_time", "Varies")
            stars = project.get("stars", 0)
            forks = project.get("forks", 0)
            
            # Handle lists (languages/technologies)
            langs = project.get("languages", [])
            techs = project.get("technologies", [])
            
            # Content
            readme = project.get("readme_content", "No description available.")
            
            # Construct file content
            content = ["---", "layout: project"]
            content.append(f'project_title: "{title}"')
            content.append(f'description: "{desc}"')
            content.append(f'repo_url: "{repo}"')
            content.append(f'difficulty: "{diff}"')
            content.append(f'estimated_time: "{time}"')
            content.append(f'stars: {stars}')
            content.append(f'forks: {forks}')
            
            if langs:
                content.append("languages:")
                for l in langs:
                    content.append(f"- {l}")
            else:
                content.append("languages: []")

            if techs:
                content.append("technologies:")
                for t in techs:
                    content.append(f"- {t}")
            else:
                content.append("technologies: []")
                
            content.append("---\n")
            content.append(readme)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write("\n".join(content))
            
            print(f"Generated {filename}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    generate_project_pages()
