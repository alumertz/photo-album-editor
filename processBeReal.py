import os
import re
import json
import piexif
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

    for filename in os.listdir(photos_dir):
        if filename.startswith("202"):
            continue

        if filename not in lookup:
            print(f"Arquivo {filename} não encontrado no JSON")
            continue

        entry = lookup[filename]
        old_path = os.path.join(photos_dir, filename)
        new_path = os.path.join(photos_dir, entry["new_name"])

        if os.path.exists(new_path):
            print(f"⚠️ Já existe: {new_path}, pulando {filename}")
            continue

        print(f"Renomeando {filename} -> {entry['new_name']}")
        os.rename(old_path, new_path)

        if new_path.lower().endswith(".jpg"):
            _write_exif(new_path, entry["dt"], entry["location"])


if __name__ == "__main__":
    #clean_copies()
    rename_by_timestamp()
