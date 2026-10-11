"""Click-through of navigation, transactions, receipt scan, e-statement import and budgets, desktop then phone width.

Run with tests/e2e/mock-supabase.mjs on :54321 and `next start -p 3100` built with
ANTHROPIC_API_KEY=test and ANTHROPIC_BASE_URL=http://127.0.0.1:54321.
"""
import io
import json
import os
import re
import sys
import tempfile

from PIL import Image, ImageDraw
from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:3100")
OUT = os.environ.get("OUT", ".")
log: list[str] = []
console_errors: list[str] = []
TMP = tempfile.mkdtemp()


def ok(msg: str) -> None:
    log.append(f"PASS {msg}")


def fixture_files():
    img = Image.new("RGB", (900, 1400), "white")
    d = ImageDraw.Draw(img)
    for i, line in enumerate(["SUPERINDO CIBUBUR", "Beras 5kg   78.000", "Minyak 2L   39.500", "TOTAL      287.500"]):
        d.text((60, 80 + i * 60), line, fill="black")
    receipt = os.path.join(TMP, "struk.jpg")
    img.save(receipt, "JPEG")
    pdf = os.path.join(TMP, "mutasi.pdf")
    with open(pdf, "wb") as f:
        f.write(b"%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n")
    locked = os.path.join(TMP, "terkunci.pdf")
    with open(locked, "wb") as f:
        f.write(b"%PDF-1.6\n1 0 obj <<>> endobj\ntrailer << /Encrypt 5 0 R >>\n%%EOF\n")
    notpdf = os.path.join(TMP, "bukan.pdf")
    with open(notpdf, "wb") as f:
        f.write(b"hello")
    return receipt, pdf, locked, notpdf


RECEIPT, PDF, LOCKED, NOTPDF = fixture_files()


def draft():
    return {
        "version": 1,
        "household": {"name": "Keluarga Uji", "ownerName": "Ibu", "status": "menikah", "emergencyTargetMonths": 6, "allocationPct": 10},
        "accounts": [
            {"id": "a1", "name": "BSI Tabungan", "kind": "tabungan", "balance": 10_000_000, "isEmergency": True},
            {"id": "a2", "name": "Dompet", "kind": "tunai", "balance": 500_000, "isEmergency": False},
        ],
        "incomes": [{"id": "i1", "name": "Gaji", "earner": "", "amount": 15_000_000}],
        "expenses": [
            {"id": "e1", "category": "Rumah tangga & makan", "amount": 4_000_000, "isRoutine": True},
            {"id": "e2", "category": "Transportasi", "amount": 1_000_000, "isRoutine": True},
        ],
        "debts": [],
        "assets": [],
        "reached": 7,
    }


def attach(page):
    def on_console(m):
        # The import test uploads a non-PDF (415) and a locked PDF (422) on purpose.
        expected = "/transaksi/impor" in page.url and re.search(r"status of (415|422)", m.text)
        if m.type == "error" and not expected:
            console_errors.append(f"{page.url} {m.text}")
    page.on("console", on_console)
    page.on("pageerror", lambda e: console_errors.append(f"{page.url} pageerror {e}"))


def no_overflow(page, label: str):
    w = page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    assert w[0] <= w[1], f"{label}: horizontal overflow {w}"
    small = page.evaluate(
        """() => [...document.querySelectorAll('button, a, input, select, textarea')]
        .filter(e => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden' && !e.classList.contains('sr-only'))
        .map(e => { const hit = ['checkbox', 'radio'].includes(e.type) ? (e.closest('label') || e) : e; const r = hit.getBoundingClientRect(); return {t: (e.innerText || e.getAttribute('aria-label') || e.id || e.name || '').trim().slice(0, 40), h: r.height, w: r.width}; })
        .filter(r => r.h < 44 || r.w < 44)"""
    )
    assert not small, f"{label}: targets under 44px {small}"
    ok(f"{label}: no horizontal overflow, every control at least 44x44")


def money(text: str) -> re.Pattern:
    return re.compile(r"Rp\s?" + re.escape(text))


def run(width: int, height: int, tag: str, email: str):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": width, "height": height})
        page = ctx.new_page()
        attach(page)
        wide = width >= 820

        # Seeded from a page that never writes the draft, so the wizard cannot overwrite it while hydrating.
        page.goto(BASE + "/privasi")
        page.evaluate("d => localStorage.setItem('kas-keluarga.draft.v1', JSON.stringify(d))", draft())
        page.goto(BASE + "/masuk?next=%2Fmulai%2Fsimpan")
        page.fill("#email", email)
        page.get_by_role("button", name="Kirim tautan masuk").click()
        expect(page.get_by_role("heading", name="Cek email Anda")).to_be_visible()
        page.goto(BASE + f"/auth/callback?code=code-{email}&next=%2Fmulai%2Fsimpan")
        page.wait_for_url("**/dashboard", timeout=20000)
        ok(f"[{tag}] seeded a household through the real save flow")

        nav = page.get_by_role("navigation", name="Menu utama")
        expect(nav.get_by_role("link", name="Dashboard")).to_have_attribute("aria-current", "page")
        expect(page.get_by_text("Belum ada transaksi tercatat bulan ini.")).to_be_visible()
        expect(page.get_by_text(re.compile("Belum ada batas pengeluaran"))).to_be_visible()
        ok(f"[{tag}] dashboard shows empty month and empty budget states")
        no_overflow(page, f"[{tag}] dashboard")

        nav.get_by_role("link", name="Transaksi").click()
        page.wait_for_url("**/transaksi")
        expect(nav.get_by_role("link", name="Transaksi")).to_have_attribute("aria-current", "page")
        expect(page.get_by_text(re.compile(r"Belum ada transaksi di "))).to_be_visible()
        saldo = page.get_by_role("complementary", name="Saldo rekening hari ini")
        expect(saldo).to_contain_text("BSI Tabungan")
        expect(saldo).to_contain_text("10.000.000")
        ok(f"[{tag}] nav to Transaksi, empty state, opening balances shown")
        page.screenshot(path=f"{OUT}/{tag}-tx-01-kosong.png", full_page=True)
        no_overflow(page, f"[{tag}] transaksi kosong")

        page.get_by_role("link", name="Catat transaksi").first.click()
        page.wait_for_url("**/transaksi/baru")
        page.get_by_role("button", name="Simpan transaksi").click()
        expect(page.locator("#tx-amount-error")).to_be_visible()
        expect(page.locator("#tx-desc-error")).to_be_visible()
        ok(f"[{tag}] empty transaction is rejected with field errors")
        page.fill("#tx-amount", "125000")
        expect(page.locator("#tx-amount")).to_have_value("125.000")
        page.fill("#tx-desc", "Bensin Pertamina")
        page.select_option("#tx-cat", "Transportasi")
        page.select_option("#tx-acc", label="Dompet")
        page.screenshot(path=f"{OUT}/{tag}-tx-02-form.png", full_page=True)
        no_overflow(page, f"[{tag}] form catat")
        page.get_by_role("button", name="Simpan transaksi").click()
        page.wait_for_url(re.compile(r"/transaksi\?bulan=\d{4}-\d{2}&tersimpan=baru"))
        expect(page.get_by_role("status").filter(has_text="Transaksi tersimpan.")).to_be_visible()
        expect(page.get_by_role("link", name=re.compile("Bensin Pertamina"))).to_be_visible()
        expect(saldo).to_contain_text("375.000")
        ok(f"[{tag}] manual expense saved, listed, and Dompet balance drops to Rp 375.000")

        page.get_by_role("link", name="Catat transaksi").first.click()
        page.wait_for_url("**/transaksi/baru")
        page.locator("label[for='tx-dir-masuk']").click()
        expect(page.locator("#tx-cat")).to_have_value("Gaji")
        page.fill("#tx-amount", "2000000")
        page.fill("#tx-desc", "Honor proyek")
        page.select_option("#tx-cat", "Usaha & sampingan")
        page.select_option("#tx-acc", label="BSI Tabungan")
        page.get_by_role("button", name="Simpan transaksi").click()
        page.wait_for_url(re.compile(r"tersimpan=baru"))
        expect(saldo).to_contain_text("12.000.000")
        ok(f"[{tag}] switching to income swaps the category list; income raises BSI to Rp 12.000.000")

        page.get_by_role("link", name="Pindai struk").click()
        page.wait_for_url("**/transaksi/baru#struk")
        page.locator("input[type=file][accept='image/*']").set_input_files(RECEIPT)
        expect(page.get_by_role("status").filter(has_text="Terisi: jumlah, tanggal, keterangan, kategori.")).to_be_visible(timeout=20000)
        expect(page.locator("#tx-amount")).to_have_value("287.500")
        expect(page.locator("#tx-desc")).to_have_value("Superindo Cibubur")
        expect(page.locator("#tx-cat")).to_have_value("Rumah tangga & makan")
        expect(page.locator("#tx-note")).to_have_value(re.compile("Beras 5kg"))
        expect(page.get_by_alt_text("Foto struk yang diunggah")).to_be_visible()
        ok(f"[{tag}] receipt photo is uploaded, read, and fills amount, date, shop, category and items")
        page.screenshot(path=f"{OUT}/{tag}-tx-03-struk.png", full_page=True)
        no_overflow(page, f"[{tag}] form dengan struk")
        page.select_option("#tx-acc", label="BSI Tabungan")
        page.get_by_role("button", name="Simpan transaksi").click()
        page.wait_for_url(re.compile(r"tersimpan=baru"))
        row = page.get_by_role("link", name=re.compile("Superindo Cibubur"))
        expect(row).to_contain_text("Struk")
        ok(f"[{tag}] scanned transaction saved and marked as Struk")

        row.click()
        page.wait_for_url(re.compile(r"/transaksi/[0-9a-f-]{36}$"))
        expect(page.get_by_role("heading", name="Ubah transaksi")).to_be_visible()
        expect(page.get_by_alt_text("Foto struk transaksi ini")).to_be_visible()
        loaded = page.evaluate("() => { const i = document.querySelector('img[alt=\"Foto struk transaksi ini\"]'); return i && i.complete && i.naturalWidth > 0; }")
        assert loaded, "receipt image did not load"
        ok(f"[{tag}] edit page shows the stored receipt through a signed URL")
        page.fill("#tx-amount", "290000")
        page.get_by_role("button", name="Simpan perubahan").click()
        page.wait_for_url(re.compile(r"tersimpan=ubah"))
        expect(page.get_by_role("status").filter(has_text="Perubahan tersimpan.")).to_be_visible()
        expect(page.get_by_role("link", name=re.compile("Superindo Cibubur"))).to_contain_text("290.000")
        ok(f"[{tag}] editing the amount updates the list")

        page.get_by_role("link", name=re.compile("Bensin Pertamina")).click()
        page.get_by_role("button", name="Hapus transaksi").click()
        dialog = page.get_by_role("dialog")
        expect(dialog).to_contain_text("Bensin Pertamina")
        page.keyboard.press("Escape")
        expect(dialog).to_be_hidden()
        page.get_by_role("button", name="Hapus transaksi").click()
        dialog.get_by_role("button", name="Hapus transaksi").click()
        page.wait_for_url(re.compile(r"tersimpan=hapus"))
        expect(page.get_by_role("link", name=re.compile("Bensin Pertamina"))).to_have_count(0)
        expect(saldo).to_contain_text("500.000")
        ok(f"[{tag}] delete asks by name, closes on Escape, then removes it and restores Dompet")

        page.fill("#f-q", "superindo")
        page.get_by_role("button", name="Saring").click()
        expect(page.get_by_role("link", name=re.compile("Superindo"))).to_be_visible()
        expect(page.get_by_role("link", name=re.compile("Honor proyek"))).to_have_count(0)
        page.fill("#f-q", "tidak-ada-yang-cocok")
        page.get_by_role("button", name="Saring").click()
        expect(page.get_by_text(re.compile("Tidak ada transaksi yang cocok"))).to_be_visible()
        page.get_by_role("link", name="Hapus filter").first.click()
        expect(page.get_by_role("link", name=re.compile("Honor proyek"))).to_be_visible()
        ok(f"[{tag}] search filter, filtered-empty state, and clear filter work")

        page.get_by_role("link", name=re.compile("Bulan sebelumnya")).click()
        expect(page.get_by_text(re.compile(r"Belum ada transaksi di "))).to_be_visible()
        page.get_by_role("link", name=re.compile("Bulan berikutnya")).click()
        expect(page.get_by_role("link", name=re.compile("Honor proyek"))).to_be_visible()
        ok(f"[{tag}] month navigation back and forward")

        page.get_by_role("link", name="Impor e-statement").click()
        page.wait_for_url("**/transaksi/impor")
        page.get_by_role("button", name="Baca e-statement").click()
        expect(page.locator("#imp-acc-error")).to_be_visible()
        expect(page.locator("#imp-acc")).to_be_focused()
        page.select_option("#imp-acc", label="BSI Tabungan")
        page.get_by_role("button", name="Baca e-statement").click()
        expect(page.locator("#imp-file-error")).to_be_visible()
        ok(f"[{tag}] import requires an account and a file, focusing the first missing one")
        page.set_input_files("#imp-file", NOTPDF)
        page.get_by_role("button", name="Baca e-statement").click()
        expect(page.get_by_role("alert").filter(has_text="bukan PDF")).to_be_visible()
        page.set_input_files("#imp-file", LOCKED)
        page.get_by_role("button", name="Baca e-statement").click()
        expect(page.get_by_role("alert").filter(has_text="dikunci kata sandi")).to_be_visible()
        ok(f"[{tag}] non-PDF and password-locked PDF are refused with a fix to try")
        no_overflow(page, f"[{tag}] impor pilih file")

        page.set_input_files("#imp-file", PDF)
        page.get_by_role("button", name="Baca e-statement").click()
        expect(page.get_by_role("heading", name="6 baris terbaca")).to_be_visible(timeout=30000)
        analysis = page.get_by_role("region", name=re.compile("Ke mana uang pergi"))
        expect(analysis).to_contain_text("15.000.000")
        expect(analysis).to_contain_text("3.950.000")
        expect(analysis).to_contain_text("Rumah tangga & makan")
        expect(analysis.get_by_text(re.compile(r"2× · Rp\s?50\.000"))).to_be_visible()
        ok(f"[{tag}] statement read: 6 rows, spending Rp 3.950.000 excludes the ATM withdrawal, repeat coffee grouped")
        page.screenshot(path=f"{OUT}/{tag}-tx-04-impor.png", full_page=True)
        no_overflow(page, f"[{tag}] impor tinjau")

        page.get_by_role("checkbox", name=re.compile("Simpan TARIK TUNAI ATM")).uncheck()
        page.get_by_role("combobox", name="Kategori untuk TOKEN PLN 5223").select_option("Lainnya")
        expect(page.get_by_role("button", name=re.compile("Simpan 5 transaksi ke BSI Tabungan"))).to_be_visible()
        page.get_by_role("button", name=re.compile("Simpan 5 transaksi")).click()
        page.wait_for_url(re.compile(r"tersimpan=impor&jumlah=5"), timeout=20000)
        expect(page.get_by_role("status").filter(has_text="5 transaksi dari e-statement tersimpan.")).to_be_visible()
        expect(page.get_by_role("link", name=re.compile("GAJI OKTOBER"))).to_contain_text("Dari e-statement")
        ok(f"[{tag}] unchecked row skipped, edited category kept, 5 rows imported")

        page.get_by_role("link", name="Impor e-statement").click()
        page.select_option("#imp-acc", label="BSI Tabungan")
        page.set_input_files("#imp-file", PDF)
        page.get_by_role("button", name="Baca e-statement").click()
        expect(page.get_by_text("5 baris sudah pernah diimpor dan tidak dicentang.")).to_be_visible(timeout=30000)
        expect(page.get_by_role("button", name=re.compile("Simpan 1 transaksi"))).to_be_visible()
        ok(f"[{tag}] re-importing the same statement marks the 5 saved rows as duplicates")
        page.get_by_role("button", name="Pilih file lain").click()
        expect(page.get_by_role("button", name="Baca e-statement")).to_be_visible()

        page.get_by_role("navigation", name="Menu utama").get_by_role("link", name="Anggaran").click()
        page.wait_for_url("**/anggaran")
        expect(page.get_by_text(re.compile("Belum ada batas anggaran"))).to_be_visible()
        page.get_by_role("button", name="Isi dari pengeluaran di kondisi awal").click()
        expect(page.locator("#limit-0")).to_have_value("4.000.000")
        idx = page.evaluate("() => [...document.querySelectorAll('input[name^=cat-]')].findIndex(i => i.value === 'Transportasi')")
        expect(page.locator(f"#limit-{idx}")).to_have_value("1.000.000")
        page.fill("#limit-0", "3.500.000")
        ok(f"[{tag}] budget editor opens on first visit and prefills from the baseline routine spending")
        no_overflow(page, f"[{tag}] anggaran editor")
        page.get_by_role("button", name="Simpan anggaran").click()
        expect(page.get_by_role("status").filter(has_text="Anggaran tersimpan.")).to_be_visible()
        rumah = page.get_by_role("progressbar", name=re.compile("Rumah tangga & makan"))
        expect(rumah).to_have_attribute("aria-valuenow", "100")
        expect(page.get_by_text(re.compile(r"Lewat Rp\s?190\.000"))).to_be_visible()
        ok(f"[{tag}] saved budgets: Rumah tangga Rp 3.690.000 of 3.500.000 shows over by Rp 190.000")
        page.screenshot(path=f"{OUT}/{tag}-tx-05-anggaran.png", full_page=True)
        no_overflow(page, f"[{tag}] anggaran")

        page.get_by_role("button", name="Ubah batas anggaran").click()
        page.fill("#limit-0", "")
        page.get_by_role("button", name="Simpan anggaran").click()
        expect(page.get_by_role("status").filter(has_text="Anggaran tersimpan.")).to_be_visible()
        expect(page.get_by_role("progressbar", name=re.compile("Rumah tangga & makan"))).to_have_count(0)
        expect(page.get_by_role("heading", name="Belanja tanpa batas anggaran")).to_be_visible()
        ok(f"[{tag}] clearing a limit removes that budget; its spending moves to the unbudgeted list")

        page.get_by_role("navigation", name="Menu utama").get_by_role("link", name="Dashboard").click()
        page.wait_for_url("**/dashboard")
        month_card = page.get_by_role("region", name=re.compile("Uang keluar-masuk"))
        expect(month_card).to_contain_text("17.000.000")
        expect(page.get_by_role("region", name="Anggaran vs realisasi").get_by_role("progressbar")).to_have_count(1)
        ok(f"[{tag}] dashboard shows this month's in/out and the remaining budget")
        page.screenshot(path=f"{OUT}/{tag}-tx-06-dashboard.png", full_page=True)

        page.get_by_role("button", name="Perbarui kondisi awal").click()
        page.wait_for_url("**/mulai")
        if wide:
            page.get_by_role("navigation", name="Langkah isian").get_by_role("button", name="Rekening & kas").click()
        else:
            for _ in range(6):
                page.get_by_role("button", name="Kembali").click()
        expect(page.locator("input[id^='acc-'][id$='-name']").first).to_have_value("BSI Tabungan")
        page.locator("input[id^='acc-'][id$='-name']").first.fill("BSI Utama")
        if wide:
            page.get_by_role("navigation", name="Langkah isian").get_by_role("button", name="Ringkasan").click()
        else:
            for name in ["pemasukan", "pengeluaran", "dana darurat", "utang", "aset", "ringkasan"]:
                page.get_by_role("button", name=re.compile(f"Lanjut ke {name}")).click()
        page.get_by_role("button", name="Simpan kondisi awal").click()
        page.wait_for_url("**/dashboard", timeout=20000)
        page.get_by_role("navigation", name="Menu utama").get_by_role("link", name="Transaksi").click()
        expect(page.get_by_role("link", name=re.compile("GAJI OKTOBER"))).to_contain_text("BSI Utama")
        ok(f"[{tag}] renaming the account in the baseline keeps its transactions attached")

        page.keyboard.press("Tab")
        focused = page.evaluate("getComputedStyle(document.activeElement).outlineStyle")
        assert focused == "solid", focused
        ok(f"[{tag}] keyboard focus visible on app pages")

        browser.close()


run(1280, 900, "desktop", "tx.desktop@contoh.com")
run(375, 812, "mobile", "tx.mobile@contoh.com")

print("\n".join(log))
print(f"\nconsole errors: {len(console_errors)}")
for e in console_errors:
    print("  ", e)
with open(f"{OUT}/transaksi.json", "w") as f:
    json.dump({"passed": log, "console_errors": console_errors}, f, indent=2)
sys.exit(1 if console_errors else 0)
