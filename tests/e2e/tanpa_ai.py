"""Without ANTHROPIC_API_KEY: AI entry points are hidden, a receipt photo is still kept as an attachment.

Run against a server started without ANTHROPIC_API_KEY (mock Supabase on :54321, app on :3100).
"""

import os
import re
import sys
import tempfile

from PIL import Image
from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:3100")
log: list[str] = []
console_errors: list[str] = []

DRAFT = {
    "version": 1,
    "household": {"name": "Keluarga Tanpa AI", "ownerName": "Ayah", "status": "menikah", "emergencyTargetMonths": 6, "allocationPct": 10},
    "accounts": [{"id": "a1", "name": "Dompet", "kind": "tunai", "balance": 500_000, "isEmergency": False}],
    "incomes": [{"id": "i1", "name": "Gaji", "earner": "", "amount": 10_000_000}],
    "expenses": [{"id": "e1", "category": "Rumah tangga & makan", "amount": 3_000_000, "isRoutine": True}],
    "debts": [],
    "assets": [],
    "reached": 7,
}

photo = os.path.join(tempfile.mkdtemp(), "struk.jpg")
Image.new("RGB", (600, 900), "white").save(photo, "JPEG")


def run(width: int, height: int, tag: str, email: str):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_context(viewport={"width": width, "height": height}).new_page()
        page.on("console", lambda m: m.type == "error" and console_errors.append(f"{page.url} {m.text}"))
        page.on("pageerror", lambda e: console_errors.append(f"{page.url} pageerror {e}"))

        page.goto(BASE + "/privasi")
        page.evaluate("d => localStorage.setItem('kas-keluarga.draft.v1', JSON.stringify(d))", DRAFT)
        page.goto(BASE + "/masuk?next=%2Fmulai%2Fsimpan")
        page.fill("#email", email)
        page.get_by_role("button", name="Kirim tautan masuk").click()
        expect(page.get_by_role("heading", name="Cek email Anda")).to_be_visible()
        page.goto(BASE + f"/auth/callback?code=code-{email}&next=%2Fmulai%2Fsimpan")
        page.wait_for_url("**/dashboard", timeout=20000)

        page.goto(BASE + "/transaksi")
        expect(page.get_by_role("link", name="Catat transaksi").first).to_be_visible()
        expect(page.get_by_role("link", name="Impor e-statement")).to_have_count(0)
        expect(page.get_by_role("link", name="Pindai struk")).to_have_count(0)
        page.get_by_role("link", name="Lampirkan struk").click()
        page.wait_for_url("**/transaksi/baru*")
        log.append(f"PASS [{tag}] list hides the import and scan buttons, offers Lampirkan struk")

        expect(page.get_by_role("heading", name="Lampirkan foto struk atau nota")).to_be_visible()
        expect(page.get_by_text(re.compile("Pengisian otomatis dari foto menyusul"))).to_be_visible()
        page.locator("#struk input[type=file]").set_input_files(photo)
        expect(page.get_by_role("status").filter(has_text="Foto tersimpan sebagai lampiran. Isi transaksinya di bawah.")).to_be_visible(timeout=15000)
        assert "ANTHROPIC" not in page.inner_text("body"), "technical key name shown to the family"
        log.append(f"PASS [{tag}] photo kept as attachment with a plain-language note")

        page.fill("#tx-amount", "45000")
        page.fill("#tx-desc", "Warung Bu Sri")
        page.get_by_role("button", name=re.compile("Simpan")).first.click()
        page.wait_for_url("**/transaksi?*")
        expect(page.get_by_role("link", name=re.compile("Warung Bu Sri.*Struk"))).to_be_visible()
        log.append(f"PASS [{tag}] manual transaction with the photo saves and is marked Struk")

        page.goto(BASE + "/transaksi/impor")
        expect(page.get_by_role("heading", name="Impor e-statement menyusul")).to_be_visible()
        expect(page.get_by_role("link", name="Catat manual")).to_be_visible()
        assert "ANTHROPIC" not in page.inner_text("body"), "technical key name shown on the import page"
        log.append(f"PASS [{tag}] direct visit to the import page explains it is coming later")
        browser.close()


run(1280, 900, "desktop", "noai.desktop@contoh.com")
run(375, 812, "mobile", "noai.mobile@contoh.com")
print("\n".join(log))
print(f"\nconsole errors: {len(console_errors)}")
for e in console_errors:
    print("  ", e)
sys.exit(1 if console_errors or len(log) != 8 else 0)
