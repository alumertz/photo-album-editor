import os
import re

photos_dir = "./selected"

for filename in os.listdir(photos_dir):
    print(f"Analisando: {filename}")
    # Pega apenas arquivos .jpg (ou ajuste se tiver outros formatos)
    if not filename.lower().endswith(".webp"):
        continue

    # Remove padrões tipo " copy" ou " copy 2" antes da extensão
    new_name = re.sub(r"( copy( \d+)?)\.webp$", "", filename, flags=re.IGNORECASE)

    if new_name != filename:
        old_path = os.path.join(photos_dir, filename)
        new_path = os.path.join(photos_dir, new_name)

        # Se já existe o arquivo com o nome novo, evitar sobrescrever
        if os.path.exists(new_path):
            print(f"⚠️ Já existe: {new_path}, pulando {filename}")
        else:
            print(f"Renomeando {filename} -> {new_name}")
            os.rename(old_path, new_path)
