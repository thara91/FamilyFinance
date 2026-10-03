"""Click-through of every control on landing, wizard, login, save and dashboard, desktop then phone width.

Run with the mock Supabase (tests/e2e/mock-supabase.mjs) on :54321 and `next start -p 3100`.
"""
import json
import os
import re
import sys

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:3100")
OUT = os.environ.get("OUT", ".")
log: list[str] = []
console_errors: list[str] = []


def ok(msg: str) -> None:
    log.append(f"PASS {msg}")


def attach(page):
    def on_console(m):
        # The 404 check visits a missing page on purpose; its 404 response is expected.
        if m.type == "error" and not page.url.endswith("/tidak-ada"):
            console_errors.append(f"{page.url} {m.text}")
    page.on("console", on_console)
    page.on("pageerror", lambda e: console_errors.append(f"{page.url} pageerror {e}"))


def no_overflow(page, label: str):
    w = page.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
    assert w[0] <= w[1], f"{label}: horizontal overflow {w}"
    small = page.evaluate(
        """() => [...document.querySelectorAll('button, a, input, select')]
        .filter(e => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden')
        .map(e => { const hit = ['checkbox', 'radio'].includes(e.type) ? (e.closest('label') || e) : e; const r = hit.getBoundingClientRect(); return {t: (e.innerText || e.getAttribute('aria-label') || e.id || e.name || '').trim().slice(0, 40), h: r.height, w: r.width}; })
        .filter(r => r.h < 44 || r.w < 44)"""
    )
    assert not small, f"{label}: targets under 44px {small}"
    ok(f"{label}: no horizontal overflow, every control at least 44x44")


def money(page, field_id: str, value: str):
    page.fill(f"#{field_id}", value)


def run(width: int, height: int, tag: str, email: str):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": width, "height": height})
        page = ctx.new_page()
        attach(page)

        page.goto(BASE + "/")
        expect(page.get_by_role("heading", level=1)).to_contain_text("kondisi keuangan keluarga")
        expect(page.get_by_role("link", name="Isi kondisi keuangan awal")).to_be_visible()
        ok(f"[{tag}] landing renders, CTA visible")
        page.screenshot(path=f"{OUT}/{tag}-01-landing.png", full_page=True)
        no_overflow(page, f"[{tag}] landing")

        carry = page.get_by_role("button", name="Lanjutkan isian dengan angka ini")
        expect(carry).to_be_disabled()
        money(page, "qc-income", "20000000")
        money(page, "qc-spend", "8.000.000")
        money(page, "qc-inst", "7000000")
        expect(page.locator("#qc-income")).to_have_value("20.000.000")
        expect(page.get_by_text(re.compile(r"Rp\s?5\.000\.000")).first).to_be_visible()
        expect(page.get_by_text(re.compile(r"Cicilan 35%.*melewati batas 30%"))).to_be_visible()
        ok(f"[{tag}] quick check formats input and computes sisa Rp 5.000.000, ratio 35% flagged")
        carry.click()
        page.wait_for_url("**/mulai")
        ok(f"[{tag}] 'Lanjutkan isian dengan angka ini' -> /mulai")

        expect(page.get_by_role("heading", name="Keluarga", level=1)).to_be_visible()
        page.get_by_role("button", name=re.compile("Lanjut ke rekening")).click()
        expect(page.get_by_role("alert").filter(has_text="1 isian")).to_be_visible()
        expect(page.locator("#hh-name")).to_be_focused()
        expect(page.locator("#hh-name-error")).to_be_visible()
        ok(f"[{tag}] empty family name blocks next step, focus moves to the field, error shown")
        page.fill("#hh-name", "Keluarga Uji")
        expect(page.locator("#hh-name-error")).to_have_count(0)
        ok(f"[{tag}] error clears as soon as the field is filled")
        page.fill("#hh-owner", "Ayah")
        page.screenshot(path=f"{OUT}/{tag}-02-keluarga.png", full_page=True)
        no_overflow(page, f"[{tag}] wizard keluarga")
        page.get_by_role("button", name=re.compile("Lanjut ke rekening")).click()

        expect(page.get_by_role("heading", name="Rekening & kas", level=1)).to_be_visible()
        expect(page.get_by_role("heading", name="Rekening & kas", level=1)).to_be_focused()
        ok(f"[{tag}] step change moves focus to the step heading")
        first = page.locator("li").filter(has=page.locator("input[id$='-name']")).first
        first.locator("input[id$='-name']").fill("Rek. Utama")
        first.locator("input[id$='-bal']").fill("30000000")
        page.get_by_role("button", name="Tambah rekening").click()
        rows = page.locator("input[id^='acc-'][id$='-name']")
        expect(rows).to_have_count(2)
        rows.nth(1).fill("Dompet")
        page.locator("select[id^='acc-']").nth(1).select_option("tunai")
        page.locator("input[id^='acc-'][id$='-bal']").nth(1).fill("500000")
        page.get_by_role("button", name="Tambah rekening").click()
        page.get_by_role("button", name="Hapus rekening 3").click()
        expect(rows).to_have_count(2)
        ok(f"[{tag}] add row, fill, add another and delete it works")
        expect(page.get_by_text(re.compile(r"Rp\s?30\.500\.000")).first).to_be_visible()
        ok(f"[{tag}] running totals update (kas Rp 30.500.000)")
        page.screenshot(path=f"{OUT}/{tag}-03-rekening.png", full_page=True)
        no_overflow(page, f"[{tag}] wizard rekening")
        page.get_by_role("button", name=re.compile("Lanjut ke pemasukan")).click()

        expect(page.locator("input[id^='inc-'][id$='-name']").first).to_have_value("Pemasukan bulanan")
        expect(page.locator("input[id^='inc-'][id$='-amt']").first).to_have_value("20.000.000")
        ok(f"[{tag}] quick check income carried into the wizard")
        page.locator("input[id^='inc-'][id$='-name']").first.fill("Gaji")
        page.get_by_role("button", name=re.compile("Lanjut ke pengeluaran")).click()

        expect(page.get_by_text("Total pengeluaran (rincikan nanti)")).to_have_count(0)
        expect(page.locator("input[value='Total pengeluaran (rincikan nanti)']")).to_have_count(1)
        hib = page.locator("li").filter(has=page.locator("input[value='Hiburan & makan di luar']"))
        expect(hib.get_by_role("checkbox")).not_to_be_checked()
        expect(page.locator("li").filter(has=page.locator("input[value='Rumah tangga & makan']")).get_by_role("checkbox")).to_be_checked()
        hib.locator("input[id$='-amt']").fill("1000000")
        expect(page.get_by_text(re.compile(r"Rutin Rp\s?8\.000\.000"))).to_be_visible()
        ok(f"[{tag}] needs are pre-checked as routine, entertainment is not; routine total excludes it")
        page.get_by_role("button", name=re.compile("Lanjut ke dana darurat")).click()

        expect(page.get_by_role("heading", name="Dana darurat", level=1)).to_be_visible()
        page.get_by_role("button", name=re.compile("Lanjut ke utang")).click()
        expect(page.get_by_text("Pilih status yang paling sesuai.")).to_be_visible()
        expect(page.locator("#ef-status-freelance")).to_be_focused()
        ok(f"[{tag}] status is required, focus moves to the first option")
        page.get_by_text("Lajang", exact=True).click()
        expect(page.get_by_text(re.compile(r"target 3× = Rp\s?24\.000\.000"))).to_be_visible()
        page.get_by_text("Menikah dengan anak", exact=True).click()
        expect(page.locator("#ef-months-9")).to_be_checked()
        page.locator("label[for='ef-months-12']").click()
        expect(page.get_by_text(re.compile(r"target 12× = Rp\s?96\.000\.000"))).to_be_visible()
        ok(f"[{tag}] status sets the multiplier: lajang 3x, menikah dengan anak 9 or 12")
        expect(page.locator("label[for^='ef-tag-']")).to_have_count(1)
        page.locator("label[for^='ef-tag-']").first.click()
        expect(page.get_by_text(re.compile(r"sisihkan Rp\s?2\.000\.000 dari pemasukan, tercapai dalam 33 bulan"))).to_be_visible()
        ok(f"[{tag}] only eligible instruments can be tagged; 10% allocation Rp 2.000.000, target in 33 months")
        page.fill("#ef-pct", "")
        page.get_by_role("button", name=re.compile("Lanjut ke utang")).click()
        expect(page.locator("#ef-pct-error")).to_be_visible()
        page.fill("#ef-pct", "10")
        ok(f"[{tag}] empty allocation percentage is rejected")
        page.screenshot(path=f"{OUT}/{tag}-03b-darurat.png", full_page=True)
        no_overflow(page, f"[{tag}] wizard dana darurat")
        page.get_by_role("button", name=re.compile("Lanjut ke utang")).click()

        debt_name = page.locator("input[id^='debt-'][id$='-name']").first
        expect(debt_name).to_have_value("Cicilan")
        page.get_by_role("button", name=re.compile("Lanjut ke aset")).click()
        expect(page.locator("[id^='debt-'][id$='-principal-error']")).to_be_visible()
        expect(page.locator("input[id^='debt-'][id$='-principal']").first).to_be_focused()
        ok(f"[{tag}] carried installment without principal is caught at Utang step, focus moves to it")
        debt_name.fill("KPR rumah")
        page.locator("select[id^='debt-']").first.select_option("kpr")
        page.locator("input[id^='debt-'][id$='-principal']").first.fill("400000000")
        page.get_by_role("button", name=re.compile("Lanjut ke aset")).click()

        expect(page.get_by_text("Belum ada aset yang dicatat")).to_be_visible()
        ok(f"[{tag}] empty state on Aset step explains what to add")
        page.get_by_role("button", name="Tambah aset").click()
        page.locator("input[id^='asset-'][id$='-name']").first.fill("Rumah")
        page.locator("input[id^='asset-'][id$='-val']").first.fill("800000000")
        page.get_by_role("button", name=re.compile("Lanjut ke ringkasan")).click()

        expect(page.get_by_role("heading", name="Kekayaan bersih")).to_be_visible()
        expect(page.get_by_text(re.compile(r"Rp\s?430\.500\.000")).first).to_be_visible()
        expect(page.get_by_text(re.compile(r"melewati batas 30%\. Cicilan maksimal Rp\s?6\.000\.000"))).to_be_visible()
        expect(page.get_by_text(re.compile(r"Dana darurat kurang Rp\s?66\.000\.000"))).to_be_visible()
        ok(f"[{tag}] summary: net worth Rp 430.500.000, cicilan over 30% flagged with max, emergency shortfall Rp 66.000.000")
        page.screenshot(path=f"{OUT}/{tag}-04-ringkasan.png", full_page=True)
        no_overflow(page, f"[{tag}] wizard ringkasan")

        page.reload()
        expect(page.get_by_role("heading", name="Ringkasan", level=1)).to_be_visible()
        ok(f"[{tag}] reload keeps the draft and returns to the furthest step")

        page.get_by_role("button", name="Kembali").click()
        expect(page.get_by_role("heading", name="Aset & investasi", level=1)).to_be_visible()
        ok(f"[{tag}] 'Kembali' goes to previous step")
        if width >= 1024:
            page.get_by_role("navigation", name="Langkah isian").get_by_role("button", name="Ringkasan").click()
        else:
            page.get_by_role("button", name=re.compile("Lanjut ke ringkasan")).click()
        expect(page.get_by_role("heading", name="Ringkasan", level=1)).to_be_visible()

        reset_btn = page.get_by_role("button", name="Kosongkan semua isian").locator("visible=true")
        reset_btn.click()
        dialog = page.get_by_role("dialog")
        expect(dialog).to_be_visible()
        page.keyboard.press("Escape")
        expect(dialog).to_be_hidden()
        reset_btn.click()
        page.get_by_role("button", name="Batal").click()
        expect(dialog).to_be_hidden()
        ok(f"[{tag}] reset dialog opens, closes with Escape and with Batal, data kept")
        expect(page.get_by_role("heading", name="Ringkasan", level=1)).to_be_visible()

        page.get_by_role("button", name="Simpan kondisi awal").click()
        page.wait_for_url(re.compile(r"/masuk\?next=%2Fmulai%2Fsimpan"))
        expect(page.get_by_text("Masuk dulu untuk menyimpan")).to_be_visible()
        ok(f"[{tag}] 'Simpan kondisi awal' without session -> /masuk?next=/mulai/simpan with explanation")
        page.screenshot(path=f"{OUT}/{tag}-05-masuk.png", full_page=True)
        no_overflow(page, f"[{tag}] masuk")

        page.get_by_role("button", name="Kirim tautan masuk").click()
        expect(page.locator("#email-error")).to_be_visible()
        expect(page.locator("#email")).to_be_focused()
        ok(f"[{tag}] empty email shows error and keeps focus")
        page.fill("#email", email)
        page.get_by_role("button", name="Kirim tautan masuk").click()
        expect(page.get_by_role("heading", name="Cek email Anda")).to_be_visible()
        ok(f"[{tag}] valid email -> 'Cek email Anda'")
        page.get_by_role("button", name="Pakai email lain").click()
        expect(page.get_by_role("button", name="Kirim tautan masuk")).to_be_visible()
        page.fill("#email", email)
        page.get_by_role("button", name="Kirim tautan masuk").click()
        expect(page.get_by_role("heading", name="Cek email Anda")).to_be_visible()
        ok(f"[{tag}] 'Pakai email lain' returns to the form")

        page.goto(BASE + "/auth/callback?code=bogus&next=%2Fmulai%2Fsimpan")
        expect(page.get_by_role("alert").filter(has_text="kedaluwarsa")).to_be_visible()
        ok(f"[{tag}] bad magic link -> /masuk with 'kedaluwarsa' message")

        page.goto(BASE + f"/auth/callback?code=code-{email}&next=%2Fmulai%2Fsimpan")
        page.wait_for_url("**/dashboard", timeout=15000)
        ok(f"[{tag}] magic link -> /mulai/simpan -> saved via save_baseline -> /dashboard")
        expect(page.get_by_role("heading", level=1)).to_contain_text("Kondisi keuangan keluarga, Ayah")
        expect(page.get_by_text(re.compile(r"Rp\s?430\.500\.000")).first).to_be_visible()
        expect(page.get_by_role("region", name="Rekening & kas")).to_contain_text("Dompet")
        expect(page.get_by_role("region", name="Utang")).to_contain_text("KPR rumah")
        expect(page.get_by_role("region", name="Rekening & kas").get_by_text("Dana darurat")).to_be_visible()
        expect(page.get_by_text(re.compile(r"Menikah dengan anak · 12× pengeluaran rutin"))).to_be_visible()
        ok(f"[{tag}] dashboard reads saved rows back through RLS (net worth, accounts, debts)")
        page.screenshot(path=f"{OUT}/{tag}-06-dashboard.png", full_page=True)
        no_overflow(page, f"[{tag}] dashboard")

        page.get_by_role("button", name="Perbarui kondisi awal").click()
        page.wait_for_url("**/mulai")
        expect(page.get_by_role("heading", name="Ringkasan", level=1)).to_be_visible()
        if width >= 1024:
            page.get_by_role("navigation", name="Langkah isian").get_by_role("button", name="Rekening & kas").click()
        else:
            for _ in range(6):
                page.get_by_role("button", name="Kembali").click()
        expect(page.locator("input[id^='acc-'][id$='-name']").nth(1)).to_have_value("Dompet")
        page.locator("input[id^='acc-'][id$='-bal']").nth(1).fill("1500000")
        ok(f"[{tag}] 'Perbarui kondisi awal' loads saved data into the wizard")
        if width >= 1024:
            page.get_by_role("navigation", name="Langkah isian").get_by_role("button", name="Ringkasan").click()
        else:
            for name in ["pemasukan", "pengeluaran", "dana darurat", "utang", "aset", "ringkasan"]:
                page.get_by_role("button", name=re.compile(f"Lanjut ke {name}")).click()
        page.get_by_role("button", name="Simpan kondisi awal").click()
        page.wait_for_url("**/dashboard", timeout=15000)
        expect(page.get_by_text(re.compile(r"Rp\s?431\.500\.000")).first).to_be_visible()
        ok(f"[{tag}] second save updates the same household (net worth Rp 431.500.000)")

        page.goto(BASE + "/mulai/simpan")
        expect(page.get_by_role("heading", name="Tidak ada isian yang menunggu disimpan")).to_be_visible()
        page.get_by_role("link", name="Buka dashboard").click()
        page.wait_for_url("**/dashboard")
        ok(f"[{tag}] /mulai/simpan with no draft shows empty state, 'Buka dashboard' works")

        page.get_by_role("button", name="Keluar").click()
        page.wait_for_url(BASE + "/")
        page.goto(BASE + "/dashboard")
        page.wait_for_url(re.compile(r"/masuk\?next=%2Fdashboard"))
        ok(f"[{tag}] 'Keluar' signs out; /dashboard then redirects to /masuk")

        page.goto(BASE + "/tidak-ada")
        expect(page.get_by_role("heading", name="Halaman tidak ditemukan")).to_be_visible()
        page.get_by_role("link", name="Ke beranda").click()
        page.wait_for_url(BASE + "/")
        ok(f"[{tag}] 404 page and its 'Ke beranda' link")

        page.get_by_role("link", name="Masuk", exact=True).click()
        page.wait_for_url("**/masuk")
        page.go_back()
        page.get_by_role("link", name="Sudah punya akun? Masuk").click()
        page.wait_for_url("**/masuk")
        page.go_back()
        page.get_by_role("link", name="Kas Keluarga").first.click()
        page.wait_for_url(BASE + "/")
        ok(f"[{tag}] header 'Masuk', hero 'Sudah punya akun? Masuk', and logo links navigate")

        page.get_by_role("link", name="Kebijakan Privasi").click()
        page.wait_for_url("**/privasi")
        expect(page.get_by_role("heading", name="Kebijakan Privasi", level=1)).to_be_visible()
        no_overflow(page, f"[{tag}] privasi")
        page.screenshot(path=f"{OUT}/{tag}-07-privasi.png", full_page=True)
        page.get_by_role("link", name="Syarat Layanan").first.click()
        page.wait_for_url("**/ketentuan")
        expect(page.get_by_role("heading", name="Syarat Layanan", level=1)).to_be_visible()
        no_overflow(page, f"[{tag}] ketentuan")
        page.goto(BASE + "/masuk")
        page.get_by_role("link", name="Syarat Layanan").click()
        page.wait_for_url("**/ketentuan")
        page.goto(BASE + "/")
        ok(f"[{tag}] footer and login links open Kebijakan Privasi and Syarat Layanan, both link to each other")

        page.keyboard.press("Tab")
        focused = page.evaluate("getComputedStyle(document.activeElement).outlineStyle + ' ' + getComputedStyle(document.activeElement).outlineWidth")
        assert "solid" in focused, focused
        ok(f"[{tag}] keyboard focus is visible ({focused})")

        browser.close()


run(1280, 900, "desktop", "uji.desktop@contoh.com")
run(375, 812, "mobile", "uji.mobile@contoh.com")

print("\n".join(log))
print(f"\nconsole errors: {len(console_errors)}")
for e in console_errors:
    print("  ", e)
with open(f"{OUT}/clickthrough.json", "w") as f:
    json.dump({"passed": log, "console_errors": console_errors}, f, indent=2)
sys.exit(1 if console_errors else 0)
