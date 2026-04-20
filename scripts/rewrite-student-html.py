from pathlib import Path

def main():
    root = Path(__file__).resolve().parents[1]
    p = root / "student.html"
    lines = p.read_text(encoding="utf-8").splitlines(keepends=True)
    try:
        fuse_i = next(
            i
            for i, ln in enumerate(lines)
            if ln.strip().startswith("<script") and "fuse.js" in ln
        )
    except StopIteration:
        raise SystemExit("fuse script marker not found")
    out = []
    out.extend(lines[0:11])
    out.extend(lines[931:942])
    out.extend(lines[942:fuse_i])
    out.append(lines[fuse_i])
    out.append('<script type="module" src="/src/student/main.js"></script>\n')
    close_body = next(i for i in range(fuse_i, len(lines)) if lines[i].strip() == "</body>")
    out.extend(lines[close_body:])
    p.write_text("".join(out), encoding="utf-8")
    print("wrote", p, "lines", len(out))


if __name__ == "__main__":
    main()
