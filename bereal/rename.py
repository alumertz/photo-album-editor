import json
import os
from datetime import datetime

# Arquivos e pastas
json_file = "posts.json"
photos_dir = "./Photos/bereal"

# Carrega posts.json
with open(json_file, "r", encoding="utf-8") as f:
    posts = json.load(f)

# Cria um dicionário para lookup rápido: filename -> novo_nome
lookup = {}

for post in posts:
    taken_at = post.get("takenAt")
    if not taken_at:
        continue

    # Normaliza timestamp
    dt = datetime.fromisoformat(taken_at.replace("Z", ""))
    timestamp = dt.strftime("%Y-%m-%dT%H:%M:%S")

    primary_file = os.path.basename(post["primary"]["path"])
    secondary_file = os.path.basename(post["secondary"]["path"])

    # Pega extensão do arquivo original (.jpg, .webp,)
    _, primary_ext = os.path.splitext(primary_file)
    _, secondary_ext = os.path.splitext(secondary_file)

    lookup[primary_file] = f"{timestamp}-1{primary_ext}"
    lookup[secondary_file] = f"{timestamp}-2{secondary_ext}"

    bts = post.get("btsMedia")
    if bts and "path" in bts:
        video_file = os.path.basename(bts["path"])
        _, video_ext = os.path.splitext(video_file)
        lookup[video_file] = f"{timestamp}-3{video_ext}"

# Agora percorre os arquivos da pasta e renomeia se estiver no lookup
for filename in os.listdir(photos_dir):
    # Se já começa com 2024, pula
    if filename.startswith("202"):
        #print(f"⏩ Pulando {filename} (já renomeado)")
        continue

    if filename in lookup:
        old_path = os.path.join(photos_dir, filename)
        new_path = os.path.join(photos_dir, lookup[filename])

        if os.path.exists(new_path):
            print(f"⚠️ Já existe: {new_path}, pulando {filename}")
        else:
            print(f"Renomeando {filename} -> {os.path.basename(new_path)}")
            os.rename(old_path, new_path)
    else:
        print(f"Arquivo {filename} não encontrado no JSON")
