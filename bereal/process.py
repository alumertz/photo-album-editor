import os
import re
import json
import sys
import shutil
import piexif
from datetime import datetime


def _decimal_to_dms(value):
    d = int(abs(value))
    m = int((abs(value) - d) * 60)
    s = round(((abs(value) - d) * 60 - m) * 60 * 10000)
    return ((d, 1), (m, 1), (s, 10000))


def _write_exif(path, dt, location=None):
    try:
        exif_dict = {"0th": {}, "Exif": {}, "GPS": {}}

        dt_str = dt.strftime("%Y:%m:%d %H:%M:%S")
        exif_dict["0th"][piexif.ImageIFD.DateTime] = dt_str.encode()
        exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal] = dt_str.encode()
        exif_dict["Exif"][piexif.ExifIFD.DateTimeDigitized] = dt_str.encode()

        if location:
            lat = location.get("latitude")
            lon = location.get("longitude")
            if lat is not None and lon is not None:
                exif_dict["GPS"][piexif.GPSIFD.GPSLatitudeRef] = b"N" if lat >= 0 else b"S"
                exif_dict["GPS"][piexif.GPSIFD.GPSLatitude] = _decimal_to_dms(lat)
                exif_dict["GPS"][piexif.GPSIFD.GPSLongitudeRef] = b"E" if lon >= 0 else b"W"
                exif_dict["GPS"][piexif.GPSIFD.GPSLongitude] = _decimal_to_dms(lon)

        piexif.insert(piexif.dump(exif_dict), path)
    except Exception as e:
        print(f"⚠️ Erro ao escrever EXIF em {path}: {e}")


def _strip_copy_suffix(filename):
    return re.sub(r"( copy( \d+)?)(\.(?:jpg|jpeg|webp|png))$", r"\3", filename, flags=re.IGNORECASE)


def process_bereal(bereal_folder):
    json_file = os.path.join(bereal_folder, "posts.json")
    photos_base = os.path.join(bereal_folder, "Photos")
    output_dir = os.path.join(bereal_folder, "processed")

    os.makedirs(output_dir, exist_ok=True)

    with open(json_file, "r", encoding="utf-8") as f:
        posts = json.load(f)

    lookup = {}
    for post in posts:
        taken_at = post.get("takenAt")
        if not taken_at:
            continue

        dt = datetime.fromisoformat(taken_at.replace("Z", ""))
        timestamp = dt.strftime("%Y-%m-%dT%H:%M:%S")
        location = post.get("location")

        primary_file = os.path.basename(post["primary"]["path"])
        secondary_file = os.path.basename(post["secondary"]["path"])

        lookup[primary_file] = {"new_name": f"{timestamp}-1.jpg", "dt": dt, "location": location}
        lookup[secondary_file] = {"new_name": f"{timestamp}-2.jpg", "dt": dt, "location": location}

        bts = post.get("btsMedia")
        if bts and "path" in bts:
            video_file = os.path.basename(bts["path"])
            _, video_ext = os.path.splitext(video_file)
            lookup[video_file] = {"new_name": f"{timestamp}-3{video_ext}", "dt": dt, "location": None}

    count = 0
    for subdir in ["bereal", "post"]:
        src_dir = os.path.join(photos_base, subdir)
        if not os.path.isdir(src_dir):
            print(f"Pasta não encontrada: {src_dir}")
            continue

        for filename in os.listdir(src_dir):
            canonical = _strip_copy_suffix(filename)
            entry = lookup.get(canonical) or lookup.get(filename)

            if not entry:
                print(f"Não encontrado no JSON: {filename}")
                continue

            src_path = os.path.join(src_dir, filename)
            dst_path = os.path.join(output_dir, entry["new_name"])

            if os.path.exists(dst_path):
                print(f"⚠️ Já existe: {dst_path}, pulando")
                continue

            shutil.copy2(src_path, dst_path)

            if dst_path.lower().endswith(".jpg"):
                _write_exif(dst_path, entry["dt"], entry["location"])

            print(f"✓ {filename} -> {entry['new_name']}")
            count += 1

    print(f"\nTotal: {count} arquivos copiados para {output_dir}")
    return output_dir


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python3 process.py <bereal_folder>")
        sys.exit(1)
    process_bereal(sys.argv[1])
