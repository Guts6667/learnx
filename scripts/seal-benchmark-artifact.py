#!/usr/bin/env python3
"""Canonical hash for benchmark artefacts (V4.5-210).

The recipe, stated once so anyone can recompute it: JSON with sort_keys=True,
separators=(',',':'), ensure_ascii=False, UTF-8, with `contentHash` itself
excluded from the preimage. Prints the hash and preimage length; with --stamp
it writes the hash back into the file.
"""
import hashlib
import json
import sys


def canonical(doc: dict) -> bytes:
    body = {k: v for k, v in doc.items() if k != "contentHash"}
    return json.dumps(
        body, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    stamp = "--stamp" in sys.argv
    ok = True
    for path in args:
        with open(path, encoding="utf-8") as handle:
            doc = json.load(handle)
        pre = canonical(doc)
        digest = "sha256:" + hashlib.sha256(pre).hexdigest()
        published = doc.get("contentHash")
        state = "NON SCELLÉ"
        if published == digest:
            state = "concorde"
        elif published:
            state = f"DIVERGE (publié {published})"
            ok = False
        if stamp:
            doc["contentHash"] = digest
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(doc, handle, indent=2, ensure_ascii=False, sort_keys=True)
                handle.write("\n")
            state = "scellé"
        print(f"{digest}  {len(pre):>7} octets  {state:<24} {path}")
    return 0 if ok else 1


sys.exit(main())
