import os

photos_dir = "./Photos/post/selected"

for filename in os.listdir(photos_dir):
    # verifica se o arquivo não tem extensão
    if "." not in filename:
        old_path = os.path.join(photos_dir, filename)
        new_path = os.path.join(photos_dir, filename + ".webp")

        if os.path.exists(new_path):
            print(f"⚠️ Já existe: {new_path}, pulando {filename}")
        else:
            print(f"Adicionando extensão: {filename} -> {new_path}")
            os.rename(old_path, new_path)
