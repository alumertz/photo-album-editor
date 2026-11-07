import os
import re
import json
import sys
import piexif
from PIL import Image
from datetime import datetime


def _decimal_to_dms(value):
    d = int(abs(value))
    m = int((abs(value) - d) * 60)
    s = round(((abs(value) - d) * 60 - m) * 60 * 10000)
    return ((d, 1), (m, 1), (s, 10000))


def _write_exif(path, dt, location=None):
    try:
        try:
            exif_dict = piexif.load(path)
        except Exception:
            exif_dict = {"0th": {}, "Exif": {}, "GPS": {}, "1st": {}}

        dt_str = dt.strftime("%Y:%m:%d %H:%M:%S")
        exif_dict["0th"][piexif.ImageIFD.DateTime] = dt_str.encode()
        exif_dict.setdefault("Exif", {})[piexif.ExifIFD.DateTimeOriginal] = dt_str.encode()
        exif_dict["Exif"][piexif.ExifIFD.DateTimeDigitized] = dt_str.encode()

        if location:
            lat = location.get("latitude")
            lon = location.get("longitude")
            if lat is not None and lon is not None:
                exif_dict["GPS"] = {
                    piexif.GPSIFD.GPSLatitudeRef: b"N" if lat >= 0 else b"S",
                    piexif.GPSIFD.GPSLatitude: _decimal_to_dms(lat),
                    piexif.GPSIFD.GPSLongitudeRef: b"E" if lon >= 0 else b"W",
                    piexif.GPSIFD.GPSLongitude: _decimal_to_dms(lon),
                }

        piexif.insert(piexif.dump(exif_dict), path)
    except Exception as e:
        _emit("log", {"message": f"EXIF write failed for {os.path.basename(path)}: {e}"})


def _strip_copy_suffix(filename):
    return re.sub(r"( copy( \d+)?)(\.(?:jpg|jpeg|webp|png))$", r"\3", filename, flags=re.IGNORECASE)


def _emit(type, data):
    print(json.dumps({"type": type, **data}), flush=True)


def process_bereal(bereal_folder):
    json_file = os.path.join(bereal_folder, "posts.json")
    photos_base = os.path.join(bereal_folder, "Photos")

    with open(json_file, "r", encoding="utf-8") as f:
        posts = json.load(f)

    lookup = {}
    lookup_by_stem = {}  # fallback for extension mismatches (e.g. .jpg in JSON but .webp on disk)

    def _add_to_lookup(filename, new_stem, dt, location):
        if filename not in lookup:
            lookup[filename] = {"new_stem": new_stem, "dt": dt, "location": location}
        stem = os.path.splitext(filename)[0]
        if stem not in lookup_by_stem:
            lookup_by_stem[stem] = lookup[filename]

    memories_file = os.path.join(bereal_folder, "memories.json")
    if os.path.isfile(memories_file):
        with open(memories_file, "r", encoding="utf-8") as f:
            memories = json.load(f)
        for mem in memories:
            taken_at = mem.get("takenTime") or mem.get("date")
            if not taken_at:
                continue
            dt = datetime.fromisoformat(taken_at.replace("Z", ""))
            timestamp = dt.strftime("%Y-%m-%dT%H:%M:%S")
            location = mem.get("location")
            front = mem.get("frontImage", {})
            back = mem.get("backImage", {})
            if back.get("path"):
                _add_to_lookup(os.path.basename(back["path"]), f"{timestamp}-1", dt, location)
            if front.get("path"):
                _add_to_lookup(os.path.basename(front["path"]), f"{timestamp}-2", dt, location)
            primary_ph = mem.get("primaryPlaceholder", {})
            secondary_ph = mem.get("secondaryPlaceholder", {})
            if primary_ph.get("path"):
                _add_to_lookup(os.path.basename(primary_ph["path"]), f"{timestamp}-1", dt, location)
            if secondary_ph.get("path"):
                _add_to_lookup(os.path.basename(secondary_ph["path"]), f"{timestamp}-2", dt, location)
            bts = mem.get("btsMedia")
            if bts and bts.get("path"):
                _add_to_lookup(os.path.basename(bts["path"]), f"{timestamp}-3", dt, None)

    for post in posts:
        taken_at = post.get("takenAt")
        if not taken_at:
            continue
        dt = datetime.fromisoformat(taken_at.replace("Z", ""))
        timestamp = dt.strftime("%Y-%m-%dT%H:%M:%S")
        location = post.get("location")
        primary_file = os.path.basename(post["primary"]["path"])
        secondary_file = os.path.basename(post["secondary"]["path"])
        _add_to_lookup(primary_file, f"{timestamp}-1", dt, location)
        _add_to_lookup(secondary_file, f"{timestamp}-2", dt, location)
        bts = post.get("btsMedia")
        if bts and "path" in bts:
            _add_to_lookup(os.path.basename(bts["path"]), f"{timestamp}-3", dt, None)

    # Collect all files to process so we can report total upfront
    queue = []
    unmatched = []
    for subdir in ["bereal", "post"]:
        src_dir = os.path.join(photos_base, subdir)
        if not os.path.isdir(src_dir):
            continue
        for filename in os.listdir(src_dir):
            if filename.startswith('.'):
                continue
            if not os.path.isfile(os.path.join(src_dir, filename)):
                continue
            if filename[:3] == '202':
                continue
            canonical = _strip_copy_suffix(filename)
            stem = os.path.splitext(canonical)[0]
            clean_stem = re.sub(r'-(secondary|primary)$', '', stem, flags=re.IGNORECASE)
            entry = lookup.get(canonical) or lookup.get(filename) or lookup_by_stem.get(stem) or lookup_by_stem.get(clean_stem)
            if not entry:
                unmatched.append(filename)
                continue
            queue.append((src_dir, filename, entry))

    _emit("total", {"count": len(queue)})

    used_names = set()
    for i, (src_dir, filename, entry) in enumerate(queue):
        _, actual_ext = os.path.splitext(filename)
        new_ext = actual_ext if actual_ext.lower() == '.mp4' else '.jpg'
        base_name = entry["new_stem"] + new_ext
        new_name = base_name
        # Avoid collisions when multiple files share the same stem
        counter = 1
        while new_name in used_names or (new_name != filename and os.path.exists(os.path.join(src_dir, new_name))):
            stem_part, ext_part = os.path.splitext(base_name)
            new_name = f"{stem_part}-{counter}{ext_part}"
            counter += 1
        used_names.add(new_name)

        src_path = os.path.join(src_dir, filename)
        dst_path = os.path.join(src_dir, new_name)

        if src_path != dst_path:
            _, src_ext = os.path.splitext(src_path)
            if src_ext.lower() != '.jpg' and dst_path.lower().endswith('.jpg'):
                # Convert to actual JPEG so piexif can write EXIF
                with Image.open(src_path) as img:
                    if img.mode in ('RGBA', 'P', 'LA'):
                        img = img.convert('RGB')
                    img.save(dst_path, 'JPEG', quality=95)
                os.remove(src_path)
            else:
                os.rename(src_path, dst_path)
            if dst_path.lower().endswith('.jpg') or dst_path.lower().endswith('.jpeg'):
                _write_exif(dst_path, entry["dt"], entry["location"])

        _emit("progress", {"current": i + 1, "filename": filename})

    _emit("done", {"skipped": unmatched})


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"type": "error", "message": "Uso: python3 process.py <bereal_folder>"}), flush=True)
        sys.exit(1)
    process_bereal(sys.argv[1])
