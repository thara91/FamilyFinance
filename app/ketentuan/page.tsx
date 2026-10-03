import type { Metadata } from 'next';
import { Contact, LegalPage, List, Section } from '@/components/legal/LegalPage';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Syarat Layanan' };

export default function TermsPage() {
  return (
    <LegalPage title="Syarat Layanan" other={{ href: '/privasi', label: 'Kebijakan Privasi' }}>
      <p>
        Dengan masuk ke {SITE.name}, Anda menyetujui syarat berikut. Bila tidak setuju, jangan gunakan layanan ini. Cara data Anda diproses dijelaskan di{' '}
        halaman Kebijakan Privasi (tautan di bagian atas).
      </p>

      <Section id="layanan" title="1. Layanan">
        <p>
          {SITE.name} adalah alat untuk mencatat kondisi keuangan keluarga dan menghitung ringkasannya. {SITE.name} bukan bank, tidak menyimpan
          atau memindahkan uang, dan tidak terhubung ke rekening Anda. Semua angka berasal dari isian Anda.
        </p>
      </Section>

      <Section id="nasihat" title="2. Bukan nasihat keuangan">
        <p>Hitungan di aplikasi memakai aturan bawaan sebagai panduan umum:</p>
        <List>
          <li>total cicilan tidak lebih dari 30% pemasukan;</li>
          <li>target dana darurat sebesar pengeluaran rutin per bulan dikali 12 (tidak berpenghasilan tetap), 3 (lajang), 6 (menikah tanpa anak), atau 9 sampai 12 (menikah dengan anak);</li>
          <li>alokasi dana darurat 10% pemasukan per bulan ke tabungan bank, e-wallet, atau reksa dana pasar uang.</li>
        </List>
        <p>
          Aturan ini tidak memperhitungkan seluruh keadaan keluarga Anda dan bukan rekomendasi investasi. Keputusan keuangan tetap tanggung jawab
          Anda. Untuk keputusan besar, konsultasikan dengan perencana keuangan yang berlisensi.
        </p>
      </Section>

      <Section id="akun" title="3. Akun">
        <List>
          <li>Akun dibuat dengan alamat email. Siapa pun yang bisa membuka email itu bisa masuk, jadi jaga akses email Anda.</li>
          <li>Pengguna yang pertama menyimpan kondisi awal menjadi pemilik data keluarga tersebut.</li>
          <li>Anda bertanggung jawab atas kebenaran data yang Anda isi.</li>
        </List>
      </Section>

      <Section id="larangan" title="4. Penggunaan yang tidak diperbolehkan">
        <List>
          <li>Mencoba mengakses data keluarga lain.</li>
          <li>Mengganggu atau membebani layanan secara sengaja.</li>
          <li>Memakai layanan untuk tujuan yang melanggar hukum.</li>
        </List>
      </Section>

      <Section id="ketersediaan" title="5. Ketersediaan">
        <p>
          {SITE.name} masih versi awal. Fitur dapat berubah, dan layanan dapat terganggu atau dihentikan. Simpan catatan sendiri untuk data yang
          penting bagi Anda.
        </p>
      </Section>

      <Section id="tanggung" title="6. Batasan tanggung jawab">
        <p>
          Sejauh diizinkan hukum, pengelola tidak bertanggung jawab atas kerugian yang timbul dari keputusan yang diambil berdasarkan hitungan
          aplikasi, kesalahan isian, atau gangguan layanan.
        </p>
      </Section>

      <Section id="berhenti" title="7. Mengakhiri penggunaan">
        <p>
          Anda dapat berhenti kapan saja dan meminta penghapusan akun lewat kontak di bawah. Pengelola dapat menonaktifkan akun yang melanggar bagian 4.
        </p>
      </Section>

      <Section id="hukum" title="8. Hukum yang berlaku">
        <p>Syarat ini tunduk pada hukum Republik Indonesia.</p>
      </Section>

      <Section id="kontak" title="9. Perubahan dan kontak">
        <p>Bila syarat ini berubah, tanggal berlaku di atas diperbarui. Pertanyaan dikirim ke:</p>
        <Contact />
      </Section>
    </LegalPage>
  );
}
