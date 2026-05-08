import os
import re
import json
from datetime import datetime


def clean_copies(photos_dir="./selected"):
    print("\n=== Limpando cópias ===")
    for filename in os.listdir(photos_dir):
        if not filename.lower().endswith(".webp"):
            continue

        new_name = re.sub(r"( copy( \d+)?)\.webp$", "", filename, flags=re.IGNORECASE)

        if new_name != filename:
            old_path = os.path.join(photos_dir, filename)
            new_path = os.path.join(photos_dir, new_name)

            if os.path.exists(new_path):
                print(f"⚠️ Já existe: {new_path}, pulando {filename}")
            else:
                print(f"Renomeando {filename} -> {new_name}")
                os.rename(old_path, new_path)


def fix_extension(photos_dir="./Photos/post/selected"):
    print("\n=== Corrigindo extensões ===")
    for filename in os.listdir(photos_dir):
        if "." not in filename:
            old_path = os.path.join(photos_dir, filename)
            new_path = os.path.join(photos_dir, filename + ".webp")

            if os.path.exists(new_path):
                print(f"⚠️ Já existe: {new_path}, pulando {filename}")
            else:
                print(f"Adicionando extensão: {filename} -> {new_path}")
                os.rename(old_path, new_path)


def rename_by_timestamp(json_file="posts.json", photos_dir="./Photos/bereal"):
    print("\n=== Renomeando por timestamp ===")
    with open(json_file, "r", encoding="utf-8") as f:
        posts = json.load(f)

    lookup = {}

    for post in posts:
        taken_at = post.get("takenAt")
        if not taken_at:
            continue

        dt = datetime.fromisoformat(taken_at.replace("Z", ""))
        timestamp = dt.strftime("%Y-%m-%dT%H:%M:%S")

        primary_file = os.path.basename(post["primary"]["path"])
        secondary_file = os.path.basename(post["secondary"]["path"])

        _, primary_ext = os.path.splitext(primary_file)
        _, secondary_ext = os.path.splitext(secondary_file)

        lookup[primary_file] = f"{timestamp}-1{primary_ext}"
        lookup[secondary_file] = f"{timestamp}-2{secondary_ext}"

        bts = post.get("btsMedia")
        if bts and "path" in bts:
            video_file = os.path.basename(bts["path"])
            _, video_ext = os.path.splitext(video_file)
            lookup[video_file] = f"{timestamp}-3{video_ext}"

    for filename in os.listdir(photos_dir):
        if filename.startswith("202"):
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


if __name__ == "__main__":
    clean_copies()
    fix_extension()
    rename_by_timestamp()
